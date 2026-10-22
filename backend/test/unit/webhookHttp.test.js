// HTTP-level checks of the webhook route that need NO database: the raw-body
// signature check runs before any MongoDB access.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

process.env.NODE_ENV = "test";
process.env.PAYMENT_SERVICE = "paystack";
process.env.PAYSTACK_SECRET_KEY = "sk_test_http_secret";
process.env.VTU_SERVICE = "test";
// Unreachable on purpose: these tests must never touch a real database.
process.env.MONGO_URI = "mongodb://127.0.0.1:1/escriptpay_unit_test";
process.env.JWT_SECRET = "unit-test-jwt-secret";

const app = require("../../src/server");
const { startServer, createClient } = require("../helpers/server");

let srv;
let client;
test.before(async () => {
  srv = await startServer(app);
  client = createClient(srv.baseUrl);
});
test.after(async () => srv.close());

const sign = (buf) => crypto.createHmac("sha512", "sk_test_http_secret").update(buf).digest("hex");

test("webhook with no signature is rejected with 401", async () => {
  const raw = Buffer.from(JSON.stringify({ event: "charge.success", data: { reference: "ESCP-1" } }));
  const res = await client.post("/api/payments/paystack/webhook", raw, { "Content-Type": "application/json" });
  assert.equal(res.status, 401);
});

test("webhook with a forged signature is rejected with 401", async () => {
  const raw = Buffer.from(JSON.stringify({ event: "charge.success", data: { reference: "ESCP-1" } }));
  const forged = crypto.createHmac("sha512", "attacker-key").update(raw).digest("hex");
  const res = await client.post("/api/payments/paystack/webhook", raw, {
    "Content-Type": "application/json",
    "x-paystack-signature": forged,
  });
  assert.equal(res.status, 401);
});

test("signature is checked against the raw bytes (whitespace changes break it)", async () => {
  const signedBody = Buffer.from('{"event":"charge.success","data":{"reference":"ESCP-1"}}');
  const sent = Buffer.from('{ "event": "charge.success", "data": { "reference": "ESCP-1" } }');
  const res = await client.post("/api/payments/paystack/webhook", sent, {
    "Content-Type": "application/json",
    "x-paystack-signature": sign(signedBody),
  });
  assert.equal(res.status, 401);
});

test("validly signed events we do not act on are acknowledged with 200", async () => {
  const raw = Buffer.from(JSON.stringify({ event: "transfer.success", data: {} }));
  const res = await client.post("/api/payments/paystack/webhook", raw, {
    "Content-Type": "application/json",
    "x-paystack-signature": sign(raw),
  });
  assert.equal(res.status, 200);
});

test("public config exposes mode only, never secrets", async () => {
  const res = await client.get("/api/config");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.config, {
    paymentProvider: "paystack",
    paymentMode: "test",
    deliveryMode: "test",
    currency: "NGN",
  });
  assert.ok(!JSON.stringify(res.body).includes("sk_test"));
});

test("existing JSON routes still parse JSON bodies (raw parser is scoped to the webhook)", async () => {
  // Hits express.json(); no DB is reachable so the API answers 503 after
  // parsing — the point is that it is not a 400/500 body-parsing failure.
  const res = await client.post("/api/auth/login", { email: "a@b.co", password: "x" });
  assert.equal(res.status, 503);
});
