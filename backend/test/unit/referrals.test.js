const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeCode, shortName, randomCode, rules } = require("../../src/services/referrals");
const { createWalletService } = require("../../src/services/walletService");
const { createFakeModel } = require("../helpers/fakeModel");

test("invite codes: 6 easy-to-read characters, typed codes are cleaned up", () => {
  for (let i = 0; i < 200; i += 1) assert.match(randomCode(), /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(normalizeCode("  ab3k9q "), "AB3K9Q");
  assert.equal(normalizeCode("abc"), null);
  assert.equal(normalizeCode("AB$123"), null);
  assert.equal(normalizeCode(""), null);
  assert.equal(normalizeCode(undefined), null);
});

test("friends are shown by first name and last initial only", () => {
  assert.equal(shortName("Tunde Okafor"), "Tunde O.");
  assert.equal(shortName("  amaka  "), "amaka");
  assert.equal(shortName("Ada Grace nwosu"), "Ada N.");
  assert.equal(shortName(""), "A friend");
});

test("default rules: ₦100 reward after a ₦500+ top-up", () => {
  const before = { r: process.env.REFERRAL_REWARD_NAIRA, m: process.env.REFERRAL_MIN_TOPUP_NAIRA };
  delete process.env.REFERRAL_REWARD_NAIRA;
  delete process.env.REFERRAL_MIN_TOPUP_NAIRA;
  assert.deepEqual(rules(), { rewardKobo: 10000, minTopupKobo: 50000 });
  process.env.REFERRAL_REWARD_NAIRA = "abc";
  assert.equal(rules().rewardKobo, 10000);
  if (before.r === undefined) delete process.env.REFERRAL_REWARD_NAIRA; else process.env.REFERRAL_REWARD_NAIRA = before.r;
  if (before.m !== undefined) process.env.REFERRAL_MIN_TOPUP_NAIRA = before.m;
});

const walletWith = (onFunded) => {
  const User = createFakeModel({ docs: [{ _id: "u1", walletBalances: { test: 0, live: 0 } }] });
  const WalletEntry = createFakeModel({ unique: ["reference", "paymentReference", "clientReference"] });
  let n = 0;
  const wallet = createWalletService({
    User,
    WalletEntry,
    Transaction: createFakeModel(),
    payment: { requiresCheckout: false, processPayment: async () => ({ paymentStatus: "not_required" }) },
    config: { paymentProvider: "test", paymentMode: "test", currency: "NGN", paymentExpiryMinutes: 60, appUrl: "http://localhost:3000" },
    generateReference: () => `ESCW-20261118-${String(++n).padStart(6, "0")}`,
    onFunded,
  });
  return { wallet, User };
};

test("a credited top-up tells the referral hook who topped up and how much", async () => {
  const seen = [];
  const { wallet } = walletWith(async (f) => seen.push(f));
  await wallet.startFunding({ userId: "u1", email: "a@b.c", amountNaira: 700 });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].userId, "u1");
  assert.equal(seen[0].amountKobo, 70000);
  assert.equal(seen[0].mode, "test");
});

test("a failing referral reward never breaks the friend's top-up", async () => {
  const { wallet, User } = walletWith(async () => {
    throw new Error("boom");
  });
  const result = await wallet.startFunding({ userId: "u1", email: "a@b.c", amountNaira: 900 });
  assert.equal(result.balanceKobo, 90000);
  assert.equal(User.docs[0].walletBalances.test, 90000);
});
