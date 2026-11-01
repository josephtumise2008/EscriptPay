// Paystack payment service (server-side only).
//
// Based on Paystack's official documentation:
//   - POST https://api.paystack.co/transaction/initialize
//       body: email, amount (currency subunit — kobo for NGN, as a string),
//             currency, reference (only - . = and alphanumerics), callback_url,
//             metadata
//       response: { status: true, data: { authorization_url, access_code, reference } }
//   - GET  https://api.paystack.co/transaction/verify/:reference
//       response: { status: true, data: { status, amount, currency, reference, paid_at, id,
//                   channel, authorization: { country_code, bank, ... } } }
//   - POST https://api.paystack.co/refund
//       body: transaction (reference or id); full refund when amount is omitted
//   - Webhooks carry `x-paystack-signature`: an HMAC SHA512 of the event
//     payload (the raw request body) signed with the secret key.
//
// The secret key is read from PAYSTACK_SECRET_KEY on every call and is never
// logged, returned, or sent anywhere except the Authorization header.

const crypto = require("crypto");

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const REQUEST_TIMEOUT_MS = Number(process.env.PAYSTACK_TIMEOUT_MS || 15000);
const REFERENCE_PATTERN = /^[A-Za-z0-9.=-]{1,100}$/;
// Payment methods a checkout may be limited to (Paystack channel names).
const ALLOWED_CHANNELS = ["card", "bank", "ussd", "bank_transfer"];

class PaymentProviderError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "PaymentProviderError";
    this.code = code;
  }
}

// Injectable for automated tests (no real network calls in tests).
let fetchImpl = (...args) => fetch(...args);
const __setFetch = (fn) => {
  fetchImpl = fn || ((...args) => fetch(...args));
};

const secretKey = () => {
  const key = (process.env.PAYSTACK_SECRET_KEY || "").trim();
  if (!key) throw new PaymentProviderError("Payment provider is not configured.", "not_configured");
  return key;
};

const request = async (method, path, body) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(`${PAYSTACK_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof PaymentProviderError) throw error;
    const timedOut = error?.name === "AbortError";
    throw new PaymentProviderError(
      timedOut ? "Payment provider timed out." : "Could not reach the payment provider.",
      timedOut ? "timeout" : "network"
    );
  } finally {
    clearTimeout(timer);
  }

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { httpStatus: response.status, json };
};

const isValidReference = (reference) => typeof reference === "string" && REFERENCE_PATTERN.test(reference);

// Starts a checkout. Does NOT mean the customer has paid.
const initializePayment = async ({ email, amountKobo, reference, callbackUrl, metadata, channels }) => {
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    throw new PaymentProviderError("Invalid payment amount.", "invalid_amount");
  }
  if (!isValidReference(reference)) {
    throw new PaymentProviderError("Invalid payment reference.", "invalid_reference");
  }
  if (!email) {
    throw new PaymentProviderError("Customer email is required.", "invalid_email");
  }

  const { httpStatus, json } = await request("POST", "/transaction/initialize", {
    email,
    amount: String(amountKobo),
    currency: "NGN",
    reference,
    callback_url: callbackUrl,
    metadata,
    // Optional: open checkout on one method only (e.g. ["bank_transfer"]).
    ...(Array.isArray(channels) && channels.length && channels.every((c) => ALLOWED_CHANNELS.includes(c)) ? { channels } : {}),
  });

  const data = json && json.data;
  if (httpStatus < 200 || httpStatus >= 300 || !json || json.status !== true || !data || !data.authorization_url) {
    throw new PaymentProviderError("Payment could not be started.", "init_failed");
  }
  if (data.reference && data.reference !== reference) {
    throw new PaymentProviderError("Payment provider returned an unexpected reference.", "reference_mismatch");
  }

  return {
    checkoutUrl: data.authorization_url,
    accessCode: data.access_code || null,
    reference,
  };
};

// Asks Paystack for the authoritative state of a payment.
//   -> { status, amountKobo, currency, reference, paidAt, gatewayTransactionId }
// `status` is Paystack's data.status lower-cased ("success" means paid).
const verifyPayment = async (reference) => {
  if (!isValidReference(reference)) {
    throw new PaymentProviderError("Invalid payment reference.", "invalid_reference");
  }

  const { httpStatus, json } = await request("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
  const data = json && json.data;
  if (httpStatus < 200 || httpStatus >= 300 || !json || json.status !== true || !data) {
    throw new PaymentProviderError("Payment could not be verified.", "verify_failed");
  }
  const auth = data.authorization || {};

  return {
    status: String(data.status || "").toLowerCase(),
    amountKobo: Number(data.amount),
    currency: String(data.currency || "").toUpperCase(),
    reference: data.reference,
    paidAt: data.paid_at || data.paidAt || null,
    gatewayTransactionId: data.id != null ? String(data.id) : null,
    // How the customer paid ("card", "bank_transfer", "ussd", ...) and, for
    // cards, the issuing country (ISO code, e.g. "NG").
    channel: data.channel ? String(data.channel).toLowerCase() : null,
    cardCountry: auth.country_code ? String(auth.country_code).toUpperCase() : null,
    cardBank: auth.bank ? String(auth.bank) : null,
  };
};

// Full refund of a successful payment back to the customer's card/account.
const refundPayment = async (reference) => {
  if (!isValidReference(reference)) {
    throw new PaymentProviderError("Invalid payment reference.", "invalid_reference");
  }
  const { httpStatus, json } = await request("POST", "/refund", { transaction: reference });
  if (httpStatus < 200 || httpStatus >= 300 || !json || json.status !== true) {
    throw new PaymentProviderError("Refund could not be started.", "refund_failed");
  }
  const data = json.data || {};
  return { status: String(data.status || "pending").toLowerCase() };
};

// Constant-time check of the webhook signature against the RAW body bytes.
const verifyWebhookSignature = (rawBody, signature) => {
  if (!Buffer.isBuffer(rawBody) || typeof signature !== "string" || !signature) return false;
  let key;
  try {
    key = secretKey();
  } catch {
    return false;
  }
  const expected = Buffer.from(crypto.createHmac("sha512", key).update(rawBody).digest("hex"), "utf8");
  const received = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

module.exports = {
  name: "paystack",
  requiresCheckout: true,
  simulated: false,
  initializePayment,
  verifyPayment,
  refundPayment,
  verifyWebhookSignature,
  isValidReference,
  PaymentProviderError,
  __setFetch,
};
