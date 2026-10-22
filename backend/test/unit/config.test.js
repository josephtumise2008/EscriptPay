const test = require("node:test");
const assert = require("node:assert/strict");
const { readConfig } = require("../../src/config/payments");

test("defaults to fully simulated test mode", () => {
  const c = readConfig({});
  assert.equal(c.paymentProvider, "test");
  assert.equal(c.vtuProvider, "test");
  assert.equal(c.paymentMode, "test");
  assert.equal(c.deliveryMode, "test");
  assert.equal(c.currency, "NGN");
});

test("rejects unknown providers instead of loading arbitrary modules", () => {
  assert.throws(() => readConfig({ PAYMENT_SERVICE: "../../evil" }), /Unsupported PAYMENT_SERVICE/);
  assert.throws(() => readConfig({ VTU_SERVICE: "clubkonnect" }), /Unsupported VTU_SERVICE/);
});

test("paystack requires a secret key", () => {
  assert.throws(() => readConfig({ PAYMENT_SERVICE: "paystack" }), /PAYSTACK_SECRET_KEY/);
});

test("paystack test key is accepted and stays in test mode", () => {
  const c = readConfig({ PAYMENT_SERVICE: "paystack", PAYSTACK_SECRET_KEY: "sk_test_abc" });
  assert.equal(c.paymentMode, "test");
});

test("non-Paystack-looking keys are rejected", () => {
  assert.throws(
    () => readConfig({ PAYMENT_SERVICE: "paystack", PAYSTACK_SECRET_KEY: "pk_test_public" }),
    /must be a Paystack secret key/
  );
});

test("live key is refused unless LIVE_PAYMENTS_ENABLED=true", () => {
  assert.throws(
    () => readConfig({ PAYMENT_SERVICE: "paystack", PAYSTACK_SECRET_KEY: "sk_live_x" }),
    /Live payments are disabled/
  );
});

test("live payments with simulated delivery are refused even when enabled", () => {
  assert.throws(
    () =>
      readConfig({
        PAYMENT_SERVICE: "paystack",
        PAYSTACK_SECRET_KEY: "sk_live_x",
        LIVE_PAYMENTS_ENABLED: "true",
      }),
    /never delivered/
  );
});

test("error messages never contain the secret value", () => {
  try {
    readConfig({ PAYMENT_SERVICE: "paystack", PAYSTACK_SECRET_KEY: "sk_live_SUPERSECRET" });
    assert.fail("should throw");
  } catch (error) {
    assert.ok(!error.message.includes("SUPERSECRET"));
  }
});

test("app URL comes from APP_URL, else the first CLIENT_ORIGIN", () => {
  assert.equal(readConfig({ APP_URL: "https://pay.example.com/" }).appUrl, "https://pay.example.com");
  assert.equal(
    readConfig({ CLIENT_ORIGIN: "https://a.example.com, https://b.example.com" }).appUrl,
    "https://a.example.com"
  );
});
