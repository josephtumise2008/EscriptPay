// Integration: invite codes, signup with a code, and the ₦100 reward after the
// friend's first ₦500+ top-up — against a real MongoDB (MONGO_URI_TEST).
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
delete process.env.REFERRAL_REWARD_NAIRA;
delete process.env.REFERRAL_MIN_TOPUP_NAIRA;

const mongoose = require("mongoose");
const app = require("../../src/server");
const connectDB = require("../../src/config/db");
const WalletEntry = require("../../src/models/WalletEntry");
const User = require("../../src/models/User");
const { startServer, createClient } = require("../helpers/server");

let srv;
let phoneN = 0;

const signup = async (email, extra = {}) => {
  const c = createClient(srv.baseUrl);
  const phone = extra.phone || `0803${String(1000000 + ++phoneN).slice(-7)}`;
  const res = await c.post("/api/auth/signup", { name: extra.name || "Ref Friend", email, phone, password: "password123", ...extra, phone });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return c;
};

const balance = async (c) => (await c.get("/api/wallet")).body.wallet.balance;

test.before(async () => {
  if (skip) return;
  await connectTestDb(connectDB);
  await mongoose.connection.dropDatabase();
  await Promise.all([WalletEntry.syncIndexes(), User.syncIndexes()]);
  srv = await startServer(app);
});

test.after(async () => {
  if (skip) return;
  await cleanupTestDb(mongoose, srv);
});

test("invites need login; every user gets a code and a share link", { skip }, async () => {
  assert.equal((await createClient(srv.baseUrl).get("/api/referrals")).status, 401);
  const a = await signup("inviter-code@example.com");
  const r = await a.get("/api/referrals");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.referrals.code, /^[A-Z0-9]{6}$/);
  assert.ok(r.body.referrals.link.endsWith(`/signup?ref=${r.body.referrals.code}`));
  assert.equal(r.body.referrals.reward, 100);
  assert.equal(r.body.referrals.minTopup, 500);
  assert.equal(r.body.referrals.invited, 0);
  // The same code every time.
  assert.equal((await a.get("/api/referrals")).body.referrals.code, r.body.referrals.code);
});

test("inviter gets ₦100 once, only after the friend tops up ₦500 or more", { skip }, async () => {
  const a = await signup("inviter@example.com");
  const code = (await a.get("/api/referrals")).body.referrals.code;

  const f = await signup("friend@example.com", { name: "Tunde Okafor", referralCode: code.toLowerCase() });
  let r = (await a.get("/api/referrals")).body.referrals;
  assert.equal(r.invited, 1);
  assert.deepEqual(r.friends.map((x) => [x.name, x.status]), [["Tunde O.", "waiting"]]);

  // Below ₦500: no reward yet.
  await f.post("/api/wallet/fund", { amount: 300 });
  assert.equal(await balance(a), 0);

  await f.post("/api/wallet/fund", { amount: 500 });
  assert.equal(await balance(a), 100);
  assert.equal(await balance(f), 800, "the friend keeps their whole top-up");

  // More top-ups never pay again.
  await f.post("/api/wallet/fund", { amount: 2000 });
  assert.equal(await balance(a), 100);

  r = (await a.get("/api/referrals")).body.referrals;
  assert.equal(r.rewarded, 1);
  assert.equal(r.earned, 100);
  assert.equal(r.friends[0].status, "rewarded");

  const history = (await a.get("/api/wallet")).body.entries;
  assert.equal(history[0].kind, "referral");
  assert.equal(history[0].direction, "credit");
  assert.equal(history[0].amount, 100);
  assert.equal(history[0].description, "Referral reward · Tunde O.");

  // The reward is spendable like any wallet money.
  const spent = await a.post("/api/transactions/airtime", { network: "MTN", amount: 100, phone: "08031234567", payWith: "wallet" });
  assert.equal(spent.status, 201, JSON.stringify(spent.body));
  assert.equal(await balance(a), 0);
});

test("unknown codes and your own phone number don't count, and never block signup", { skip }, async () => {
  const a = await signup("inviter-self@example.com", { phone: "08099990000" });
  const code = (await a.get("/api/referrals")).body.referrals.code;

  const bogus = await signup("bogus-code@example.com", { referralCode: "ZZZZZZ" });
  await bogus.post("/api/wallet/fund", { amount: 1000 });

  const self = await signup("self-invite@example.com", { phone: "08099990000", referralCode: code });
  await self.post("/api/wallet/fund", { amount: 1000 });

  assert.equal(await balance(a), 0);
  assert.equal((await a.get("/api/referrals")).body.referrals.invited, 0);
  const u = await User.findOne({ email: "self-invite@example.com" }).lean();
  assert.equal(u.referredBy, undefined);
});

// Saved and recent numbers live alongside the account; quick test here
// keeps the integration suite small.
test("saved numbers: add, rename, list with recent ones, remove", { skip }, async () => {
  const anon = createClient(srv.baseUrl);
  assert.equal((await anon.get("/api/numbers")).status, 401);

  const c = await signup("numbers@example.com");
  assert.equal((await c.post("/api/numbers", { phone: "12345" })).status, 400);

  let r = await c.post("/api/numbers", { phone: "+2348031112222", label: "Mum <3", network: "MTN" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.saved, [{ phone: "08031112222", label: "Mum 3", network: "MTN" }]);

  // Same number again renames instead of duplicating.
  r = await c.post("/api/numbers", { phone: "0803 111 2222", label: "Mummy" });
  assert.deepEqual(r.body.saved.map((n) => [n.phone, n.label]), [["08031112222", "Mummy"]]);

  // A number used for a purchase shows up as recent (saved ones don't repeat there).
  await c.post("/api/wallet/fund", { amount: 1000 });
  await c.post("/api/transactions/airtime", { network: "Glo", amount: 100, phone: "08051234567", payWith: "wallet" });
  await c.post("/api/transactions/airtime", { network: "MTN", amount: 100, phone: "08031112222", payWith: "wallet" });
  const list = (await c.get("/api/numbers")).body;
  assert.deepEqual(list.recent.map((n) => [n.phone, n.network]), [["08051234567", "Glo"]]);
  assert.equal(list.saved.length, 1);

  // Another user never sees these.
  const other = await signup("numbers-other@example.com");
  const theirs = (await other.get("/api/numbers")).body;
  assert.deepEqual(theirs, { success: true, saved: [], recent: [] });

  assert.equal((await anon.del("/api/numbers/08031112222")).status, 401);
  const del = await c.del("/api/numbers/08031112222");
  assert.equal(del.status, 200);
  assert.deepEqual(del.body.saved, []);
  // Now that it isn't saved, it appears under recent.
  assert.deepEqual((await c.get("/api/numbers")).body.recent.map((n) => n.phone), ["08031112222", "08051234567"]);
});
