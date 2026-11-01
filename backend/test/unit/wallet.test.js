const test = require("node:test");
const assert = require("node:assert/strict");
const { createWalletService } = require("../../src/services/walletService");
const { createFakeModel } = require("../helpers/fakeModel");

let refCounter = 0;

const setup = ({ provider = "test", balance = 0, verification, walletFee, allowedCardCountries } = {}) => {
  const User = createFakeModel({ docs: [{ _id: "u1", walletBalances: { test: balance, live: 0 } }] });
  const WalletEntry = createFakeModel({ unique: ["reference", "paymentReference", "clientReference"] });
  const Transaction = createFakeModel();
  const calls = { verify: 0, init: 0, refund: 0 };
  const payment =
    provider === "paystack"
      ? {
          requiresCheckout: true,
          initializePayment: async ({ reference }) => {
            calls.init += 1;
            return { checkoutUrl: `https://checkout.paystack.com/${reference}` };
          },
          verifyPayment: async (reference) => {
            calls.verify += 1;
            await new Promise((r) => setImmediate(r));
            const entry = WalletEntry.docs.find((d) => d.paymentReference === reference);
            return {
              status: "success",
              currency: "NGN",
              reference,
              amountKobo: entry && (entry.chargedKobo || entry.amountKobo),
              paidAt: new Date().toISOString(),
              ...verification,
            };
          },
          refundPayment: async () => {
            calls.refund += 1;
            return { status: "pending" };
          },
        }
      : { requiresCheckout: false, processPayment: async () => ({ paymentStatus: "not_required" }) };
  const config = {
    paymentProvider: provider,
    paymentMode: "test",
    currency: "NGN",
    paymentExpiryMinutes: 60,
    appUrl: "http://localhost:3000",
    walletFee,
    allowedCardCountries,
  };
  const wallet = createWalletService({
    User,
    WalletEntry,
    Transaction,
    payment,
    config,
    generateReference: () => `ESCW-20261023-${String(++refCounter).padStart(6, "0")}`,
  });
  const balanceOf = () => User.docs[0].walletBalances.test;
  return { wallet, User, WalletEntry, Transaction, calls, balanceOf };
};

test("test mode: funding credits the balance immediately, in kobo", async () => {
  const { wallet, balanceOf, WalletEntry } = setup();
  const result = await wallet.startFunding({ userId: "u1", email: "a@b.c", amountNaira: 1500 });
  assert.equal(result.balanceKobo, 150000);
  assert.equal(balanceOf(), 150000);
  assert.equal(WalletEntry.docs[0].status, "successful");
  assert.equal(WalletEntry.docs[0].balanceAfterKobo, 150000);
});

test("funding with the same clientReference is only applied once", async () => {
  const { wallet, balanceOf } = setup();
  const args = { userId: "u1", email: "a@b.c", amountNaira: 1000, clientReference: "fund-abc-12345" };
  await Promise.all([wallet.startFunding(args), wallet.startFunding(args), wallet.startFunding(args)]);
  assert.equal(balanceOf(), 100000);
});

test("paystack: nothing is credited until the payment is verified", async () => {
  const { wallet, balanceOf, calls } = setup({ provider: "paystack" });
  const started = await wallet.startFunding({ userId: "u1", email: "a@b.c", amountNaira: 2000 });
  assert.match(started.checkoutUrl, /^https:\/\/checkout\.paystack\.com\//);
  assert.equal(balanceOf(), 0);
  assert.equal(calls.init, 1);

  const ref = started.entry.paymentReference;
  const result = await wallet.confirmFunding(ref, { source: "callback" });
  assert.equal(result.outcome, "credited");
  assert.equal(balanceOf(), 200000);
});

test("paystack: callback + duplicate webhooks racing credit exactly once", async () => {
  const { wallet, balanceOf } = setup({ provider: "paystack" });
  const started = await wallet.startFunding({ userId: "u1", email: "a@b.c", amountNaira: 5000 });
  const ref = started.entry.paymentReference;
  const outcomes = await Promise.all([
    wallet.confirmFunding(ref, { source: "callback" }),
    wallet.confirmFunding(ref, { source: "webhook" }),
    wallet.confirmFunding(ref, { source: "webhook" }),
  ]);
  assert.equal(outcomes.filter((o) => o.outcome === "credited").length, 1);
  assert.equal(balanceOf(), 500000);
  // Later retries are harmless.
  assert.equal((await wallet.confirmFunding(ref, { source: "webhook" })).outcome, "already_credited");
  assert.equal(balanceOf(), 500000);
});

test("paystack: an amount mismatch is never credited and is flagged for review", async () => {
  const { wallet, balanceOf, WalletEntry } = setup({ provider: "paystack", verification: { amountKobo: 100 } });
  const started = await wallet.startFunding({ userId: "u1", email: "a@b.c", amountNaira: 5000 });
  const result = await wallet.confirmFunding(started.entry.paymentReference, { source: "webhook" });
  assert.equal(result.outcome, "mismatch");
  assert.equal(balanceOf(), 0);
  assert.equal(WalletEntry.docs[0].needsReview, true);
});

test("paystack: a failed payment credits nothing", async () => {
  const { wallet, balanceOf } = setup({ provider: "paystack", verification: { status: "failed" } });
  const started = await wallet.startFunding({ userId: "u1", email: "a@b.c", amountNaira: 5000 });
  const result = await wallet.confirmFunding(started.entry.paymentReference, { source: "callback" });
  assert.equal(result.outcome, "failed");
  assert.equal(balanceOf(), 0);
});

test("unknown reference is reported as not_found", async () => {
  const { wallet } = setup({ provider: "paystack" });
  assert.equal((await wallet.confirmFunding("ESCW-NOPE", { source: "webhook" })).outcome, "not_found");
});

test("debits never take the balance below zero, even when racing", async () => {
  const { wallet, balanceOf } = setup({ balance: 100000 }); // ₦1,000
  const results = await Promise.all([
    wallet.debitForOrder("u1", 60000),
    wallet.debitForOrder("u1", 60000),
    wallet.debitForOrder("u1", 60000),
  ]);
  assert.equal(results.filter((r) => r !== null).length, 1);
  assert.equal(balanceOf(), 40000);
  assert.equal(await wallet.debitForOrder("u1", 50000), null);
});

test("refund for a failed wallet order is applied once", async () => {
  const { wallet, balanceOf, Transaction } = setup({ balance: 0 });
  const tx = await Transaction.create({
    user: "u1",
    transactionId: "ESCP-20261023-AAAAAA",
    paymentProvider: "wallet",
    providerStatus: "failed",
    paymentAmountKobo: 55000,
    mode: "test",
    needsReview: true,
  });
  const results = await Promise.all([wallet.refundOrder(tx), wallet.refundOrder(tx)]);
  assert.deepEqual(results.map((r) => r.outcome).sort(), ["already_refunded", "refunded"]);
  assert.equal(balanceOf(), 55000);
  assert.equal(Transaction.docs[0].needsReview, false);
});

test("refund is refused for orders that were not definitively failed or not paid from the wallet", async () => {
  const { wallet, balanceOf } = setup();
  for (const tx of [
    { paymentProvider: "wallet", providerStatus: "unknown", paymentAmountKobo: 100 },
    { paymentProvider: "paystack", providerStatus: "failed", paymentAmountKobo: 100 },
  ]) {
    assert.equal((await wallet.refundOrder({ user: "u1", transactionId: "X", ...tx })).outcome, "not_applicable");
  }
  assert.equal(balanceOf(), 0);
});

const PAYSTACK_FEE = { enabled: true, percent: 1.5, flatKobo: 10000, flatThresholdKobo: 250000, capKobo: 200000 };

test("paystack top-up: customer pays the card fee on top, wallet gets the exact amount", async () => {
  const { wallet, balanceOf, WalletEntry } = setup({ provider: "paystack", walletFee: PAYSTACK_FEE });
  const started = await wallet.startFunding({ userId: "u1", email: "a@b.c", amountNaira: 5000 });
  const entry = WalletEntry.docs[0];
  assert.equal(entry.amountKobo, 500000);
  assert.equal(entry.chargedKobo, 517800);
  assert.equal(entry.feeKobo, 17800);
  await wallet.confirmFunding(started.entry.paymentReference, { source: "webhook" });
  assert.equal(balanceOf(), 500000, "wallet receives the amount, not the fee");
});

test("paystack top-up: paying only the base amount (without fee) is a mismatch", async () => {
  const { wallet, balanceOf } = setup({ provider: "paystack", walletFee: PAYSTACK_FEE, verification: { amountKobo: 500000 } });
  const started = await wallet.startFunding({ userId: "u1", email: "a@b.c", amountNaira: 5000 });
  assert.equal((await wallet.confirmFunding(started.entry.paymentReference, { source: "webhook" })).outcome, "mismatch");
  assert.equal(balanceOf(), 0);
});

test("fee quote never leaves the wallet short after the provider's cut", () => {
  const { quoteFunding, providerFee } = require("../../src/services/walletFee");
  for (let naira = 100; naira <= 500000; naira += 97) {
    const q = quoteFunding(naira * 100, PAYSTACK_FEE);
    assert.ok(q.chargeKobo - providerFee(q.chargeKobo, PAYSTACK_FEE) >= naira * 100, `₦${naira}`);
    assert.ok(q.feeKobo <= 200000 + 100);
  }
});

test("test mode: no fee", async () => {
  const { wallet } = setup();
  assert.deepEqual(wallet.quote(5000), { amountKobo: 500000, feeKobo: 0, chargeKobo: 500000 });
});

test("paystack: a foreign card top-up is never credited and is refunded once", async () => {
  const { wallet, balanceOf, WalletEntry, calls } = setup({
    provider: "paystack",
    allowedCardCountries: ["NG"],
    verification: { channel: "card", cardCountry: "PR" },
  });
  const started = await wallet.startFunding({ userId: "u1", email: "a@b.c", amountNaira: 5000 });
  const ref = started.entry.paymentReference;
  await Promise.all([wallet.confirmFunding(ref, { source: "webhook" }), wallet.confirmFunding(ref, { source: "callback" })]);
  assert.equal(balanceOf(), 0);
  assert.equal(WalletEntry.docs[0].needsReview, true);
  assert.match(WalletEntry.docs[0].failureReason, /foreign_card/);
  assert.equal(WalletEntry.docs[0].refundStatus, "requested");
  assert.equal(calls.refund, 1);
  assert.equal((await wallet.confirmFunding(ref, { source: "webhook" })).outcome, "needs_review");
  assert.equal(calls.refund, 1);
});

test("paystack: a Nigerian card top-up is credited", async () => {
  const { wallet, balanceOf, calls } = setup({
    provider: "paystack",
    allowedCardCountries: ["NG"],
    verification: { channel: "card", cardCountry: "NG" },
  });
  const started = await wallet.startFunding({ userId: "u1", email: "a@b.c", amountNaira: 5000 });
  await wallet.confirmFunding(started.entry.paymentReference, { source: "webhook" });
  assert.equal(balanceOf(), 500000);
  assert.equal(calls.refund, 0);
});
