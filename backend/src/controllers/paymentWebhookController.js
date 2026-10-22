const connectDB = require("../config/db");
const { payment, config } = require("../services");
const lifecycle = require("../services/lifecycle");
const { logEvent } = require("../utils/logger");

const REFERENCE_PATTERN = /^[A-Za-z0-9.=-]{1,100}$/;

// POST /api/payments/paystack/webhook
//
// - The body arrives as a raw Buffer (see server.js) so the HMAC SHA512
//   signature is checked against the exact bytes Paystack signed.
// - Invalid signatures are rejected before any database access.
// - The event is never trusted on its own: the reference is re-verified with
//   Paystack's verify API inside lifecycle.confirmPayment, which also checks
//   amount and currency.
// - Processing is idempotent, so Paystack retries and duplicate deliveries
//   are harmless. A 500 makes Paystack retry later.
const paystackWebhook = async (req, res) => {
  if (config.paymentProvider !== "paystack") {
    return res.status(404).json({ success: false, message: "Route not found." });
  }

  const rawBody = req.body;
  const signature = req.get("x-paystack-signature");
  if (!Buffer.isBuffer(rawBody) || !payment.verifyWebhookSignature(rawBody, signature)) {
    logEvent("webhook.rejected", { reason: "invalid_signature" });
    return res.status(401).json({ success: false });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ success: false });
  }

  if (!event || event.event !== "charge.success") {
    // Acknowledge events we do not act on so they are not retried.
    return res.status(200).json({ received: true });
  }

  const reference = event.data && event.data.reference;
  if (typeof reference !== "string" || !REFERENCE_PATTERN.test(reference)) {
    logEvent("webhook.ignored", { reason: "bad_reference" });
    return res.status(200).json({ received: true });
  }

  try {
    await connectDB();
    const result = await lifecycle.confirmPayment(reference, { source: "webhook" });
    if (result.outcome === "not_found") {
      logEvent("webhook.ignored", { reason: "unknown_reference" });
      return res.status(200).json({ received: true });
    }
    if (result.tx && result.tx.paymentStatus === "successful" && result.tx.providerStatus === "pending") {
      await lifecycle.fulfillOrder(result.tx);
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    logEvent("webhook.error", { code: error && error.code, message: error && error.message });
    return res.status(500).json({ received: false });
  }
};

module.exports = { paystackWebhook };
