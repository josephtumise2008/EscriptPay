// Service registry.
//
// The purchase controller and order lifecycle depend only on this module.
// Swapping the active payment or VTU provider is a configuration change
// (env), validated by config/payments.js — unknown or unsafe combinations
// throw at startup instead of loading arbitrary modules.
//
// Payment providers expose either:
//   - test:     processPayment({ user, transaction, amount })      (no checkout)
//   - paystack: initializePayment(...), verifyPayment(reference),
//               verifyWebhookSignature(rawBody, signature)        (checkout)
//
// VTU providers expose:
//   purchase({ type, network, phone, amount, plan, transaction, requestId })
//     -> { outcome: "delivered" | "accepted" | "failed" | "unknown", reference }
//   queryStatus({ transaction }) -> same shape (for reconciliation)

const { getConfig } = require("../config/payments");

const config = getConfig();

const PAYMENT_PROVIDERS = {
  test: () => require("./payment/testPaymentService"),
  paystack: () => require("./payment/paystackPaymentService"),
};

const VTU_PROVIDERS = {
  test: () => require("./vtu/testVtuService"),
  clubkonnect: () => require("./vtu/clubkonnectVtuService"),
};

const payment = PAYMENT_PROVIDERS[config.paymentProvider]();
const vtu = VTU_PROVIDERS[config.vtuProvider]();

module.exports = { payment, vtu, config };
