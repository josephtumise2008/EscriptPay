const Transaction = require("../models/Transaction");
const { vtu } = require("../services");
const { refreshOrder } = require("../services/orderStatus");
const { logEvent } = require("../utils/logger");

const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

// GET/POST /api/vtu/clubkonnect/callback
//
// ClubKonnect calls this with orderid / requestid / statuscode / orderstatus
// (query string or JSON). The callback is unauthenticated, so its contents
// are NEVER trusted: it only tells us which order to re-check, and the result
// comes from ClubKonnect's authenticated query API. Always answers 200 so the
// supplier doesn't retry forever; unknown or malformed ids are ignored.
const clubkonnectCallback = async (req, res) => {
  if (vtu.name !== "clubkonnect") return res.status(404).json({ success: false, message: "Route not found." });

  const source = { ...(req.query || {}), ...(req.body && typeof req.body === "object" ? req.body : {}) };
  const pick = (...keys) => {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && ID_PATTERN.test(value.trim())) return value.trim();
    }
    return null;
  };
  const orderId = pick("orderid", "OrderID", "orderId");
  const requestId = pick("requestid", "RequestID", "requestId");

  try {
    let tx = null;
    if (orderId) tx = await Transaction.findOne({ providerReference: orderId });
    if (!tx && requestId) tx = await Transaction.findOne({ transactionId: requestId.toUpperCase() });
    if (!tx) {
      logEvent("vtu.callback_ignored", { reason: "unknown_order" });
      return res.status(200).json({ received: true });
    }
    await refreshOrder(tx, { minIntervalMs: 3000, source: "callback" });
    return res.status(200).json({ received: true });
  } catch (error) {
    logEvent("vtu.callback_error", { message: error && error.message });
    return res.status(200).json({ received: true });
  }
};

module.exports = { clubkonnectCallback };
