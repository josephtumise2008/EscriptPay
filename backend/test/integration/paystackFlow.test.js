// Integration: Paystack TEST-mode checkout -> verify/webhook -> delivery,
// against a real MongoDB (MONGO_URI_TEST). Paystack itself is replaced by a
// fake HTTP layer; no request leaves the machine and no money moves.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { getTestMongoUri, SKIP_REASON, connectTestDb, cleanupTestDb } = require("../helpers/testDb");

const uri = getTestMongoUri();
const skip = uri ? false : SKIP_REASON;
const SECRET = "sk_test_integration_only";

process.env.NODE_ENV = "test";
process.env.MONGO_URI = uri || "mongodb://127.0.0.1:1/unused_test";
process.env.JWT_SECRET = "integration-jwt-secret";
process.env.PAYMENT_SERVICE = "paystack";
process.env.PAYSTACK_SECRET_KEY = SECRET;
process.env.VTU_SERVICE = "test";
process.env.TEST_VTU_DELAY_MS = "0";
process.env.APP_URL = "http://localhost:3000";

const mongoose = require("mongoose");
const app = require("../../src/server");
const connectDB = require("../../src/config/db");
const Plan = require("../../src/models/Plan");
const Transaction = require("../../src/models/Transaction");
const paystack = require("../../src/services/payment/paystackPaymentService");
const { startServer, createClient } = require("../helpers/server");

// ---- Fake Paystack -------------------------------------------------------
const fake = {
  initCalls: [],
  verifyCalls: 0,
  initFails: false,
  // reference -> override for the verify response
  verifyOverride: new Map(),
};
const respond = (status, body) => ({ status, json: async () => body });
paystack.__setFetch(async (url, init) => {
  assert.equal(init.headers.Authorization, `Bearer ${SECRET}`);
  if (url.endsWith("/transaction/initialize")) {
    const body = JSON.parse(init.body);
    fake.initCalls.push(body);
    if (fake.initFails) return respond(400, { status: false, message: "Invalid" });
    return respond(200, {
      status: true,
      data: { authorization_url: `https://checkout.paystack.com/${body.reference}`, access_code: "ac", reference: body.reference },
    });
  }
  const m = url.match(/\/transaction\/verify\/(.+)$/);
  if (m) {
    fake.verifyCalls += 1;
    const reference = decodeURIComponent(m[1]);
    const init = fake.initCalls.find((c) => c.reference === reference);
    if (!init) return respond(400, { status: false, message: "Transaction reference not found" });
    const data = { status: "success", amount: Number(init.amount), currency: "NGN", reference, paid_at: new Date().toISOString(), id: 1 };
    return respond(200, { status: true, data: { ...data, ...(fake.verifyOverride.get(reference) || {}) } });
  }
  return respond(404, { status: false });
});

const signedWebhook = (client, payload) => {
  const raw = Buffer.from(JSON.stringify(payload));
  const sig = crypto.createHmac("sha512", SECRET).update(raw).digest("hex");
  return client.post("/api/payments/paystack/webhook", raw, { "Content-Type": "application/json", "x-paystack-signature": sig });
};

let srv;
let plan;
let buyer;
let other;

test.before(async () => {
  if (skip) return;
  await connectTestDb(connectDB);
  await mongoose.connection.dropDatabase();
  await Promise.all([Transaction.syncIndexes(), Plan.syncIndexes()]);
  plan = await Plan.create({ network: "Airtel", name: "2GB Test", price: 1200, validity: "30 days" });
  srv = await startServer(app);
  buyer = createClient(srv.baseUrl);
  other = createClient(srv.baseUrl);
  for (const [c, email] of [[buyer, "buyer@example.com"], [other, "other@example.com"]]) {
    const r = await c.post("/api/auth/signup", { name: "Buyer Person", email, phone: "08012345678", password: "password123" });
    assert.equal(r.status, 201);
  }
});

test.after(async () => {
  if (skip) return;
  paystack.__setFetch(null);
  await cleanupTestDb(mongoose, srv);
});

const startCheckout = async (client = buyer) => {
  const res = await client.post("/api/transactions/data", {
    planId: String(plan._id),
    phone: "08012345678",
    email: "attacker@example.com",
    amount: 1,
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
};

test("checkout is initialized server-side with DB price (kobo), NGN and the account email", { skip }, async () => {
  const body = await startCheckout();
  const init = fake.initCalls.at(-1);
  assert.equal(init.amount, "120000");
  assert.equal(init.currency, "NGN");
  assert.equal(init.email, "buyer@example.com");
  assert.equal(init.reference, body.transaction.paymentReference);
  assert.equal(init.callback_url, "http://localhost:3000/payment/callback");
  assert.equal(body.checkoutUrl, `https://checkout.paystack.com/${init.reference}`);

  const tx = await Transaction.findOne({ paymentReference: init.reference });
  assert.equal(tx.paymentStatus, "pending");
  assert.equal(tx.providerStatus, "pending", "nothing delivered at initialization");
  assert.equal(tx.status, "pending");
});

test("verify: only the owner may verify; unknown references 404", { skip }, async () => {
  const { transaction } = await startCheckout();
  assert.equal((await other.post("/api/transactions/verify", { reference: transaction.paymentReference })).status, 404);
  assert.equal((await buyer.post("/api/transactions/verify", { reference: "ESCP-NOPE" })).status, 404);
  assert.equal((await buyer.post("/api/transactions/verify", { reference: "bad ref/.." })).status, 400);
  const tx = await Transaction.findOne({ paymentReference: transaction.paymentReference });
  assert.equal(tx.providerStatus, "pending");
});

test("abandoned payment: still pending, nothing delivered", { skip }, async () => {
  const { transaction } = await startCheckout();
  fake.verifyOverride.set(transaction.paymentReference, { status: "abandoned" });
  const res = await buyer.post("/api/transactions/verify", { reference: transaction.paymentReference });
  assert.equal(res.status, 200);
  assert.equal(res.body.transaction.paymentStatus, "pending");
  assert.equal(res.body.transaction.providerStatus, "pending");
});

test("amount mismatch and wrong currency are never delivered", { skip }, async () => {
  const a = (await startCheckout()).transaction;
  fake.verifyOverride.set(a.paymentReference, { amount: 100 });
  const ra = await buyer.post("/api/transactions/verify", { reference: a.paymentReference });
  assert.equal(ra.body.transaction.status, "failed");
  assert.equal(ra.body.transaction.providerStatus, "pending");
  assert.equal(ra.body.transaction.needsReview, true);

  const b = (await startCheckout()).transaction;
  fake.verifyOverride.set(b.paymentReference, { currency: "GHS" });
  const rb = await buyer.post("/api/transactions/verify", { reference: b.paymentReference });
  assert.equal(rb.body.transaction.providerStatus, "pending");
  assert.match(rb.body.transaction.failureReason, /currency_mismatch/);
});

test("verified payment via callback delivers once; repeat verify is a no-op", { skip }, async () => {
  const { transaction } = await startCheckout();
  const first = await buyer.post("/api/transactions/verify", { reference: transaction.paymentReference });
  assert.equal(first.status, 200);
  assert.equal(first.body.transaction.paymentStatus, "successful");
  assert.equal(first.body.transaction.providerStatus, "successful");
  assert.equal(first.body.transaction.status, "successful");

  const again = await buyer.post("/api/transactions/verify", { reference: transaction.paymentReference });
  assert.equal(again.body.transaction.status, "successful");
  const tx = await Transaction.findOne({ paymentReference: transaction.paymentReference });
  assert.equal(tx.fulfillmentAttempts, 1);
});

test("duplicate signed webhooks deliver exactly once", { skip }, async () => {
  const { transaction } = await startCheckout();
  const event = { event: "charge.success", data: { reference: transaction.paymentReference } };
  for (let i = 0; i < 3; i++) assert.equal((await signedWebhook(buyer, event)).status, 200);
  const tx = await Transaction.findOne({ paymentReference: transaction.paymentReference });
  assert.equal(tx.paymentStatus, "successful");
  assert.equal(tx.paymentVerifiedVia, "webhook");
  assert.equal(tx.status, "successful");
  assert.equal(tx.fulfillmentAttempts, 1);
});

test("concurrent callback + webhooks: one delivery (real MongoDB atomic updates)", { skip }, async () => {
  const { transaction } = await startCheckout();
  const ref = transaction.paymentReference;
  const event = { event: "charge.success", data: { reference: ref } };
  const results = await Promise.all([
    buyer.post("/api/transactions/verify", { reference: ref }),
    signedWebhook(buyer, event),
    signedWebhook(buyer, event),
    buyer.post("/api/transactions/verify", { reference: ref }),
  ]);
  for (const r of results) assert.ok([200].includes(r.status), JSON.stringify(r.body));
  const tx = await Transaction.findOne({ paymentReference: ref });
  assert.equal(tx.fulfillmentAttempts, 1);
  assert.equal(tx.status, "successful");
});

test("webhook with a bad signature changes nothing", { skip }, async () => {
  const { transaction } = await startCheckout();
  const raw = Buffer.from(JSON.stringify({ event: "charge.success", data: { reference: transaction.paymentReference } }));
  const res = await buyer.post("/api/payments/paystack/webhook", raw, { "Content-Type": "application/json", "x-paystack-signature": "0".repeat(128) });
  assert.equal(res.status, 401);
  const tx = await Transaction.findOne({ paymentReference: transaction.paymentReference });
  assert.equal(tx.paymentStatus, "pending");
});

test("webhook for an unknown reference is acknowledged and ignored", { skip }, async () => {
  const before = await Transaction.countDocuments();
  const res = await signedWebhook(buyer, { event: "charge.success", data: { reference: "ESCP-UNKNOWN-1" } });
  assert.equal(res.status, 200);
  assert.equal(await Transaction.countDocuments(), before);
});

test("initialization failure: 502, order marked failed, nothing delivered", { skip }, async () => {
  fake.initFails = true;
  try {
    const res = await buyer.post("/api/transactions/airtime", { network: "MTN", amount: 500, phone: "08012345678" });
    assert.equal(res.status, 502);
    assert.match(res.body.message, /not been charged/);
    const tx = await Transaction.findOne({ paymentAmountKobo: 50000 }).sort({ createdAt: -1 });
    assert.equal(tx.paymentStatus, "failed");
    assert.equal(tx.providerStatus, "pending");
  } finally {
    fake.initFails = false;
  }
});
