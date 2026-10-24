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
