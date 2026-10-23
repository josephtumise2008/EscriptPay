// Integration: wallet funding + paying for orders from the wallet, in TEST
// MODE, against a real MongoDB (MONGO_URI_TEST).
const test = require("node:test");
const assert = require("node:assert/strict");
const { getTestMongoUri, SKIP_REASON, connectTestDb, cleanupTestDb } = require("../helpers/testDb");

const uri = getTestMongoUri();
const skip = uri ? false : SKIP_REASON;

process.env.NODE_ENV = "test";
process.env.MONGO_URI = uri || "mongodb://127.0.0.1:1/unused_test";
process.env.JWT_SECRET = "integration-jwt-secret";
process.env.PAYMENT_SERVICE = "test";
process.env.VTU_SERVICE = "test";
process.env.TEST_PAYMENT_DELAY_MS = "0";
process.env.TEST_VTU_DELAY_MS = "0";

const mongoose = require("mongoose");
const app = require("../../src/server");
const connectDB = require("../../src/config/db");
const Plan = require("../../src/models/Plan");
const Transaction = require("../../src/models/Transaction");
const WalletEntry = require("../../src/models/WalletEntry");
const User = require("../../src/models/User");
const { startServer, createClient } = require("../helpers/server");

let srv;
let plan;

const signupClient = async (email) => {
  const c = createClient(srv.baseUrl);
  const res = await c.post("/api/auth/signup", { name: "Wallet User", email, phone: "08012345678", password: "password123" });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return c;
};

test.before(async () => {
  if (skip) return;
  await connectTestDb(connectDB);
  await mongoose.connection.dropDatabase();
  await Promise.all([Transaction.syncIndexes(), Plan.syncIndexes(), WalletEntry.syncIndexes(), User.syncIndexes()]);
  plan = await Plan.create({ network: "MTN", name: "1GB Test", price: 550, validity: "30 days" });
  srv = await startServer(app);
});

test.after(async () => {
  if (skip) return;
  await cleanupTestDb(mongoose, srv);
});

test("wallet routes require login", { skip }, async () => {
  const anon = createClient(srv.baseUrl);
  assert.equal((await anon.get("/api/wallet")).status, 401);
  assert.equal((await anon.post("/api/wallet/fund", { amount: 1000 })).status, 401);
});

test("new users start at ₦0 and funding validates the amount", { skip }, async () => {
  const c = await signupClient("fund-validate@example.com");
  const w = await c.get("/api/wallet");
  assert.equal(w.status, 200);
  assert.equal(w.body.wallet.balance, 0);
  for (const amount of [0, 99, 500001, 150.5, "abc", -100, null]) {
    assert.equal((await c.post("/api/wallet/fund", { amount })).status, 400, `amount ${amount}`);
  }
  assert.equal(await WalletEntry.countDocuments(), 0);
});

test("fund wallet, pay for data and airtime from it, history shows it", { skip }, async () => {
  const c = await signupClient("wallet-flow@example.com");

  const funded = await c.post("/api/wallet/fund", { amount: 1000, clientReference: "fund-flow-0001" });
  assert.equal(funded.status, 201, JSON.stringify(funded.body));
  assert.equal(funded.body.wallet.balance, 1000);

  // Same idempotency key again: not credited twice.
  const again = await c.post("/api/wallet/fund", { amount: 1000, clientReference: "fund-flow-0001" });
  assert.equal(again.status, 200);
  assert.equal(again.body.wallet.balance, 1000);

  const data = await c.post("/api/transactions/data", { planId: String(plan._id), phone: "08012345678", payWith: "wallet" });
  assert.equal(data.status, 201, JSON.stringify(data.body));
  assert.equal(data.body.transaction.status, "successful");
  assert.equal(data.body.transaction.paymentProvider, "wallet");
  assert.equal(data.body.wallet.balance, 450);

  const airtime = await c.post("/api/transactions/airtime", { network: "Glo", amount: 400, phone: "08051234567", payWith: "wallet" });
  assert.equal(airtime.status, 201);
  assert.equal(airtime.body.wallet.balance, 50);

  const tooMuch = await c.post("/api/transactions/airtime", { network: "MTN", amount: 100, phone: "08012345678", payWith: "wallet" });
  assert.equal(tooMuch.status, 400);
  assert.equal(tooMuch.body.code, "insufficient_funds");

  const history = await c.get("/api/wallet");
  assert.equal(history.body.wallet.balance, 50);
  assert.deepEqual(history.body.entries.map((e) => e.kind), ["purchase", "purchase", "funding"]);
});

test("simultaneous wallet purchases never overspend", { skip }, async () => {
  const c = await signupClient("wallet-race@example.com");
  await c.post("/api/wallet/fund", { amount: 1000 });
  const results = await Promise.all(
    Array.from({ length: 5 }, () => c.post("/api/transactions/airtime", { network: "MTN", amount: 300, phone: "08012345678", payWith: "wallet" }))
  );
  assert.equal(results.filter((r) => r.status === 201).length, 3);
  const w = await c.get("/api/wallet");
  assert.equal(w.body.wallet.balance, 100);
});

test("a failed delivery refunds the wallet", { skip }, async () => {
  const c = await signupClient("wallet-refund@example.com");
  await c.post("/api/wallet/fund", { amount: 1000 });
  process.env.TEST_VTU_OUTCOME = "failed";
  try {
    const res = await c.post("/api/transactions/airtime", { network: "MTN", amount: 500, phone: "08012345678", payWith: "wallet" });
    assert.equal(res.status, 201);
    assert.equal(res.body.transaction.status, "failed");
    assert.equal(res.body.wallet.balance, 1000);
  } finally {
    delete process.env.TEST_VTU_OUTCOME;
  }
  const w = await c.get("/api/wallet");
  assert.deepEqual(w.body.entries.map((e) => e.kind), ["refund", "purchase", "funding"]);
});

test("one user cannot see another user's wallet", { skip }, async () => {
  const a = await signupClient("wallet-a@example.com");
  const b = await signupClient("wallet-b@example.com");
  await a.post("/api/wallet/fund", { amount: 2000 });
  const bw = await b.get("/api/wallet");
  assert.equal(bw.body.wallet.balance, 0);
  assert.equal(bw.body.entries.length, 0);
});
