// Integration: original TEST MODE purchase flow + validation + authorization,
// against a real MongoDB (MONGO_URI_TEST).
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
const { startServer, createClient } = require("../helpers/server");

let srv;
let plan;
let inactivePlan;

const signupClient = async (email) => {
  const c = createClient(srv.baseUrl);
  const res = await c.post("/api/auth/signup", {
    name: "Test Buyer",
    email,
    phone: "08012345678",
    password: "password123",
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return c;
};

test.before(async () => {
  if (skip) return;
  await connectTestDb(connectDB);
  await mongoose.connection.dropDatabase();
  await Promise.all([Transaction.syncIndexes(), Plan.syncIndexes()]);
  plan = await Plan.create({ network: "MTN", name: "1GB Test", price: 550, validity: "30 days" });
  inactivePlan = await Plan.create({ network: "MTN", name: "Old", price: 100, validity: "1 day", active: false });
  srv = await startServer(app);
});

test.after(async () => {
  if (skip) return;
  await cleanupTestDb(mongoose, srv);
});

test("unauthenticated purchase and history requests are rejected", { skip }, async () => {
  const anon = createClient(srv.baseUrl);
  assert.equal((await anon.post("/api/transactions/data", { planId: String(plan._id), phone: "08012345678" })).status, 401);
  assert.equal((await anon.post("/api/transactions/airtime", { network: "MTN", amount: 100, phone: "08012345678" })).status, 401);
  assert.equal((await anon.get("/api/transactions")).status, 401);
  assert.equal((await anon.post("/api/transactions/verify", { reference: "ESCP-X" })).status, 401);
});

test("input validation: phone, network, amount, plan", { skip }, async () => {
  const c = await signupClient("validation@example.com");
  const bad = async (path, body) => {
    const res = await c.post(path, body);
    assert.equal(res.status, 400, `${path} ${JSON.stringify(body)} -> ${res.status}`);
  };
  await bad("/api/transactions/data", { planId: String(plan._id), phone: "12345" });
  await bad("/api/transactions/data", { planId: String(plan._id), phone: "08612345678" });
  await bad("/api/transactions/data", { planId: "not-an-id", phone: "08012345678" });
  await bad("/api/transactions/data", { planId: String(new mongoose.Types.ObjectId()), phone: "08012345678" });
  await bad("/api/transactions/data", { planId: String(inactivePlan._id), phone: "08012345678" });
  await bad("/api/transactions/airtime", { network: "Etisalat", amount: 100, phone: "08012345678" });
  for (const amount of [99, 10001, 150.5, "abc", -100, null]) {
    await bad("/api/transactions/airtime", { network: "MTN", amount, phone: "08012345678" });
  }
  assert.equal(await Transaction.countDocuments(), 0, "no order created by invalid requests");
});

test("data price comes from the database, not the request", { skip }, async () => {
  const c = await signupClient("pricing@example.com");
  const res = await c.post("/api/transactions/data", {
    planId: String(plan._id),
    phone: "08012345678",
    amount: 1,
    price: 1,
    plan: "FREE",
    network: "Glo",
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.transaction.amount, 550);
  assert.equal(res.body.transaction.network, "MTN");
  assert.equal(res.body.transaction.plan, "1GB Test");
  assert.equal(res.body.transaction.paymentAmountKobo, 55000);
});

test("existing test-mode purchase behaviour is preserved", { skip }, async () => {
  const c = await signupClient("testmode@example.com");
  const data = await c.post("/api/transactions/test", { planId: String(plan._id), phone: "+2348012345678" });
  assert.equal(data.status, 201);
  const tx = data.body.transaction;
  assert.equal(tx.status, "successful");
  assert.equal(tx.paymentStatus, "not_required");
  assert.equal(tx.providerStatus, "successful");
  assert.equal(tx.mode, "test");
  assert.match(tx.transactionId, /^ESCP-\d{8}-[0-9A-F]{6}$/);
  assert.match(tx.providerReference, /^VTU-TEST-/);

  const airtime = await c.post("/api/transactions/airtime", { network: "airtel", amount: 200, phone: "08123456789" });
  assert.equal(airtime.status, 201);
  assert.equal(airtime.body.transaction.network, "Airtel");
  assert.equal(airtime.body.transaction.amount, 200);
  assert.equal(airtime.body.transaction.status, "successful");
});

test("repeated submits with the same clientReference create one order", { skip }, async () => {
  const c = await signupClient("idempotent@example.com");
  const body = { network: "MTN", amount: 300, phone: "08012345678", clientReference: "11111111-2222-3333-4444-555555555555" };
  const results = await Promise.all([c.post("/api/transactions/airtime", body), c.post("/api/transactions/airtime", body), c.post("/api/transactions/airtime", body)]);
  for (const r of results) assert.ok([200, 201].includes(r.status), JSON.stringify(r.body));
  const ids = new Set(results.map((r) => r.body.transaction.transactionId));
  assert.equal(ids.size, 1);
  assert.equal(await Transaction.countDocuments({ clientReference: body.clientReference }), 1);
});

test("users can only see their own transactions", { skip }, async () => {
  const alice = await signupClient("alice@example.com");
  const bob = await signupClient("bob@example.com");
  const created = await alice.post("/api/transactions/airtime", { network: "Glo", amount: 100, phone: "08012345678" });
  const tx = created.body.transaction;

  assert.equal((await alice.get(`/api/transactions/${tx.transactionId}`)).status, 200);
  assert.equal((await bob.get(`/api/transactions/${tx.transactionId}`)).status, 404);
  assert.equal((await bob.get(`/api/transactions/${tx._id}`)).status, 404);
  const bobList = await bob.get("/api/transactions");
  assert.equal(bobList.body.transactions.length, 0);
});

test("history search treats regex characters literally", { skip }, async () => {
  const c = await signupClient("search@example.com");
  for (const q of ["(a+)+$", "[", "*", "\\"]) {
    const res = await c.get(`/api/transactions?q=${encodeURIComponent(q)}`);
    assert.equal(res.status, 200, q);
  }
});
