const test = require("node:test");
const assert = require("node:assert/strict");
const { createOrderLifecycle } = require("../../src/services/orderLifecycle");
const { createFakeModel } = require("../helpers/fakeModel");

const old = () => new Date(Date.now() - 60 * 1000);

const setup = ({ tx, query }) => {
  const Transaction = createFakeModel({ docs: [{ _id: "t1", transactionId: "ESCP-1", fulfillmentStartedAt: old(), ...tx }] });
  const calls = { query: 0 };
  const vtu = {
    name: "fake",
    simulated: false,
    queryStatus: async () => {
      calls.query += 1;
      await new Promise((r) => setImmediate(r));
      if (query instanceof Error) throw query;
      return query;
    },
  };
  const lifecycle = createOrderLifecycle({
    Transaction,
    Plan: null,
    payment: {},
    vtu,
    config: { paymentProvider: "paystack", currency: "NGN", statusCheckIntervalMs: 20000 },
  });
  return { lifecycle, Transaction, calls, doc: () => Transaction.docs[0] };
};

test("processing order confirmed delivered by the supplier", async () => {
  const { lifecycle, doc } = setup({
    tx: { providerStatus: "processing", status: "pending", paymentStatus: "successful", providerReference: "789" },
    query: { outcome: "delivered", statusCode: 200, reference: "789" },
  });
  const r = await lifecycle.reconcileOrder("t1");
  assert.equal(r.outcome, "delivered");
  assert.equal(doc().status, "successful");
  assert.equal(doc().providerStatusCode, "200");
});

test("an ambiguous (timed-out) order that the supplier delivered is cleared from review", async () => {
  const { lifecycle, doc } = setup({
    tx: { providerStatus: "unknown", status: "pending", paymentStatus: "successful", needsReview: true, failureReason: "delivery_unconfirmed" },
    query: { outcome: "delivered", statusCode: 200, reference: "790" },
  });
  await lifecycle.reconcileOrder("t1");
  assert.equal(doc().providerStatus, "successful");
  assert.equal(doc().needsReview, false);
  assert.equal(doc().failureReason, undefined);
  assert.equal(doc().providerReference, "790");
});

test("failed card-paid order is flagged for a refund; wallet-paid is left for the automatic refund", async () => {
  const card = setup({
    tx: { providerStatus: "processing", status: "pending", paymentStatus: "successful", paymentProvider: "paystack", providerReference: "1" },
    query: { outcome: "failed", statusCode: 516 },
  });
  await card.lifecycle.reconcileOrder("t1");
  assert.equal(card.doc().status, "failed");
  assert.equal(card.doc().needsReview, true);

  const wallet = setup({
    tx: { providerStatus: "processing", status: "pending", paymentStatus: "successful", paymentProvider: "wallet", providerReference: "1" },
    query: { outcome: "failed", statusCode: 509 },
  });
  await wallet.lifecycle.reconcileOrder("t1");
  assert.equal(wallet.doc().providerStatus, "failed");
  assert.equal(wallet.doc().needsReview, false);
});

test("still processing / unknown answers change nothing", async () => {
  for (const query of [{ outcome: "accepted", statusCode: 300 }, { outcome: "unknown" }, new Error("timeout")]) {
    const { lifecycle, doc } = setup({
      tx: { providerStatus: "processing", status: "pending", paymentStatus: "successful", providerReference: "1" },
      query,
    });
    const r = await lifecycle.reconcileOrder("t1");
    assert.equal(r.outcome, "pending");
    assert.equal(doc().providerStatus, "processing");
    assert.equal(doc().status, "pending");
  }
});

test("checks are throttled and parallel pollers query the supplier once", async () => {
  const { lifecycle, calls } = setup({
    tx: { providerStatus: "processing", status: "pending", paymentStatus: "successful", providerReference: "1" },
    query: { outcome: "accepted", statusCode: 300 },
  });
  await Promise.all([lifecycle.reconcileOrder("t1"), lifecycle.reconcileOrder("t1"), lifecycle.reconcileOrder("t1")]);
  assert.equal(calls.query, 1);
  await lifecycle.reconcileOrder("t1");
  assert.equal(calls.query, 1, "second check within the interval is skipped");
});

test("finished orders and orders still awaiting their first supplier reply are not queried", async () => {
  for (const tx of [
    { providerStatus: "successful", status: "successful" },
    { providerStatus: "failed", status: "failed" },
    { providerStatus: "processing", status: "pending", fulfillmentStartedAt: new Date() },
  ]) {
    const { lifecycle, calls } = setup({ tx: { paymentStatus: "successful", ...tx }, query: { outcome: "delivered" } });
    assert.equal((await lifecycle.reconcileOrder("t1")).outcome, "skipped");
    assert.equal(calls.query, 0);
  }
});

test("supplier's face-value 'amount charged' never raises the known cost; a lower figure is used", async () => {
  const face = setup({
    tx: { providerStatus: "processing", status: "pending", paymentStatus: "successful", providerReference: "1", costKobo: 9700, costSource: "estimate" },
    query: { outcome: "delivered", statusCode: 200, amountCharged: 100 },
  });
  await face.lifecycle.reconcileOrder("t1");
  assert.equal(face.doc().costKobo, 9700);
  assert.equal(face.doc().costSource, "estimate");

  const lower = setup({
    tx: { providerStatus: "processing", status: "pending", paymentStatus: "successful", providerReference: "1", costKobo: 9700, costSource: "estimate" },
    query: { outcome: "delivered", statusCode: 200, amountCharged: 96.5 },
  });
  await lower.lifecycle.reconcileOrder("t1");
  assert.equal(lower.doc().costKobo, 9650);
  assert.equal(lower.doc().costSource, "supplier");
});
