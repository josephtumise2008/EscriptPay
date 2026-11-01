// Brings an unfinished order up to date with the supplier and applies the
// consequences (wallet refund when a wallet-paid order definitively failed).
const lifecycle = require("./lifecycle");
const wallet = require("./wallet");

const refreshOrder = async (tx, options = {}) => {
  const result = await lifecycle.reconcileOrder(tx, options);
  let current = result.tx || tx;
  if (current && current.providerStatus === "failed" && current.paymentProvider === "wallet") {
    const refunded = await wallet.refundOrder(current);
    current = refunded.tx || current;
  }
  return { outcome: result.outcome, tx: current };
};

// Brings a few unfinished orders up to date (e.g. when a customer opens their
// wallet or history, or the owner opens the Business page), so an order whose
// page nobody is watching still finishes or gets refunded. Throttled per order.
//
// budgetMs: the most a page load will wait for the supplier. Checks still
// running after that are left to finish on their own or on the next sweep
// (each check is a read plus atomic conditional updates, so being cut off
// is harmless). The scheduled sweep (/api/cron/sweep) runs without a budget.
const refreshStaleOrders = async (filter = {}, { limit = 5, budgetMs = 0 } = {}) => {
  const Transaction = require("../models/Transaction");
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const stale = await Transaction.find({ ...filter, providerStatus: { $in: ["processing", "unknown"] }, createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(limit);
  if (!stale.length) return 0;
  const work = Promise.all(stale.map((tx) => refreshOrder(tx, { source: "sweep" }).catch(() => null)));
  if (budgetMs > 0) {
    let timer;
    await Promise.race([work, new Promise((resolve) => (timer = setTimeout(resolve, budgetMs)))]);
    clearTimeout(timer);
  } else {
    await work;
  }
  return stale.length;
};

module.exports = { refreshOrder, refreshStaleOrders };
