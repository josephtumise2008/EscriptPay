const test = require("node:test");
const assert = require("node:assert/strict");

process.env.CLUBKONNECT_USER_ID = "CK999";
process.env.CLUBKONNECT_API_KEY = "SECRETKEY123";
process.env.APP_URL = "https://escriptpay.example.com";

const ck = require("../../src/services/vtu/clubkonnectVtuService");
const { parsePins } = require("../../src/services/billsText");

const reply = (body) => async (url) => {
  reply.last = new URL(url);
  return { ok: true, status: 200, text: async () => JSON.stringify(typeof body === "function" ? body(new URL(url)) : body) };
};
test.after(() => ck.__setFetch(null));

test("PINs are read from the supplier's card details", () => {
  assert.deepEqual(parsePins("Serial No:WRN200343867, pin: 572871474684"), [{ serial: "WRN200343867", pin: "572871474684" }]);
  assert.equal(parsePins("Serial No:A1, pin: 11; Serial No:B2, pin: 22").length, 2);
  assert.deepEqual(parsePins("nothing here"), []);
});

test("cable order sends the documented parameters from the order itself", async () => {
  ck.__setFetch(reply({ orderid: "789", statuscode: "100", status: "ORDER_RECEIVED" }));
  const tx = { serviceCode: "dstv", packageCode: "dstv-padi", account: "7023456789" };
  const r = await ck.purchase({ type: "cable", phone: "+2348031234567", requestId: "ESCP-1", transaction: tx });
  const u = reply.last;
  assert.equal(u.pathname, "/APICableTVV1.asp");
  assert.equal(u.searchParams.get("CableTV"), "dstv");
  assert.equal(u.searchParams.get("Package"), "dstv-padi");
  assert.equal(u.searchParams.get("SmartCardNo"), "7023456789");
  assert.equal(u.searchParams.get("PhoneNo"), "08031234567");
  assert.equal(u.searchParams.get("RequestID"), "ESCP-1");
  assert.equal(r.outcome, "accepted");
});

test("electricity order sends the face amount and returns the token", async () => {
  ck.__setFetch(reply({ orderid: "790", statuscode: "200", status: "ORDER_COMPLETED", metertoken: "1111-2222-3333" }));
  const tx = { serviceCode: "07", meterType: "01", account: "45031234567", faceAmountKobo: 200000 };
  const r = await ck.purchase({ type: "electricity", phone: "08031234567", requestId: "ESCP-2", transaction: tx });
  const u = reply.last;
  assert.equal(u.pathname, "/APIElectricityV1.asp");
  assert.equal(u.searchParams.get("ElectricCompany"), "07");
  assert.equal(u.searchParams.get("MeterType"), "01");
  assert.equal(u.searchParams.get("MeterNo"), "45031234567");
  assert.equal(u.searchParams.get("Amount"), "2000");
  assert.equal(r.outcome, "delivered");
  assert.equal(r.token, "1111-2222-3333");
});

test("WAEC order returns the card details", async () => {
  ck.__setFetch(reply({ orderid: "798", statuscode: "200", status: "ORDER_COMPLETED", carddetails: "Serial No:WRN200343867, pin: 572871474684" }));
  const r = await ck.purchase({ type: "exam", phone: "08031234567", requestId: "ESCP-3", transaction: { serviceCode: "waec", packageCode: "waecdirect" } });
  assert.equal(reply.last.pathname, "/APIWAECV1.asp");
  assert.equal(reply.last.searchParams.get("ExamType"), "waecdirect");
  assert.equal(r.outcome, "delivered");
  assert.match(r.cardDetails, /WRN200343867/);
});

test("bad bill orders are refused locally, before anything is sent", async () => {
  let called = false;
  ck.__setFetch(async () => {
    called = true;
    return { ok: true, status: 200, text: async () => "{}" };
  });
  const r = await ck.purchase({ type: "cable", phone: "08031234567", requestId: "X", transaction: { serviceCode: "dstv" } });
  assert.equal(r.outcome, "failed");
  assert.equal(r.notSent, true);
  assert.equal(called, false);
});

test("account checks: a name is valid, INVALID_* is not", async () => {
  ck.__setFetch(reply({ customer_name: "BALOGUN SUNDAY" }));
  assert.deepEqual(await ck.verifyAccount({ service: "electricity", provider: "07", account: "123", meterType: "01" }), { valid: true, name: "BALOGUN SUNDAY" });
  assert.equal(reply.last.pathname, "/APIVerifyElectricityV1.asp");
  ck.__setFetch(reply({ customer_name: "INVALID_SMARTCARDNO" }));
  assert.deepEqual(await ck.verifyAccount({ service: "cable", provider: "dstv", account: "123" }), { valid: false });
  assert.equal(reply.last.pathname, "/APIVerifyCableTVV1.asp");
  assert.equal(reply.last.searchParams.get("CableTV"), "dstv");
  ck.__setFetch(reply({ customer_name: "INVALID_ACCOUNTNO" }));
  assert.deepEqual(await ck.verifyAccount({ service: "exam", provider: "jamb", account: "123" }), { valid: false });
  assert.equal(reply.last.searchParams.get("ProfileID"), "123");
});

test("cable package list is read with our cost; exam list may be empty", async () => {
  ck.__setFetch(
    reply({
      TV_ID: {
        DStv: [{ ID: "dstv", PRODUCT: [{ PACKAGE_ID: "dstv-padi", PACKAGE_NAME: "DStv Padi\nN4,400", PACKAGE_AMOUNT: "4400.00", PRODUCT_DISCOUNT_AMOUNT: "4356" }] }],
        Startimes: [{ ID: "startimes", PRODUCT: [{ PACKAGE_ID: "nova", PACKAGE_NAME: "Nova", PACKAGE_AMOUNT: "2100.00", PRODUCT_DISCOUNT_AMOUNT: "2058" }] }],
      },
    })
  );
  const list = await ck.getCablePackages();
  assert.deepEqual(list[0], { provider: "dstv", code: "dstv-padi", name: "DStv Padi N4,400", amount: 4400, cost: 4356 });
  assert.equal(list[1].provider, "startimes");

  ck.__setFetch(reply({ EXAM_TYPE: [] }));
  assert.deepEqual(await ck.getExamPackages("jamb"), []);
  assert.equal(reply.last.pathname, "/APIJAMBPackagesV2.asp");
  ck.__setFetch(reply({ EXAM_TYPE: [{ PRODUCT_CODE: "waecdirect", PRODUCT_DESCRIPTION: "WAEC Result Checker PIN", PRODUCT_AMOUNT: "5350.00" }] }));
  assert.deepEqual(await ck.getExamPackages("waec"), [{ code: "waecdirect", name: "WAEC Result Checker PIN", amount: 5350 }]);
});

test("prices: cable a little under the network price but never below cost; WAEC N5,450", () => {
  const bills = require("../../src/services/bills");
  assert.equal(bills.cablePrice({ amount: 4400, cost: 4356 }), 4378);
  assert.equal(bills.cablePrice({ amount: 2100, cost: 2058 }), 2079);
  assert.equal(bills.cablePrice({ amount: 1000, cost: 1000 }), 1000);
  assert.equal(bills.examPrice("waec", 5350), 5450);
  assert.equal(bills.examPrice("jamb", 6200), 6300);
  const card = bills.cardTotalKobo(437800);
  assert.ok(card.chargeKobo > 437800 && card.chargeKobo - card.feeKobo === 437800);
});
