// Default order-lifecycle instance wired to the real models and the
// configured providers.
const Transaction = require("../models/Transaction");
const Plan = require("../models/Plan");
const { payment, vtu, config } = require("./index");
const { createOrderLifecycle } = require("./orderLifecycle");
const { logEvent } = require("../utils/logger");

// Lazy require: deliveryEmail loads models/services that load this module.
const onDelivered = (tx) => require("./deliveryEmail").emailDelivery(tx);

module.exports = createOrderLifecycle({ Transaction, Plan, payment, vtu, config, logEvent, onDelivered });
