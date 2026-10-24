// Integration: email verification codes + password reset email, with a fake
// email provider (no real emails), against a real MongoDB (MONGO_URI_TEST).
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
process.env.RESEND_API_KEY = "re_test_fake";
process.env.EMAIL_FROM = "EscriptPay <no-reply@example.com>";
process.env.APP_URL = "https://pay.example.com";

const mongoose = require("mongoose");
const app = require("../../src/server");
const connectDB = require("../../src/config/db");
const User = require("../../src/models/User");
const Plan = require("../../src/models/Plan");
const email = require("../../src/services/email");
const { startServer, createClient } = require("../helpers/server");

let srv;
const outbox = [];
email.__setFetch(async (url, init) => {
  outbox.push(JSON.parse(init.body));
  return { ok: true, status: 200, json: async () => ({ id: `msg_${outbox.length}` }) };
});
const lastCode = () => outbox[outbox.length - 1].text.match(/\b(\d{6})\b/)[1];

test.before(async () => {
  if (skip) return;
  await connectTestDb(connectDB);
  await mongoose.connection.dropDatabase();
  await User.syncIndexes();
  srv = await startServer(app);
});

test.after(async () => {
  if (skip) return;
  await cleanupTestDb(mongoose, srv);
});

test("signup sends a code; purchases are blocked until it is verified", { skip }, async () => {
  const c = createClient(srv.baseUrl);
  const res = await c.post("/api/auth/signup", { name: "Verify Me", email: "verify@example.com", phone: "08012345678", password: "password123" });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.needsEmailVerification, true);
  assert.equal(outbox.length, 1);
  assert.deepEqual(outbox[0].to, ["verify@example.com"]);
  const code = lastCode();

  const plan = await Plan.create({ network: "MTN", name: "1GB", price: 500, validity: "30 days" });
  const blocked = await c.post("/api/transactions/data", { planId: String(plan._id), phone: "08012345678" });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, "email_unverified");
  assert.equal((await c.post("/api/wallet/fund", { amount: 1000 })).status, 403);

  // Cooldown: an immediate resend is refused.
  assert.equal((await c.post("/api/auth/verify-email/send", {})).status, 429);

  const wrong = await c.post("/api/auth/verify-email", { code: code === "000000" ? "111111" : "000000" });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.code, "wrong");

  const ok = await c.post("/api/auth/verify-email", { code });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.emailVerified, true);
  assert.equal(ok.body.user.needsEmailVerification, false);

  const allowed = await c.post("/api/transactions/data", { planId: String(plan._id), phone: "08012345678" });
  assert.equal(allowed.status, 201);
});

test("five wrong codes lock that code", { skip }, async () => {
  const c = createClient(srv.baseUrl);
  await c.post("/api/auth/signup", { name: "Brute Force", email: "brute@example.com", phone: "08012345678", password: "password123" });
  const code = lastCode();
  const bad = code === "123456" ? "654321" : "123456";
  for (let i = 0; i < 5; i += 1) await c.post("/api/auth/verify-email", { code: bad });
  const locked = await c.post("/api/auth/verify-email", { code });
  assert.equal(locked.status, 400);
  assert.equal(locked.body.code, "too_many");
});

test("codes are stored hashed and never returned by the API", { skip }, async () => {
  const u = await User.findOne({ email: "brute@example.com" }).select("+emailCodeHash");
  assert.ok(u.emailCodeHash && !/^\d{6}$/.test(u.emailCodeHash));
  const c = createClient(srv.baseUrl);
  await c.post("/api/auth/login", { email: "brute@example.com", password: "password123" });
  const me = await c.get("/api/auth/me");
  assert.equal(me.body.user.emailCodeHash, undefined);
});

test("forgot password emails a reset link on APP_URL", { skip }, async () => {
  const before = outbox.length;
  const c = createClient(srv.baseUrl);
  const res = await c.post("/api/auth/forgot-password", { email: "verify@example.com" });
  assert.equal(res.status, 200);
  assert.equal(outbox.length, before + 1);
  assert.match(outbox[outbox.length - 1].text, /https:\/\/pay\.example\.com\/reset-password\?token=[a-f0-9]{64}/);
  // Unknown email: same answer, nothing sent.
  await c.post("/api/auth/forgot-password", { email: "nobody@example.com" });
  assert.equal(outbox.length, before + 1);
});
