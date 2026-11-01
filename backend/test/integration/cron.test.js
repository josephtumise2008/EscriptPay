// Integration: scheduled sweep endpoint (auth) and owner alert emails.
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
process.env.CRON_SECRET = "cron-test-secret";
process.env.ALERT_EMAIL = "owner@example.com";
process.env.RESEND_API_KEY = "re_test_key";
process.env.EMAIL_FROM = "EscriptPay <no-reply@example.com>";

const mongoose = require("mongoose");
const app = require("../../src/server");
const connectDB = require("../../src/config/db");
const Transaction = require("../../src/models/Transaction");
const User = require("../../src/models/User");
const email = require("../../src/services/email");
const { startServer } = require("../helpers/server");

let srv;
const sent = [];

test.before(async () => {
  if (skip) return;
  await connectTestDb(connectDB);
  await mongoose.connection.dropDatabase();
  srv = await startServer(app);
  email.__setFetch(async (url, opts) => {
    sent.push(JSON.parse(opts.body));
    return { ok: true, status: 200, json: async () => ({ id: "em_1" }) };
  });
});

test.after(async () => {
  if (skip) return;
  email.__setFetch(null);
  await cleanupTestDb(mongoose, srv);
});

const call = (auth) => fetch(`${srv.baseUrl}/api/cron/sweep`, { headers: auth ? { Authorization: auth } : {} });

test("sweep refuses requests without the right secret", { skip }, async () => {
  assert.equal((await call()).status, 401);
  assert.equal((await call("Bearer wrong")).status, 401);
  assert.equal((await call("Bearer cron-test-secret")).status, 200);
});

test("orders needing review are emailed to the owner once", { skip }, async () => {
  const user = await User.create({ name: "A B", email: "a@example.com", phone: "08012345678", password: "password123" });
  await Transaction.create({
    user: user._id,
    transactionId: "ESCP-20261101-ALERT1",
    type: "airtime",
    network: "MTN",
    plan: "Airtime",
    phone: "08012345678",
    amount: 500,
    status: "failed",
    paymentStatus: "failed",
    providerStatus: "pending",
    paymentProvider: "paystack",
    mode: "test",
    needsReview: true,
    failureReason: "foreign_card",
    cardCountry: "PR",
    refundStatus: "requested",
  });
  sent.length = 0;
  const r = await (await call("Bearer cron-test-secret")).json();
  assert.equal(r.reviewAlerts, 1);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ["owner@example.com"]);
  assert.match(sent[0].text, /ESCP-20261101-ALERT1/);
  assert.match(sent[0].text, /card from PR/);

  const again = await (await call("Bearer cron-test-secret")).json();
  assert.equal(again.reviewAlerts, 0);
  assert.equal(sent.length, 1);
});

test("plan list is cacheable by the CDN", { skip }, async () => {
  const r = await fetch(`${srv.baseUrl}/api/plans`);
  assert.match(r.headers.get("cache-control") || "", /s-maxage=120/);
});
