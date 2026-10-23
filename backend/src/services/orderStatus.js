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

module.exports = { refreshOrder };
