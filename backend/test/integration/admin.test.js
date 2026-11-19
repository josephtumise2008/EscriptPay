// Integration: admin overview access control and profit numbers.
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
const User = require("../../src/models/User");
const Plan = require("../../src/models/Plan");
const Transaction = require("../../src/models/Transaction");
const WalletEntry = require("../../src/models/WalletEntry");
const { startServer, createClient } = require("../helpers/server");

let srv;

const signup = async (email) => {
  const c = createClient(srv.baseUrl);
  const r = await c.post("/api/auth/signup", { name: "Some User", email, phone: "08012345678", password: "password123" });
  assert.equal(r.status, 201);
  return c;
};

test.before(async () => {
  if (skip) return;
  await connectTestDb(connectDB);
  await mongoose.connection.dropDatabase();
  srv = await startServer(app);
});

test.after(async () => {
  if (skip) return;
  await cleanupTestDb(mongoose, srv);
});

test("only admins can open the overview; profit = sales - cost", { skip }, async () => {
  const customer = await signup("customer@example.com");
  assert.equal((await customer.get("/api/admin/overview")).status, 403);
  assert.equal((await createClient(srv.baseUrl).get("/api/admin/overview")).status, 401);

  const plan = await Plan.create({ network: "MTN", name: "1 GB - Weekly (SME)", price: 450, costPrice: 410, validity: "Weekly", provider: "clubkonnect", providerPlanId: "1000" });
  const bought = await customer.post("/api/transactions/data", { planId: String(plan._id), phone: "08012345678" });
  assert.equal(bought.status, 201);
  assert.equal(bought.body.transaction.costKobo, undefined, "cost is never shown to customers");
  const stored = await Transaction.findOne({ transactionId: bought.body.transaction.transactionId });
  assert.equal(stored.costKobo, 41000);

  const admin = await signup("owner@example.com");
  await User.updateOne({ email: "owner@example.com" }, { $set: { role: "admin" } });
  const o = await admin.get("/api/admin/overview?days=7");
  assert.equal(o.status, 200);
  assert.equal(o.body.totals.sales, 450);
  assert.equal(o.body.totals.cost, 410);
  assert.equal(o.body.totals.profit, 40);
  assert.equal(o.body.series.length, 7);
});

test("admin can resolve an order that needs review", { skip }, async () => {
  const u = await User.findOne({ email: "customer@example.com" });
  const tx = await Transaction.create({
    user: u._id, transactionId: "ESCP-20261024-REVIEW", type: "airtime", network: "MTN", plan: "Airtime ₦500", phone: "+2348012345678",
    amount: 500, status: "failed", paymentStatus: "successful", providerStatus: "failed", mode: "test", paymentProvider: "paystack", needsReview: true,
  });
  const admin = createClient(srv.baseUrl);
  await admin.post("/api/auth/login", { email: "owner@example.com", password: "password123" });
  const o = await admin.get("/api/admin/overview");
  assert.ok(o.body.needsReview.some((t) => t.transactionId === "ESCP-20261024-REVIEW"));
  const r = await admin.post(`/api/admin/transactions/${tx._id}/resolve`, { action: "refunded", note: "Refunded on Paystack" });
  assert.equal(r.status, 200);
  const after = await Transaction.findById(tx._id);
  assert.equal(after.needsReview, false);
  assert.equal(after.adminResolution.action, "refunded");
});

test("card fees on free wallet top-ups count against profit", { skip }, async () => {
  const u = await User.findOne({ email: "customer@example.com" });
  const admin = createClient(srv.baseUrl);
  await admin.post("/api/auth/login", { email: "owner@example.com", password: "password123" });
  const before = (await admin.get("/api/admin/overview?days=7")).body.totals;
  const base = { user: u._id, kind: "funding", direction: "credit", status: "successful", mode: "test", paymentProvider: "paystack" };
  // Free top-up: we pay 1.5% of 1,000 = 15.
  await WalletEntry.create({ ...base, reference: "WF-FREE-1", amountKobo: 100000, chargedKobo: 100000, feeKobo: 0 });
  // Customer paid the fee: nothing absorbed.
  await WalletEntry.create({ ...base, reference: "WF-PAID-1", amountKobo: 100000, chargedKobo: 101600, feeKobo: 1600 });
  const after = (await admin.get("/api/admin/overview?days=7")).body.totals;
  assert.equal(Math.round((after.fees - before.fees) * 100), 1500);
  assert.equal(Math.round((before.profit - after.profit) * 100), 1500);
});

test("owner can buy data/airtime for himself from the supplier balance; not counted as sales", { skip }, async () => {
  const customer = await signup("self-customer@example.com");
  assert.equal((await customer.post("/api/admin/self-order", { type: "airtime", network: "MTN", amount: 100, phone: "08031234567", clientReference: "self-cust-0001" })).status, 403);

  await signup("self-owner@example.com");
  await User.updateOne({ email: "self-owner@example.com" }, { $set: { role: "admin" } });
  const admin = createClient(srv.baseUrl);
  assert.equal((await admin.post("/api/auth/login", { email: "self-owner@example.com", password: "password123" })).status, 200);

  const plan = await Plan.create({ network: "Glo", name: "2 GB - Monthly", price: 900, costPrice: 820, validity: "30 days", provider: "clubkonnect", providerPlanId: "2000" });
  const info = await admin.get("/api/admin/self-order");
  assert.equal(info.status, 200);
  assert.equal(info.body.phone, "08012345678");
  const listed = info.body.plans.find((p) => p.id === String(plan._id));
  assert.equal(listed.cost, 820);

  const salesBefore = (await admin.get("/api/admin/overview?days=7")).body.totals.sales;

  const data = await admin.post("/api/admin/self-order", { type: "data", planId: String(plan._id), phone: "08051234567", clientReference: "self-data-0001" });
  assert.equal(data.status, 201, JSON.stringify(data.body));
  assert.equal(data.body.order.status, "successful");
  assert.equal(data.body.order.cost, 820);

  // A double tap with the same key never sends twice.
  const again = await admin.post("/api/admin/self-order", { type: "data", planId: String(plan._id), phone: "08051234567", clientReference: "self-data-0001" });
  assert.equal(again.body.reused, true);
  assert.equal(await Transaction.countDocuments({ paymentProvider: "owner" }), 1);

  const air = await admin.post("/api/admin/self-order", { type: "airtime", network: "Airtel", amount: 200, phone: "08021234567", clientReference: "self-air-0001" });
  assert.equal(air.status, 201);
  assert.equal(air.body.order.status, "successful");

  for (const bad of [
    { type: "airtime", network: "MTN", amount: 20001, phone: "08031234567", clientReference: "self-bad-0001" },
    { type: "airtime", network: "Nope", amount: 100, phone: "08031234567", clientReference: "self-bad-0002" },
    { type: "data", planId: "nope", phone: "08031234567", clientReference: "self-bad-0003" },
    { type: "airtime", network: "MTN", amount: 100, phone: "123", clientReference: "self-bad-0004" },
  ]) {
    assert.equal((await admin.post("/api/admin/self-order", bad)).status, 400, JSON.stringify(bad));
  }

  assert.equal((await admin.get("/api/admin/overview?days=7")).body.totals.sales, salesBefore, "self-orders are not sales");
  assert.equal((await admin.get("/api/admin/self-order")).body.recent.length, 2);
});
