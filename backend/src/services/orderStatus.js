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
const refreshStaleOrders = async (filter = {}, { limit = 5 } = {}) => {
  const Transaction = require("../models/Transaction");
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const stale = await Transaction.find({ ...filter, providerStatus: { $in: ["processing", "unknown"] }, createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(limit);
  await Promise.all(stale.map((tx) => refreshOrder(tx, { source: "sweep" }).catch(() => null)));
  return stale.length;
};

module.exports = { refreshOrder, refreshStaleOrders };
