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

const PLANS_V3 = {
  MOBILE_NETWORK: {
    MTN: [{ ID: "01", PRODUCT: [{ PRODUCT_CODE: "5", PRODUCT_ID: "2000", PRODUCT_NAME: "2GB - Weekly (SME)", PRODUCT_AMOUNT: "820.00" }] }],
    m_9mobile: [{ ID: "03", PRODUCT: [{ PRODUCT_CODE: "5", PRODUCT_ID: "1000", PRODUCT_NAME: "1 GB - 30 days (SME)", PRODUCT_AMOUNT: "492.00" }] }],
  },
};
const withPlans = (orderReply) => (u) => (u.pathname === "/APIDatabundlePlansV3.asp" ? { body: PLANS_V3 } : orderReply);

test("data: sends ClubKonnect's current PRODUCT_CODE for the plan (looked up from PlansV3)", async () => {
  ck.__resetPlanCodes();
  const f = fakeFetch(withPlans({ body: { orderid: "55", statuscode: "100", status: "ORDER_RECEIVED" } }));
  ck.__setFetch(f);
  const r = await ck.purchase({ type: "data", network: "9mobile", phone: "08091234567", plan: { providerPlanId: "1000" }, requestId: "ESCP-2" });
  assert.equal(r.outcome, "accepted");
  const order = f.calls.find((u) => u.pathname === "/APIDatabundleV1.asp");
  assert.equal(order.searchParams.get("MobileNetwork"), "03");
  assert.equal(order.searchParams.get("DataPlan"), "5");
  assert.equal(order.searchParams.get("RequestID"), "ESCP-2");

  // Second order reuses the cached plan list.
  await ck.purchase({ type: "data", network: "MTN", phone: "08031234567", plan: { providerPlanId: "2000" }, requestId: "ESCP-2b" });
  assert.equal(f.calls.filter((u) => u.pathname === "/APIDatabundlePlansV3.asp").length, 1);
  assert.equal(f.calls.at(-1).searchParams.get("DataPlan"), "5");
});

test("data: unmapped, withdrawn or unlookup-able plans fail safely without ordering", async () => {
  ck.__resetPlanCodes();
  const f = fakeFetch(withPlans({ body: { orderid: "1", statuscode: "100" } }));
  ck.__setFetch(f);
  const unmapped = await ck.purchase({ type: "data", network: "MTN", phone: "08031234567", plan: {}, requestId: "ESCP-3" });
  assert.equal(unmapped.errorCode, "plan_not_mapped");
  const gone = await ck.purchase({ type: "data", network: "MTN", phone: "08031234567", plan: { providerPlanId: "750.01" }, requestId: "ESCP-4" });
  assert.equal(gone.outcome, "failed");
  assert.equal(gone.errorCode, "plan_unavailable");
  assert.equal(f.calls.filter((u) => u.pathname === "/APIDatabundleV1.asp").length, 0, "no order sent");

  ck.__resetPlanCodes();
  ck.__setFetch(fakeFetch(new Error("offline")));
  const down = await ck.purchase({ type: "data", network: "MTN", phone: "08031234567", plan: { providerPlanId: "2000" }, requestId: "ESCP-5" });
  assert.equal(down.outcome, "failed");
  assert.equal(down.errorCode, "plan_lookup_failed");
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

test("data plan list comes from PlansV3 with our real cost (amount x discount factor)", async () => {
  ck.__setFetch(
    fakeFetch((u) => {
      assert.equal(u.pathname, "/APIDatabundlePlansV3.asp");
      return {
        body: {
          MOBILE_NETWORK: {
            MTN: [{ ID: "01", PRODUCT: [
              { PRODUCT_CODE: "2", PRODUCT_ID: "500", PRODUCT_NAME: "500MB - Weekly (SME)", PRODUCT_AMOUNT: "297.00", PRODUCT_DISCOUNT_AMOUNT: "1", DATA_TYPE: "SME" },
              { PRODUCT_CODE: "19", PRODUCT_ID: "800.01", PRODUCT_NAME: "1GB Weekly Plan - 7 days (Direct Data)", PRODUCT_AMOUNT: "800.00", PRODUCT_DISCOUNT_AMOUNT: "0.97", DATA_TYPE: "DIRECT" },
            ] }],
            Bogus: [{ ID: "99", PRODUCT: [{ PRODUCT_ID: "1", PRODUCT_NAME: "x", PRODUCT_AMOUNT: "1" }] }],
          },
        },
      };
    })
  );
  const plans = await ck.getDataPlans();
  assert.deepEqual(plans, [
    { network: "MTN", networkCode: "01", providerPlanId: "500", providerPlanCode: "2", name: "500MB - Weekly (SME)", cost: 297, networkPrice: null, dataType: "SME" },
    { network: "MTN", networkCode: "01", providerPlanId: "800.01", providerPlanCode: "19", name: "1GB Weekly Plan - 7 days (Direct Data)", cost: 776, networkPrice: 800, dataType: "DIRECT" },
  ]);
});

test("wallet balance", async () => {
  ck.__setFetch(fakeFetch({ body: { date: "15th-Oct-2017", id: "CK999", balance: "3500" } }));
  assert.deepEqual(await ck.getBalance(), { balance: 3500 });
  ck.__setFetch(fakeFetch({ body: { status: "INVALID_CREDENTIALS" } }));
  await assert.rejects(() => ck.getBalance(), /INVALID_CREDENTIALS/);
});
