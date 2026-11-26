// Default order-lifecycle instance wired to the real models and the
// configured providers.
const Transaction = require("../models/Transaction");
const Plan = require("../models/Plan");
const { payment, vtu, config } = require("./index");
const { createOrderLifecycle } = require("./orderLifecycle");
const { logEvent } = require("../utils/logger");

// Lazy require: deliveryEmail loads models/services that load this module.
// Each hook is best effort and independent: one failing never stops the other
// or affects the order.
const onDelivered = (tx) =>
  Promise.allSettled([
    require("./deliveryEmail").emailDelivery(tx),
    require("./giftBox")
      .onOrderDelivered(tx)
      .catch((error) => logEvent("gift.credit_failed", { transactionId: tx && tx.transactionId, message: error && error.message })),
  ]);

module.exports = createOrderLifecycle({ Transaction, Plan, payment, vtu, config, logEvent, onDelivered });
