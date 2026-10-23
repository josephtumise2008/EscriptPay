const test = require("node:test");
const assert = require("node:assert/strict");
const { createWalletService } = require("../../src/services/walletService");
const { createFakeModel } = require("../helpers/fakeModel");

let refCounter = 0;

const setup = ({ provider = "test", balance = 0, verification } = {}) => {
  const User = createFakeModel({ docs: [{ _id: "u1", walletBalances: { test: balance, live: 0 } }] });
  const WalletEntry = createFakeModel({ unique: ["reference", "paymentReference", "clientReference"] });
  const Transaction = createFakeModel();
  const calls = { verify: 0, init: 0 };
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
              amountKobo: entry && entry.amountKobo,
              paidAt: new Date().toISOString(),
              ...verification,
            };
          },
        }
      : { requiresCheckout: false, processPayment: async () => ({ paymentStatus: "not_required" }) };
  const config = {
    paymentProvider: provider,
    paymentMode: "test",
    currency: "NGN",
    paymentExpiryMinutes: 60,
    appUrl: "http://localhost:3000",
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
