// Integration: cable / electricity / exam orders in test mode.
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
const Transaction = require("../../src/models/Transaction");
const { startServer, createClient } = require("../helpers/server");

let srv;
let c;

test.before(async () => {
  if (skip) return;
  await connectTestDb(connectDB);
  await mongoose.connection.dropDatabase();
  srv = await startServer(app);
  c = createClient(srv.baseUrl);
  const r = await c.post("/api/auth/signup", { name: "Bill Payer", email: "bills@example.com", phone: "08012345678", password: "password123" });
  assert.equal(r.status, 201);
});

test.after(async () => {
  if (skip) return;
  await cleanupTestDb(mongoose, srv);
});

test("catalog lists cable packages with our price, discos and WAEC; JAMB empty", { skip }, async () => {
  const r = await c.get("/api/bills/catalog");
  assert.equal(r.status, 200);
  const dstv = r.body.catalog.cable.find((g) => g.id === "dstv");
  const padi = dstv.packages.find((p) => p.code === "dstv-padi");
  assert.equal(padi.price, 4378);
  assert.equal(padi.networkPrice, 4400);
  assert.equal(padi.cost, undefined, "costs are never public");
  assert.equal(r.body.catalog.electricity.companies.length, 12);
  assert.equal(r.body.catalog.exam.find((e) => e.id === "waec").packages[0].price, 5450);
  assert.equal(r.body.catalog.exam.find((e) => e.id === "jamb").packages.length, 0);
});

test("verify returns the customer name; unknown numbers are refused", { skip }, async () => {
  const ok = await c.post("/api/bills/verify", { service: "cable", provider: "dstv", account: "7023456789" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.name, "TEST CUSTOMER");
  const bad = await c.post("/api/bills/verify", { service: "electricity", provider: "07", meterType: "01", account: "0000123456" });
  assert.equal(bad.status, 404);
});

test("cable order: verified, priced by the server, delivered", { skip }, async () => {
  const r = await c.post("/api/transactions/bill", { service: "cable", provider: "dstv", packageCode: "dstv-padi", account: "7023456789", phone: "08012345678", payWith: "card", clientReference: "cable-ref-000001" });
  assert.equal(r.status, 201);
  assert.equal(r.body.transaction.type, "cable");
  assert.equal(r.body.transaction.amount, 4378);
  assert.equal(r.body.transaction.customerName, "TEST CUSTOMER");
  assert.equal(r.body.transaction.status, "successful");
  const stored = await Transaction.findOne({ transactionId: r.body.transaction.transactionId });
  assert.equal(stored.costKobo, 435600);
});

test("electricity order returns the token; invalid meter charges nothing", { skip }, async () => {
  const r = await c.post("/api/transactions/bill", { service: "electricity", provider: "07", meterType: "01", amount: 2000, account: "45031234567", phone: "08012345678", payWith: "card", clientReference: "elec-ref-0000001" });
  assert.equal(r.status, 201);
  assert.equal(r.body.transaction.token, "1234-5678-9012-3456-7890");
  assert.equal(r.body.transaction.network, "IBEDC");
  const before = await Transaction.countDocuments();
  const bad = await c.post("/api/transactions/bill", { service: "electricity", provider: "07", meterType: "01", amount: 2000, account: "0000999999", phone: "08012345678", payWith: "card" });
  assert.equal(bad.status, 400);
  assert.equal(await Transaction.countDocuments(), before, "no order was created");
});

test("WAEC order returns the PIN; JAMB is unavailable while the supplier list is empty", { skip }, async () => {
  const r = await c.post("/api/transactions/bill", { service: "exam", provider: "waec", phone: "08012345678", payWith: "card", clientReference: "waec-ref-0000001" });
  assert.equal(r.status, 201);
  assert.equal(r.body.transaction.amount, 5450);
  assert.deepEqual(r.body.transaction.pins, [{ serial: "WRN000000001", pin: "123456789012" }]);
  const jamb = await c.post("/api/transactions/bill", { service: "exam", provider: "jamb", account: "1234567890", phone: "08012345678", payWith: "card" });
  assert.equal(jamb.status, 400);
  assert.equal(jamb.body.code, "unavailable");
});
