const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

process.env.PAYSTACK_SECRET_KEY = "sk_test_unit_secret";
const paystack = require("../../src/services/payment/paystackPaymentService");

const jsonResponse = (status, body) => ({
  status,
  json: async () => body,
});

test.afterEach(() => paystack.__setFetch(null));

test("initializePayment sends kobo, NGN, our reference and the secret only in the header", async () => {
  let captured;
  paystack.__setFetch(async (url, init) => {
    captured = { url, init };
    return jsonResponse(200, {
      status: true,
      data: { authorization_url: "https://checkout.paystack.com/abc", access_code: "abc", reference: "ESCP-1" },
    });
  });

  const out = await paystack.initializePayment({
    email: "buyer@example.com",
    amountKobo: 55000,
    reference: "ESCP-1",
    callbackUrl: "http://localhost:3000/payment/callback",
    metadata: { transactionId: "ESCP-1" },
  });

  assert.equal(captured.url, "https://api.paystack.co/transaction/initialize");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers.Authorization, "Bearer sk_test_unit_secret");
  const body = JSON.parse(captured.init.body);
  assert.equal(body.amount, "55000");
  assert.equal(body.currency, "NGN");
  assert.equal(body.reference, "ESCP-1");
  assert.equal(body.email, "buyer@example.com");
  assert.ok(!captured.init.body.includes("sk_test_unit_secret"));
  assert.equal(out.checkoutUrl, "https://checkout.paystack.com/abc");
});

test("initializePayment fails on status:false, HTTP errors, and a different reference", async () => {
  const args = { email: "a@b.co", amountKobo: 100, reference: "R-1", callbackUrl: "x" };

  paystack.__setFetch(async () => jsonResponse(200, { status: false, message: "Invalid key" }));
  await assert.rejects(paystack.initializePayment(args), { code: "init_failed" });

  paystack.__setFetch(async () => jsonResponse(401, { status: false }));
  await assert.rejects(paystack.initializePayment(args), { code: "init_failed" });

  paystack.__setFetch(async () =>
    jsonResponse(200, { status: true, data: { authorization_url: "https://x", reference: "OTHER" } })
  );
  await assert.rejects(paystack.initializePayment(args), { code: "reference_mismatch" });
});

test("initializePayment maps network failures and timeouts", async () => {
  const args = { email: "a@b.co", amountKobo: 100, reference: "R-1", callbackUrl: "x" };
  paystack.__setFetch(async () => {
    throw new TypeError("fetch failed");
  });
  await assert.rejects(paystack.initializePayment(args), { code: "network" });

  paystack.__setFetch(async () => {
    const e = new Error("aborted");
    e.name = "AbortError";
    throw e;
  });
  await assert.rejects(paystack.initializePayment(args), { code: "timeout" });
});

test("initializePayment validates amount and reference before any network call", async () => {
  let called = false;
  paystack.__setFetch(async () => {
    called = true;
  });
  await assert.rejects(
    paystack.initializePayment({ email: "a@b.co", amountKobo: 10.5, reference: "R" }),
    { code: "invalid_amount" }
  );
  await assert.rejects(
    paystack.initializePayment({ email: "a@b.co", amountKobo: 100, reference: "bad ref/../" }),
    { code: "invalid_reference" }
  );
  assert.equal(called, false);
});

test("verifyPayment normalizes Paystack's response", async () => {
  let url;
  paystack.__setFetch(async (u) => {
    url = u;
    return jsonResponse(200, {
      status: true,
      data: { status: "success", amount: 55000, currency: "ngn", reference: "ESCP-1", paid_at: "2026-10-22T10:00:00Z", id: 42 },
    });
  });
  const v = await paystack.verifyPayment("ESCP-1");
  assert.equal(url, "https://api.paystack.co/transaction/verify/ESCP-1");
  assert.deepEqual(v, {
    status: "success",
    amountKobo: 55000,
    currency: "NGN",
    reference: "ESCP-1",
    paidAt: "2026-10-22T10:00:00Z",
    gatewayTransactionId: "42",
    channel: null,
    cardCountry: null,
    cardBank: null,
    authorization: null,
  });
});

test("verifyPayment reports the channel and card country", async () => {
  paystack.__setFetch(async () =>
    jsonResponse(200, {
      status: true,
      data: {
        status: "success", amount: 100, currency: "NGN", reference: "ESCP-1", id: 1,
        channel: "card", authorization: { country_code: "pr", bank: "BANCO POPULAR DE PUERTO RICO" },
      },
    })
  );
  const v = await paystack.verifyPayment("ESCP-1");
  assert.equal(v.channel, "card");
  assert.equal(v.cardCountry, "PR");
  assert.equal(v.cardBank, "BANCO POPULAR DE PUERTO RICO");
});

test("refundPayment posts a full refund for the reference", async () => {
  let call;
  paystack.__setFetch(async (url, opts) => {
    call = { url, method: opts.method, body: JSON.parse(opts.body) };
    return jsonResponse(200, { status: true, data: { status: "pending" } });
  });
  assert.deepEqual(await paystack.refundPayment("ESCW-1"), { status: "pending" });
  assert.deepEqual(call, { url: "https://api.paystack.co/refund", method: "POST", body: { transaction: "ESCW-1" } });
  paystack.__setFetch(async () => jsonResponse(400, { status: false }));
  await assert.rejects(paystack.refundPayment("ESCW-1"), { code: "refund_failed" });
});

test("verifyPayment throws (does not guess) when Paystack cannot answer", async () => {
  paystack.__setFetch(async () => jsonResponse(400, { status: false, message: "Transaction reference not found" }));
  await assert.rejects(paystack.verifyPayment("ESCP-1"), { code: "verify_failed" });
});

test("webhook signature: valid HMAC SHA512 of the raw body is accepted", () => {
  const raw = Buffer.from(JSON.stringify({ event: "charge.success", data: { reference: "ESCP-1" } }));
  const sig = crypto.createHmac("sha512", "sk_test_unit_secret").update(raw).digest("hex");
  assert.equal(paystack.verifyWebhookSignature(raw, sig), true);
});

test("webhook signature: tampered body, wrong key, missing or malformed header are rejected", () => {
  const raw = Buffer.from('{"event":"charge.success","data":{"reference":"ESCP-1","amount":100}}');
  const sig = crypto.createHmac("sha512", "sk_test_unit_secret").update(raw).digest("hex");
  const tampered = Buffer.from(raw.toString().replace("100", "1"));
  const wrongKey = crypto.createHmac("sha512", "sk_test_other").update(raw).digest("hex");

  assert.equal(paystack.verifyWebhookSignature(tampered, sig), false);
  assert.equal(paystack.verifyWebhookSignature(raw, wrongKey), false);
  assert.equal(paystack.verifyWebhookSignature(raw, undefined), false);
  assert.equal(paystack.verifyWebhookSignature(raw, "abc"), false);
  // A re-serialized (parsed) body is not the raw body.
  assert.equal(paystack.verifyWebhookSignature(JSON.parse(raw.toString()), sig), false);
});

test("initializePayment passes only known channels", async () => {
  const bodies = [];
  paystack.__setFetch(async (url, opts) => {
    const body = JSON.parse(opts.body);
    bodies.push(body);
    return jsonResponse(200, { status: true, data: { authorization_url: "https://checkout.paystack.com/x", reference: body.reference } });
  });
  const args = { email: "a@b.co", amountKobo: 100, reference: "R-1", callbackUrl: "x" };
  await paystack.initializePayment({ ...args, channels: ["bank_transfer"] });
  await paystack.initializePayment({ ...args, channels: ["evil"] });
  await paystack.initializePayment(args);
  assert.deepEqual(bodies[0].channels, ["bank_transfer"]);
  assert.equal(bodies[1].channels, undefined);
  assert.equal(bodies[2].channels, undefined);
});

test("verifyPayment exposes the reusable card authorization; chargeAuthorization posts it", async () => {
  paystack.__setFetch(async () =>
    jsonResponse(200, {
      status: true,
      data: {
        status: "success", amount: 100, currency: "NGN", reference: "ESCW-1", id: 1, channel: "card",
        authorization: { authorization_code: "AUTH_x", reusable: true, channel: "card", card_type: "visa ", last4: "4081", bank: "TB", exp_month: "12", exp_year: "2030", signature: "SIG", country_code: "NG" },
      },
    })
  );
  const v = await paystack.verifyPayment("ESCW-1");
  assert.deepEqual(v.authorization, { code: "AUTH_x", reusable: true, channel: "card", signature: "SIG", brand: "visa", last4: "4081", bank: "TB", expMonth: "12", expYear: "2030" });

  let call;
  paystack.__setFetch(async (url, opts) => {
    call = { url, body: JSON.parse(opts.body) };
    return jsonResponse(200, { status: true, data: { status: "success", reference: "ESCW-2" } });
  });
  assert.deepEqual(await paystack.chargeAuthorization({ email: "a@b.co", amountKobo: 50000, authorizationCode: "AUTH_x", reference: "ESCW-2" }), { status: "success" });
  assert.equal(call.url, "https://api.paystack.co/transaction/charge_authorization");
  assert.deepEqual(call.body, { email: "a@b.co", amount: "50000", currency: "NGN", authorization_code: "AUTH_x", reference: "ESCW-2" });

  paystack.__setFetch(async () => jsonResponse(400, { status: false, message: "Declined" }));
  assert.deepEqual(await paystack.chargeAuthorization({ email: "a@b.co", amountKobo: 50000, authorizationCode: "AUTH_x", reference: "ESCW-3" }), { status: "failed" });
  paystack.__setFetch(async () => jsonResponse(502, null));
  await assert.rejects(paystack.chargeAuthorization({ email: "a@b.co", amountKobo: 50000, authorizationCode: "AUTH_x", reference: "ESCW-4" }), { code: "charge_unknown" });
});
