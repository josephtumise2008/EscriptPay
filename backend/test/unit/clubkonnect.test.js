const test = require("node:test");
const assert = require("node:assert/strict");

process.env.CLUBKONNECT_USER_ID = "CK999";
process.env.CLUBKONNECT_API_KEY = "SECRETKEY123";
process.env.APP_URL = "https://escriptpay.example.com";

const ck = require("../../src/services/vtu/clubkonnectVtuService");

// Fake HTTP layer: records requests, replies with a canned body.
const fakeFetch = (reply) => {
  const calls = [];
  const fn = async (url) => {
    calls.push(new URL(url));
    if (reply instanceof Error) throw reply;
    const { status = 200, body } = typeof reply === "function" ? reply(new URL(url)) : reply;
    return { ok: status >= 200 && status < 300, status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) };
  };
  fn.calls = calls;
  return fn;
};

test.after(() => ck.__setFetch(null));

test("airtime: documented URL, network code, local phone, RequestID and callback", async () => {
  const f = fakeFetch({ body: { orderid: "789", statuscode: "100", status: "ORDER_RECEIVED" } });
  ck.__setFetch(f);
  const r = await ck.purchase({ type: "airtime", network: "Airtel", phone: "+2348031234567", amount: 500, requestId: "ESCP-1" });
  assert.equal(r.outcome, "accepted");
  assert.equal(r.reference, "789");
  const u = f.calls[0];
  assert.equal(u.origin + u.pathname, "https://www.nellobytesystems.com/APIAirtimeV1.asp");
  assert.equal(u.searchParams.get("UserID"), "CK999");
  assert.equal(u.searchParams.get("MobileNetwork"), "04");
  assert.equal(u.searchParams.get("Amount"), "500");
  assert.equal(u.searchParams.get("MobileNumber"), "08031234567");
  assert.equal(u.searchParams.get("RequestID"), "ESCP-1");
  assert.equal(u.searchParams.get("CallBackURL"), "https://escriptpay.example.com/api/vtu/clubkonnect/callback");
});

test("data: uses the plan's ClubKonnect DataPlan code; unmapped plans are never sent", async () => {
  const f = fakeFetch({ body: { orderid: "55", statuscode: "100", status: "ORDER_RECEIVED" } });
  ck.__setFetch(f);
  const r = await ck.purchase({ type: "data", network: "9mobile", phone: "08091234567", plan: { providerPlanId: "1000.00" }, requestId: "ESCP-2" });
  assert.equal(r.outcome, "accepted");
  assert.equal(f.calls[0].pathname, "/APIDatabundleV1.asp");
  assert.equal(f.calls[0].searchParams.get("MobileNetwork"), "03");
  assert.equal(f.calls[0].searchParams.get("DataPlan"), "1000.00");

  const unmapped = await ck.purchase({ type: "data", network: "MTN", phone: "08031234567", plan: {}, requestId: "ESCP-3" });
  assert.equal(unmapped.outcome, "failed");
  assert.equal(unmapped.errorCode, "plan_not_mapped");
  assert.equal(f.calls.length, 1, "no request for an unmapped plan");
});

test("status codes map to safe outcomes", () => {
  const cases = [
    [{ statuscode: "200", status: "ORDER_COMPLETED" }, "delivered"],
    [{ statuscode: "100", status: "ORDER_RECEIVED" }, "accepted"],
    [{ statuscode: "201", status: "ORDER_COMPLETED" }, "accepted"],
    [{ statuscode: "300", status: "ORDER_PROCESSING" }, "accepted"],
    [{ statuscode: "412", status: "ORDER_ERROR" }, "accepted"],
    [{ statuscode: "600", status: "ORDER_ONHOLD" }, "accepted"],
    [{ statuscode: "602", status: "ORDER_ONHOLD" }, "failed"],
    [{ statuscode: "409", status: "ORDER_ERROR" }, "failed"],
    [{ statuscode: "417", status: "ORDER_ERROR" }, "failed"],
    [{ statuscode: "509", status: "ORDER_CANCELLED" }, "failed"],
    [{ statuscode: "899", status: "ORDER_REFUNDED" }, "failed"],
    [{ statuscode: "299", status: "ORDER_COMPLETED" }, "unknown"],
    [{ statuscode: "799", status: "ORDER_PROCESSED" }, "unknown"],
    [{ status: "INVALID_CREDENTIALS" }, "failed"],
    [{ status: "ORDER_RECEIVED" }, "accepted"],
    [{ status: "SOMETHING_NEW" }, "unknown"],
    [{}, "unknown"],
  ];
  for (const [body, expected] of cases) assert.equal(ck.interpret(body).outcome, expected, JSON.stringify(body));
  assert.equal(ck.interpret({ statuscode: "417" }).attention, true, "low supplier balance needs attention");
  assert.equal(ck.interpret({ status: "INVALID_CREDENTIALS" }).attention, true);
  assert.equal(ck.interpret({ statuscode: "516" }).attention, false);
});

test("timeouts and network errors throw (lifecycle treats them as unknown) without leaking the key", async () => {
  const abort = new Error("aborted");
  abort.name = "AbortError";
  ck.__setFetch(fakeFetch(abort));
  await assert.rejects(
    () => ck.purchase({ type: "airtime", network: "MTN", phone: "08031234567", amount: 100, requestId: "X" }),
    (e) => e.code === "timeout" && !e.message.includes("SECRETKEY123")
  );
  ck.__setFetch(fakeFetch({ status: 502, body: "Bad gateway" }));
  await assert.rejects(
    () => ck.purchase({ type: "airtime", network: "MTN", phone: "08031234567", amount: 100, requestId: "X" }),
    (e) => e.code === "http_502" && !e.message.includes("SECRETKEY123")
  );
  ck.__setFetch(fakeFetch({ body: "<html>oops</html>" }));
  await assert.rejects(
    () => ck.purchase({ type: "airtime", network: "MTN", phone: "08031234567", amount: 100, requestId: "X" }),
    (e) => e.code === "bad_response"
  );
});

test("invalid input is refused locally, before any request", async () => {
  const f = fakeFetch({ body: {} });
  ck.__setFetch(f);
  assert.equal((await ck.purchase({ type: "airtime", network: "Etisalat", phone: "08031234567", amount: 100, requestId: "X" })).outcome, "failed");
  assert.equal((await ck.purchase({ type: "airtime", network: "MTN", phone: "123", amount: 100, requestId: "X" })).outcome, "failed");
  assert.equal((await ck.purchase({ type: "airtime", network: "MTN", phone: "08031234567", amount: 49, requestId: "X" })).outcome, "failed");
  assert.equal(f.calls.length, 0);
});

test("query uses OrderID when known, else our RequestID", async () => {
  const f = fakeFetch({ body: { orderid: "789", statuscode: "200", status: "ORDER_COMPLETED" } });
  ck.__setFetch(f);
  assert.equal((await ck.queryStatus({ transaction: { providerReference: "789", transactionId: "ESCP-1" } })).outcome, "delivered");
  assert.equal(f.calls[0].pathname, "/APIQueryV1.asp");
  assert.equal(f.calls[0].searchParams.get("OrderID"), "789");
  await ck.queryStatus({ transaction: { transactionId: "ESCP-9" } });
  assert.equal(f.calls[1].searchParams.get("RequestID"), "ESCP-9");
});

test("data plan list is parsed from the documented MOBILE_NETWORK format", async () => {
  ck.__setFetch(
    fakeFetch({
      body: {
        MOBILE_NETWORK: {
          MTN: [{ ID: "01", PRODUCT: [{ PRODUCT_ID: "1000", PRODUCT_NAME: "1 GB - Weekly (SME)", PRODUCT_AMOUNT: "410" }] }],
          Airtel: [{ ID: "04", PRODUCT: [{ PRODUCT_ID: "499.91", PRODUCT_NAME: "1GB - 1 day (Awoof Data)", PRODUCT_AMOUNT: "470.450027751923" }] }],
          Bogus: [{ ID: "99", PRODUCT: [{ PRODUCT_ID: "1", PRODUCT_NAME: "x", PRODUCT_AMOUNT: "1" }] }],
        },
      },
    })
  );
  const plans = await ck.getDataPlans();
  assert.deepEqual(plans, [
    { network: "MTN", networkCode: "01", providerPlanId: "1000", name: "1 GB - Weekly (SME)", cost: 410 },
    { network: "Airtel", networkCode: "04", providerPlanId: "499.91", name: "1GB - 1 day (Awoof Data)", cost: 470.45 },
  ]);
});

test("wallet balance", async () => {
  ck.__setFetch(fakeFetch({ body: { date: "15th-Oct-2017", id: "CK999", balance: "3500" } }));
  assert.deepEqual(await ck.getBalance(), { balance: 3500 });
  ck.__setFetch(fakeFetch({ body: { status: "INVALID_CREDENTIALS" } }));
  await assert.rejects(() => ck.getBalance(), /INVALID_CREDENTIALS/);
});
