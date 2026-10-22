// Payment + VTU (delivery) configuration, validated once at startup.
//
// This module is the safety gate for real money and real delivery. It fails
// closed: an unsafe or incomplete combination throws, so the API refuses to
// start rather than silently taking payments it cannot fulfil or delivering
// airtime/data it was not paid for. Secret VALUES are never logged or echoed —
// only variable names appear in error messages.

const SUPPORTED_PAYMENT_PROVIDERS = ["test", "paystack"];
// Real suppliers are added here only after their adapter is implemented from
// official documentation and tested (see docs/PAYMENTS.md).
const SUPPORTED_VTU_PROVIDERS = ["test"];

const DEFAULT_PAYMENT_EXPIRY_MINUTES = 60;

const positiveInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

const firstOrigin = (value) =>
  (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0] || "";

const readConfig = (env = process.env) => {
  const paymentProvider = (env.PAYMENT_SERVICE || "test").trim().toLowerCase();
  const vtuProvider = (env.VTU_SERVICE || "test").trim().toLowerCase();

  if (!SUPPORTED_PAYMENT_PROVIDERS.includes(paymentProvider)) {
    throw new Error(
      `Unsupported PAYMENT_SERVICE "${paymentProvider}". Supported: ${SUPPORTED_PAYMENT_PROVIDERS.join(", ")}.`
    );
  }
  if (!SUPPORTED_VTU_PROVIDERS.includes(vtuProvider)) {
    throw new Error(
      `Unsupported VTU_SERVICE "${vtuProvider}". Supported: ${SUPPORTED_VTU_PROVIDERS.join(", ")}.`
    );
  }

  const realDelivery = vtuProvider !== "test";

  // Real delivery must never be paired with simulated payment: that would hand
  // out real airtime/data for free.
  if (realDelivery && paymentProvider === "test") {
    throw new Error(
      "VTU_SERVICE is a real supplier but PAYMENT_SERVICE=test. Refusing to start: " +
        "this would deliver real airtime/data without payment."
    );
  }
  if (realDelivery && env.LIVE_DELIVERY_ENABLED !== "true") {
    throw new Error(
      "VTU_SERVICE is a real supplier but LIVE_DELIVERY_ENABLED is not \"true\". Real delivery is disabled."
    );
  }

  let paymentMode = "test";
  if (paymentProvider === "paystack") {
    const key = (env.PAYSTACK_SECRET_KEY || "").trim();
    if (!key) {
      throw new Error("PAYMENT_SERVICE=paystack requires the PAYSTACK_SECRET_KEY environment variable.");
    }
    if (key.startsWith("sk_live_")) {
      if (env.LIVE_PAYMENTS_ENABLED !== "true") {
        throw new Error(
          "PAYSTACK_SECRET_KEY is a LIVE key but LIVE_PAYMENTS_ENABLED is not \"true\". Live payments are disabled."
        );
      }
      paymentMode = "live";
    } else if (!key.startsWith("sk_test_")) {
      throw new Error("PAYSTACK_SECRET_KEY must be a Paystack secret key (sk_test_... or sk_live_...).");
    }
  }

  // Customers must never pay real money for simulated delivery.
  if (paymentMode === "live" && !realDelivery) {
    throw new Error(
      "Live payments are configured but VTU_SERVICE=test (simulated delivery). Refusing to start: " +
        "customers would be charged for airtime/data that is never delivered."
    );
  }

  const appUrl = ((env.APP_URL || "").trim() || firstOrigin(env.CLIENT_ORIGIN) || "http://localhost:3000").replace(
    /\/+$/,
    ""
  );

  return Object.freeze({
    paymentProvider,
    vtuProvider,
    paymentMode, // "test" | "live" — stored on each transaction as `mode`
    deliveryMode: realDelivery ? "live" : "test",
    currency: "NGN",
    paymentExpiryMinutes: positiveInt(env.PAYMENT_EXPIRY_MINUTES, DEFAULT_PAYMENT_EXPIRY_MINUTES),
    appUrl,
  });
};

let cached = null;
const getConfig = () => {
  if (!cached) cached = readConfig(process.env);
  return cached;
};

// Public, non-secret view for the frontend (GET /api/config).
const publicConfig = () => {
  const c = getConfig();
  return {
    paymentProvider: c.paymentProvider,
    paymentMode: c.paymentMode,
    deliveryMode: c.deliveryMode,
    currency: c.currency,
  };
};

module.exports = {
  readConfig,
  getConfig,
  publicConfig,
  SUPPORTED_PAYMENT_PROVIDERS,
  SUPPORTED_VTU_PROVIDERS,
};
