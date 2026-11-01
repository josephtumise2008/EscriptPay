const test = require("node:test");
const assert = require("node:assert/strict");
const { createOrderLifecycle } = require("../../src/services/orderLifecycle");
const { createFakeTransactionModel } = require("../helpers/fakeTransactionModel");

const paystackConfig = { paymentProvider: "paystack", currency: "NGN", paymentExpiryMinutes: 60 };

const baseTx = (over = {}) => ({
  _id: "tx1",
  transactionId: "ESCP-20261022-AAAAAA",
  type: "airtime",
  network: "MTN",
  phone: "+2348012345678",
  amount: 500,
  status: "pending",
  paymentStatus: "pending",
  providerStatus: "pending",
  paymentReference: "ESCP-20261022-AAAAAA",
  paymentAmountKobo: 50000,
  needsReview: false,
  fulfillmentAttempts: 0,
  createdAt: new Date(),
  ...over,
});

const paidVerification = (over = {}) => ({
  status: "success",
  amountKobo: 50000,
  currency: "NGN",
  reference: "ESCP-20261022-AAAAAA",
  paidAt: "2026-10-22T10:00:00Z",
  gatewayTransactionId: "99",
  ...over,
});

const setup = ({ tx = baseTx(), verification = paidVerification(), vtuOutcome = "delivered", vtuThrows, config } = {}) => {
  const Transaction = createFakeTransactionModel([tx]);
  const calls = { verify: 0, purchase: 0, refund: 0 };
  const payment = {
    verifyPayment: async () => {
      calls.verify += 1;
      await new Promise((r) => setImmediate(r));
      if (verification instanceof Error) throw verification;
      return verification;
    },
    refundPayment: async () => {
      calls.refund += 1;
      return { status: "pending" };
    },
  };
  const vtu = {
    name: "fake",
    simulated: false,
    purchase: async () => {
      calls.purchase += 1;
      await new Promise((r) => setImmediate(r));
      if (vtuThrows) throw vtuThrows;
      return { outcome: vtuOutcome, reference: "SUP-1" };
    },
  };
  const lifecycle = createOrderLifecycle({
    Transaction,
    Plan: null,
    payment,
    vtu,
    config: config || paystackConfig,
  });
  return { Transaction, lifecycle, calls, doc: () => Transaction.docs[0] };
};

test("verified, exact payment is confirmed and then delivered once", async () => {
  const { lifecycle, calls, doc } = setup();
  const confirmed = await lifecycle.confirmPayment("ESCP-20261022-AAAAAA", { source: "callback" });
  assert.equal(confirmed.outcome, "paid");
  assert.equal(doc().paymentStatus, "successful");

  const result = await lifecycle.fulfillOrder(confirmed.tx);
  assert.equal(result.outcome, "delivered");
  assert.equal(doc().providerStatus, "successful");
  assert.equal(doc().status, "successful");
  assert.equal(doc().providerReference, "SUP-1");
  assert.equal(calls.purchase, 1);
});

test("fulfilment before verified payment is blocked and the supplier is never called", async () => {
  const { lifecycle, calls, doc } = setup();
  const result = await lifecycle.fulfillOrder(doc());
  assert.equal(result.outcome, "blocked");
  assert.equal(calls.purchase, 0);
  assert.equal(doc().providerStatus, "pending");
});

test("not_required payment can only be fulfilled in pure test mode with simulated delivery", async () => {
  const tx = baseTx({ paymentStatus: "not_required", paymentReference: undefined });
  const real = setup({ tx, config: { ...paystackConfig, paymentProvider: "test" } });
  assert.equal((await real.lifecycle.fulfillOrder(real.doc())).outcome, "blocked"); // vtu.simulated=false
  assert.equal(real.calls.purchase, 0);
});

test("amount mismatch: never delivered, flagged for review", async () => {
  const { lifecycle, calls, doc } = setup({ verification: paidVerification({ amountKobo: 100 }) });
  const r = await lifecycle.confirmPayment("ESCP-20261022-AAAAAA", { source: "webhook" });
  assert.equal(r.outcome, "mismatch");
  assert.equal(doc().paymentStatus, "failed");
  assert.equal(doc().needsReview, true);
  assert.match(doc().failureReason, /amount_mismatch/);
  assert.equal((await lifecycle.fulfillOrder(doc())).outcome, "blocked");
  assert.equal(calls.purchase, 0);
});

test("wrong currency and wrong reference are rejected", async () => {
  const cur = setup({ verification: paidVerification({ currency: "USD" }) });
  assert.equal((await cur.lifecycle.confirmPayment("ESCP-20261022-AAAAAA", { source: "webhook" })).outcome, "mismatch");
  assert.match(cur.doc().failureReason, /currency_mismatch/);

  const ref = setup({ verification: paidVerification({ reference: "SOMETHING-ELSE" }) });
  assert.equal((await ref.lifecycle.confirmPayment("ESCP-20261022-AAAAAA", { source: "webhook" })).outcome, "mismatch");
  assert.match(ref.doc().failureReason, /reference_mismatch/);
});

test("failed payment is recorded as failed; abandoned stays pending", async () => {
  const failed = setup({ verification: paidVerification({ status: "failed" }) });
  assert.equal((await failed.lifecycle.confirmPayment("ESCP-20261022-AAAAAA", { source: "callback" })).outcome, "failed");
  assert.equal(failed.doc().paymentStatus, "failed");
  assert.equal(failed.doc().status, "failed");

  const abandoned = setup({ verification: paidVerification({ status: "abandoned" }) });
  assert.equal((await abandoned.lifecycle.confirmPayment("ESCP-20261022-AAAAAA", { source: "callback" })).outcome, "unpaid");
  assert.equal(abandoned.doc().paymentStatus, "pending");
});

test("old unpaid checkout expires, and a later verified success still confirms it", async () => {
  const old = baseTx({ createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) });
  const s = setup({ tx: old, verification: paidVerification({ status: "abandoned" }) });
  assert.equal((await s.lifecycle.confirmPayment(old.paymentReference, { source: "callback" })).outcome, "expired");
  assert.equal(s.doc().paymentStatus, "expired");

  // Customer completes payment late; webhook arrives.
  const late = createOrderLifecycle({
    Transaction: s.Transaction,
    Plan: null,
    payment: { verifyPayment: async () => paidVerification() },
    vtu: { name: "fake", simulated: false, purchase: async () => ({ outcome: "delivered" }) },
    config: paystackConfig,
  });
  assert.equal((await late.confirmPayment(old.paymentReference, { source: "webhook" })).outcome, "paid");
  assert.equal(s.doc().paymentStatus, "successful");
});

test("provider verify errors propagate without changing the order", async () => {
  const err = Object.assign(new Error("down"), { code: "network" });
  const { lifecycle, doc } = setup({ verification: err });
  await assert.rejects(lifecycle.confirmPayment("ESCP-20261022-AAAAAA", { source: "callback" }), { code: "network" });
  assert.equal(doc().paymentStatus, "pending");
});

test("duplicate webhook deliveries: verified once, delivered once", async () => {
  const { lifecycle, calls, doc } = setup();
  for (let i = 0; i < 3; i++) {
    const r = await lifecycle.confirmPayment("ESCP-20261022-AAAAAA", { source: "webhook" });
    if (r.tx.paymentStatus === "successful") await lifecycle.fulfillOrder(r.tx);
  }
  assert.equal(calls.verify, 1, "already-paid orders are not re-verified");
  assert.equal(calls.purchase, 1);
  assert.equal(doc().fulfillmentAttempts, 1);
});

test("concurrent callback + webhooks: exactly one supplier request", async () => {
  const { lifecycle, calls, doc } = setup();
  const run = async (source) => {
    const r = await lifecycle.confirmPayment("ESCP-20261022-AAAAAA", { source });
    if (r.tx && r.tx.paymentStatus === "successful") await lifecycle.fulfillOrder(r.tx);
  };
  await Promise.all([run("callback"), run("webhook"), run("webhook"), run("callback")]);
  assert.equal(calls.purchase, 1);
  assert.equal(doc().fulfillmentAttempts, 1);
  assert.equal(doc().status, "successful");
});

test("supplier timeout: status unknown, flagged, never retried automatically", async () => {
  const timeout = Object.assign(new Error("timed out"), { code: "timeout" });
  const { lifecycle, calls, doc } = setup({ tx: baseTx({ paymentStatus: "successful" }), vtuThrows: timeout });
  const r = await lifecycle.fulfillOrder(doc());
  assert.equal(r.outcome, "unknown");
  assert.equal(doc().providerStatus, "unknown");
  assert.equal(doc().status, "pending");
  assert.equal(doc().needsReview, true);

  const again = await lifecycle.fulfillOrder(doc());
  assert.equal(again.outcome, "blocked");
  assert.equal(calls.purchase, 1);
});

test("supplier acceptance is not reported as delivery", async () => {
  const { lifecycle, doc } = setup({ tx: baseTx({ paymentStatus: "successful" }), vtuOutcome: "accepted" });
  const r = await lifecycle.fulfillOrder(doc());
  assert.equal(r.outcome, "accepted");
  assert.equal(doc().providerStatus, "processing");
  assert.equal(doc().status, "pending");
});

test("supplier failure after payment: failed + flagged for refund", async () => {
  const { lifecycle, doc } = setup({ tx: baseTx({ paymentStatus: "successful" }), vtuOutcome: "failed" });
  await lifecycle.fulfillOrder(doc());
  assert.equal(doc().providerStatus, "failed");
  assert.equal(doc().status, "failed");
  assert.equal(doc().needsReview, true);
  assert.equal(doc().failureReason, "delivery_failed");
});

test("an unrecognized supplier answer is treated as unknown, not success", async () => {
  const { lifecycle, doc } = setup({ tx: baseTx({ paymentStatus: "successful" }), vtuOutcome: "OK" });
  assert.equal((await lifecycle.fulfillOrder(doc())).outcome, "unknown");
  assert.equal(doc().status, "pending");
});

test("unknown reference is reported, nothing is created", async () => {
  const { lifecycle, calls } = setup();
  const r = await lifecycle.confirmPayment("NOT-OURS", { source: "webhook" });
  assert.equal(r.outcome, "not_found");
  assert.equal(calls.verify, 0);
});

const ngOnly = { ...paystackConfig, allowedCardCountries: ["NG"] };

test("foreign card: never delivered, flagged and refunded exactly once", async () => {
  const { lifecycle, calls, doc } = setup({
    config: ngOnly,
    verification: paidVerification({ channel: "card", cardCountry: "PR" }),
  });
  const [a, b] = await Promise.all([
    lifecycle.confirmPayment("ESCP-20261022-AAAAAA", { source: "webhook" }),
    lifecycle.confirmPayment("ESCP-20261022-AAAAAA", { source: "callback" }),
  ]);
  assert.ok([a.outcome, b.outcome].includes("mismatch"));
  assert.equal(doc().paymentStatus, "failed");
  assert.equal(doc().needsReview, true);
  assert.match(doc().failureReason, /foreign_card/);
  assert.equal(doc().cardCountry, "PR");
  assert.equal(doc().refundStatus, "requested");
  assert.equal(calls.refund, 1);
  assert.equal((await lifecycle.fulfillOrder(doc())).outcome, "blocked");
  assert.equal(calls.purchase, 0);
  // Later checks never refund again.
  await lifecycle.confirmPayment("ESCP-20261022-AAAAAA", { source: "webhook" });
  assert.equal(calls.refund, 1);
});

test("Nigerian card, bank transfer and card without a country are accepted", async () => {
  for (const extra of [
    { channel: "card", cardCountry: "NG" },
    { channel: "bank_transfer", cardCountry: null },
    { channel: "card", cardCountry: null },
  ]) {
    const { lifecycle, calls } = setup({ config: ngOnly, verification: paidVerification(extra) });
    assert.equal((await lifecycle.confirmPayment("ESCP-20261022-AAAAAA", { source: "callback" })).outcome, "paid");
    assert.equal(calls.refund, 0);
  }
});

test("a failed automatic refund is recorded for the admin", async () => {
  const cur = setup({ config: ngOnly, verification: paidVerification({ channel: "card", cardCountry: "US" }) });
  const { createOrderLifecycle: create } = require("../../src/services/orderLifecycle");
  const lifecycle = create({
    Transaction: cur.Transaction,
    Plan: null,
    payment: {
      verifyPayment: async () => paidVerification({ channel: "card", cardCountry: "US" }),
      refundPayment: async () => {
        throw new Error("nope");
      },
    },
    vtu: { name: "fake", simulated: false, purchase: async () => ({ outcome: "delivered" }) },
    config: ngOnly,
  });
  assert.equal((await lifecycle.confirmPayment("ESCP-20261022-AAAAAA", { source: "webhook" })).outcome, "mismatch");
  assert.equal(cur.doc().refundStatus, "failed");
});
