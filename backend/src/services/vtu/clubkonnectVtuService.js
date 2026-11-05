// ClubKonnect (Nellobyte Systems) VTU adapter — real airtime and data delivery.
//
// Implemented from ClubKonnect's official API documentation
// (https://www.clubkonnect.com/APIDocs and its sub-pages):
//
//   Base URL: https://www.nellobytesystems.com/  (HTTPS GET, JSON responses)
//   Airtime:  APIAirtimeV1.asp?UserID&APIKey&MobileNetwork&Amount&MobileNumber&RequestID&CallBackURL
//   Data:     APIDatabundleV1.asp?UserID&APIKey&MobileNetwork&DataPlan&MobileNumber&RequestID&CallBackURL
//   Query:    APIQueryV1.asp?UserID&APIKey&OrderID=…   or  &RequestID=…
//   Balance:  APIWalletBalanceV1.asp?UserID&APIKey
//   Plans:    APIDatabundlePlansV2.asp?UserID=…  (our cost per plan)
//             APIDatabundlePlansV3.asp?UserID=…  (adds PRODUCT_CODE)
//   Since late Oct 2026 the DataPlan parameter must be the plan's PRODUCT_CODE
//   (e.g. "5") from PlansV3; the older PRODUCT_ID (e.g. "2000") is rejected
//   with INVALID_DATAPLAN. Plans are stored by PRODUCT_ID, so the code is
//   looked up from PlansV3 (cached) just before each data order.
//   Cable TV: APICableTVV1.asp?…&CableTV&Package&SmartCardNo&PhoneNo&RequestID&CallBackURL
//             APIVerifyCableTVV1.asp?…&CableTV&SmartCardNo  -> {"customer_name": "…" | "INVALID_SMARTCARDNO"}
//             APICableTVPackagesV2.asp?UserID=…  (packages, price, PRODUCT_DISCOUNT_AMOUNT = our cost)
//   Electricity: APIElectricityV1.asp?…&ElectricCompany&MeterType&MeterNo&Amount&PhoneNo&RequestID&CallBackURL
//             APIVerifyElectricityV1.asp?…&ElectricCompany&MeterNo&MeterType -> {"customer_name": …}
//             reply may carry "metertoken"
//   Exam PINs: APIWAECV1.asp / APIJAMBV1.asp ?…&ExamType&PhoneNo&RequestID&CallBackURL
//             APIWAECPackagesV2.asp / APIJAMBPackagesV2.asp ?UserID=… -> {"EXAM_TYPE":[{PRODUCT_CODE,PRODUCT_DESCRIPTION,PRODUCT_AMOUNT}]}
//             APIVerifyJAMBV1.asp?…&ExamType=jamb&ProfileID -> {"customer_name": …}
//             PINs come back in "carddetails": "Serial No:WRN…, pin: 5728…"
//   Network codes: MTN 01, Glo 02, 9mobile 03, Airtel 04
//   Accepted order: {"orderid":"789","statuscode":"100","status":"ORDER_RECEIVED"}
//   Status codes (APIParaGetDisputeResolutionV1): 100 received, 200 completed,
//   201 network unresponsive (auto-retried), 300 processing, 4xx order error
//   (not processed), 5xx cancelled, 6xx on hold (retried up to ~1 hour),
//   899 refunded, x99 unspecified.
//
// Purchases are asynchronous: the first response normally only says the order
// was RECEIVED. The final result arrives on the CallBackURL or by querying.
//
// Secrets: CLUBKONNECT_USER_ID / CLUBKONNECT_API_KEY are read from the
// environment on every call. ClubKonnect takes them in the query string, so
// request URLs are NEVER logged or included in errors.

const BASE_URL = "https://www.nellobytesystems.com";

// ClubKonnect sends numbers as strings, sometimes with thousands separators
// ("8,243.50"). Number("8,243.50") is NaN, so strip commas first.
const num = (v) => {
  const t = String(v ?? "").replace(/,/g, "").trim();
  return t === "" ? NaN : Number(t);
};
const REQUEST_TIMEOUT_MS = Number(process.env.CLUBKONNECT_TIMEOUT_MS || 25000);

const NETWORK_CODES = { MTN: "01", Glo: "02", "9mobile": "03", Airtel: "04" };
const NETWORK_BY_CODE = Object.fromEntries(Object.entries(NETWORK_CODES).map(([k, v]) => [v, k]));

class VtuProviderError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "VtuProviderError";
    this.code = code;
  }
}

// Injectable for automated tests (no real network calls in tests).
let fetchImpl = (...args) => fetch(...args);
const __setFetch = (fn) => {
  fetchImpl = fn || ((...args) => fetch(...args));
};

const credentials = () => {
  const userId = (process.env.CLUBKONNECT_USER_ID || "").trim();
  const apiKey = (process.env.CLUBKONNECT_API_KEY || "").trim();
  if (!userId || !apiKey) throw new VtuProviderError("VTU supplier is not configured.", "not_configured");
  return { userId, apiKey };
};

// 08012345678 / +2348012345678 / 2348012345678 -> 08012345678
const toLocalMsisdn = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length === 13) return `0${digits.slice(3)}`;
  if (digits.length === 11 && digits.startsWith("0")) return digits;
  throw new VtuProviderError("Invalid recipient phone number.", "invalid_phone");
};

const callbackUrl = () => {
  const base = (process.env.APP_URL || "").trim().replace(/\/+$/, "");
  return base.startsWith("https://") ? `${base}/api/vtu/clubkonnect/callback` : "";
};

const NOT_SENT_CODES = ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH", "UND_ERR_CONNECT_TIMEOUT"];

// GET <path>?<params>. Returns parsed JSON. Throws VtuProviderError with
// code "not_sent" (connection never made) | "timeout" | "network" |
// "http_<status>" | "bad_response".
const get = async (path, params) => {
  const url = `${BASE_URL}/${path}?${new URLSearchParams(params).toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(url, { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal });
  } catch (error) {
    const timedOut = error && error.name === "AbortError";
    // Failures while CONNECTING mean the request never left us, so the
    // supplier certainly didn't get it and it is safe to send again at once.
    const cause = (error && error.cause && error.cause.code) || (error && error.code) || "";
    if (!timedOut && NOT_SENT_CODES.includes(cause)) {
      throw new VtuProviderError("Could not connect to the VTU supplier.", "not_sent");
    }
    throw new VtuProviderError(timedOut ? "VTU supplier timed out." : "Could not reach the VTU supplier.", timedOut ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text().catch(() => "");
  if (!response.ok) throw new VtuProviderError(`VTU supplier returned HTTP ${response.status}.`, `http_${response.status}`);
  try {
    return JSON.parse(text.trim());
  } catch {
    throw new VtuProviderError("Unreadable response from the VTU supplier.", "bad_response");
  }
};

// Supplier status -> our outcome:
//   delivered | accepted (not final yet) | failed (definitively not delivered) | unknown
const OUTCOME_BY_CODE = (code) => {
  if (code === 200) return "delivered";
  if ([100, 201, 300, 412].includes(code)) return "accepted";
  if (code === 602) return "failed"; // on hold: "credited back for failed Txn"
  if (code >= 600 && code <= 606) return "accepted"; // on hold, auto-retried
  if (code >= 400 && code <= 418) return "failed"; // order error: not processed
  if (code >= 500 && code <= 598) return "failed"; // cancelled
  if (code === 899) return "failed"; // refunded
  return "unknown"; // 199/299/399/499/599/699/799 and anything new
};

const OUTCOME_BY_TEXT = (status) => {
  const s = String(status || "").trim().toUpperCase();
  // Query answers meaning "no such order on our side" (ClubKonnect replies
  // TRANSACTION_BEYOND_30_DAYS for a RequestID it never received).
  if (["TRANSACTION_BEYOND_30_DAYS", "INVALID_REQUESTID", "INVALID_ORDERID", "ORDER_NOT_FOUND", "TRANSACTION_NOT_FOUND"].includes(s)) return "not_found";
  if (s === "ORDER_COMPLETED") return "unknown"; // completed but no code: confirm by query
  if (["ORDER_RECEIVED", "ORDER_PROCESSING", "ORDER_ONHOLD"].includes(s)) return "accepted";
  if (["ORDER_CANCELLED", "ORDER_REFUNDED"].includes(s)) return "failed";
  if (/^(INVALID_|MISSING_|MINIMUM_|INSUFFICIENT_)/.test(s)) return "failed";
  return "unknown";
};

// Supplier errors that mean our own setup/account needs attention.
const ATTENTION_CODES = new Set([400, 401, 402, 403, 413, 414, 415, 416, 417]);

const cleanText = (v) => {
  const t = typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
  return t && t.length <= 2000 ? t : undefined;
};

const interpret = (body) => {
  const data = body && typeof body === "object" ? body : {};
  const rawCode = data.statuscode ?? data.StatusCode ?? data.status_code;
  const code = rawCode !== undefined && rawCode !== "" && Number.isFinite(Number(rawCode)) ? Number(rawCode) : null;
  const status = data.status ?? data.orderstatus ?? data.OrderStatus ?? "";
  const outcome = code !== null ? OUTCOME_BY_CODE(code) : OUTCOME_BY_TEXT(status);
  const orderId = data.orderid ?? data.OrderID ?? data.orderId;
  const charged = num(data.amountcharged ?? data.AmountCharged);
  return {
    outcome,
    reference: orderId ? String(orderId) : null,
    statusCode: code,
    status: String(status || ""),
    remark: typeof (data.remark ?? data.orderremark) === "string" ? (data.remark ?? data.orderremark).slice(0, 200) : undefined,
    amountCharged: Number.isFinite(charged) && charged > 0 ? charged : undefined,
    token: cleanText(data.metertoken ?? data.MeterToken ?? data.token ?? data.Token),
    cardDetails: cleanText(data.carddetails ?? data.CardDetails ?? data.pins),
    attention: code !== null ? ATTENTION_CODES.has(code) : /^(INVALID_CREDENTIALS|MISSING_|INSUFFICIENT_)/.test(String(status).toUpperCase()),
  };
};

// PRODUCT_ID -> PRODUCT_CODE per network, from PlansV3. Cached briefly.
const CODE_CACHE_MS = 10 * 60 * 1000;
let codeCache = { at: 0, map: null };
const __resetPlanCodes = () => {
  codeCache = { at: 0, map: null };
};

const loadPlanCodes = async () => {
  if (codeCache.map && Date.now() - codeCache.at < CODE_CACHE_MS) return codeCache.map;
  const { userId } = credentials();
  const body = await get("APIDatabundlePlansV3.asp", { UserID: userId });
  const networks = (body && body.MOBILE_NETWORK) || {};
  const map = new Map();
  for (const entries of Object.values(networks)) {
    for (const entry of Array.isArray(entries) ? entries : []) {
      for (const p of Array.isArray(entry.PRODUCT) ? entry.PRODUCT : []) {
        if (p && p.PRODUCT_ID && p.PRODUCT_CODE) map.set(`${String(entry.ID)}|${String(p.PRODUCT_ID)}`, String(p.PRODUCT_CODE));
      }
    }
  }
  if (map.size === 0) throw new VtuProviderError("Supplier plan list is empty or unreadable.", "bad_response");
  codeCache = { at: Date.now(), map };
  return map;
};

// The DataPlan value ClubKonnect accepts for one of our plans, or null if the
// plan is no longer offered.
const dataPlanCode = async (networkCode, planId) => {
  const map = await loadPlanCodes();
  return map.get(`${networkCode}|${planId}`) || null;
};

// purchase({ type, network, phone, amount, plan, requestId })
//   -> { outcome, reference, statusCode, status, attention }
// Throws VtuProviderError on timeout/network/unreadable responses; the order
// lifecycle treats that as "unknown" (may have been delivered) and reconciles
// it later by RequestID instead of retrying.
const BILL_TYPES = ["cable", "electricity", "exam"];

const purchase = async ({ type, network, phone, amount, plan, requestId, transaction }) => {
  if (BILL_TYPES.includes(type)) return purchaseBill({ type, phone, requestId, transaction });
  const networkCode = NETWORK_CODES[network];
  if (!networkCode) return { outcome: "failed", errorCode: "unsupported_network" };
  if (!requestId) return { outcome: "failed", errorCode: "missing_request_id" };

  let mobileNumber;
  try {
    mobileNumber = toLocalMsisdn(phone);
  } catch {
    return { outcome: "failed", errorCode: "invalid_phone" };
  }

  const { userId, apiKey } = credentials();
  const params = { UserID: userId, APIKey: apiKey, MobileNetwork: networkCode, MobileNumber: mobileNumber, RequestID: requestId };
  const cb = callbackUrl();

  let path;
  if (type === "airtime") {
    if (!Number.isInteger(amount) || amount < 50 || amount > 200000) return { outcome: "failed", errorCode: "invalid_amount" };
    path = "APIAirtimeV1.asp";
    params.Amount = String(amount);
  } else if (type === "data") {
    const planId = plan && plan.providerPlanId;
    if (!planId) return { outcome: "failed", errorCode: "plan_not_mapped" };
    // Nothing has been sent yet, so a failed lookup is a safe, definite
    // failure (the order is refunded, never left "unknown").
    let code;
    try {
      code = await dataPlanCode(networkCode, String(planId));
    } catch {
      // Nothing was sent: the plan list couldn't be fetched.
      return { outcome: "failed", errorCode: "plan_lookup_failed", notSent: true };
    }
    if (!code) return { outcome: "failed", errorCode: "plan_unavailable" };
    path = "APIDatabundleV1.asp";
    params.DataPlan = code;
  } else {
    return { outcome: "failed", errorCode: "unsupported_type" };
  }
  if (cb) params.CallBackURL = cb;

  const result = interpret(await get(path, params));
  return { ...result, errorCode: result.outcome === "failed" ? `supplier_${result.statusCode ?? result.status}` : undefined };
};

// queryStatus({ transaction }) -> same shape as purchase. Uses the supplier's
// OrderID when we have it, otherwise our RequestID (= transactionId).
const queryStatus = async ({ transaction }) => {
  const { userId, apiKey } = credentials();
  const params = { UserID: userId, APIKey: apiKey };
  if (transaction.providerReference) params.OrderID = transaction.providerReference;
  else params.RequestID = transaction.transactionId;
  return interpret(await get("APIQueryV1.asp", params));
};

// Cable TV, electricity and exam PINs. The order's own fields (set and
// validated by our server when the order was created) say what to buy.
const purchaseBill = async ({ type, phone, requestId, transaction: tx }) => {
  if (!requestId || !tx) return { outcome: "failed", errorCode: "missing_request_id", notSent: true };
  let phoneNo;
  try {
    phoneNo = toLocalMsisdn(phone);
  } catch {
    return { outcome: "failed", errorCode: "invalid_phone", notSent: true };
  }
  const { userId, apiKey } = credentials();
  const params = { UserID: userId, APIKey: apiKey, PhoneNo: phoneNo, RequestID: requestId };
  let path;
  if (type === "cable") {
    if (!tx.serviceCode || !tx.packageCode || !tx.account) return { outcome: "failed", errorCode: "bad_order", notSent: true };
    path = "APICableTVV1.asp";
    Object.assign(params, { CableTV: tx.serviceCode, Package: tx.packageCode, SmartCardNo: tx.account });
  } else if (type === "electricity") {
    const face = Math.round((tx.faceAmountKobo || 0) / 100);
    if (!tx.serviceCode || !tx.meterType || !tx.account || !(face > 0)) return { outcome: "failed", errorCode: "bad_order", notSent: true };
    path = "APIElectricityV1.asp";
    Object.assign(params, { ElectricCompany: tx.serviceCode, MeterType: tx.meterType, MeterNo: tx.account, Amount: String(face) });
  } else {
    const exam = tx.serviceCode;
    if (!["waec", "jamb"].includes(exam) || !tx.packageCode) return { outcome: "failed", errorCode: "bad_order", notSent: true };
    path = exam === "jamb" ? "APIJAMBV1.asp" : "APIWAECV1.asp";
    params.ExamType = tx.packageCode;
    if (exam === "jamb" && tx.account) params.ProfileID = tx.account;
  }
  const cb = callbackUrl();
  if (cb) params.CallBackURL = cb;
  const result = interpret(await get(path, params));
  return { ...result, errorCode: result.outcome === "failed" ? `supplier_${result.statusCode ?? result.status}` : undefined };
};

// Checks a smartcard / meter / JAMB profile number before payment.
//   -> { valid: true, name } | { valid: false }
// Throws VtuProviderError when the supplier can't be reached.
const verifyAccount = async ({ service, provider, account, meterType }) => {
  const { userId, apiKey } = credentials();
  let path;
  const params = { UserID: userId, APIKey: apiKey };
  if (service === "cable") {
    path = "APIVerifyCableTVV1.asp";
    Object.assign(params, { CableTV: provider, SmartCardNo: account });
  } else if (service === "electricity") {
    path = "APIVerifyElectricityV1.asp";
    Object.assign(params, { ElectricCompany: provider, MeterNo: account, MeterType: meterType });
  } else if (service === "exam" && provider === "jamb") {
    path = "APIVerifyJAMBV1.asp";
    Object.assign(params, { ExamType: "jamb", ProfileID: account });
  } else {
    throw new VtuProviderError("Nothing to verify.", "unsupported");
  }
  const body = await get(path, params);
  const name = String((body && (body.customer_name ?? body.CustomerName ?? body.name)) || "").trim();
  if (!name || /^(INVALID|MISSING|ERROR|NOT_)/i.test(name)) return { valid: false };
  return { valid: true, name: name.slice(0, 120) };
};

// Every {ID, PRODUCT:[…]} group anywhere in a supplier catalog response.
const productGroups = (node, out = []) => {
  if (Array.isArray(node)) node.forEach((n) => productGroups(n, out));
  else if (node && typeof node === "object") {
    if (node.ID && Array.isArray(node.PRODUCT)) out.push(node);
    else Object.values(node).forEach((n) => productGroups(n, out));
  }
  return out;
};

// Cable packages with our cost. -> [{ provider: "dstv", code, name, amount, cost }]
const getCablePackages = async () => {
  const { userId } = credentials();
  const body = await get("APICableTVPackagesV2.asp", { UserID: userId });
  const out = [];
  for (const group of productGroups(body)) {
    const provider = String(group.ID).toLowerCase();
    for (const p of group.PRODUCT) {
      const amount = num(p.PACKAGE_AMOUNT);
      const cost = num(p.PRODUCT_DISCOUNT_AMOUNT);
      if (!p.PACKAGE_ID || !Number.isFinite(amount) || amount <= 0) continue;
      out.push({
        provider,
        code: String(p.PACKAGE_ID),
        name: String(p.PACKAGE_NAME || "").replace(/\s+/g, " ").trim(),
        amount,
        cost: Number.isFinite(cost) && cost > 0 && cost <= amount ? cost : amount,
      });
    }
  }
  if (!out.length) throw new VtuProviderError("Cable package list is empty or unreadable.", "bad_response");
  return out;
};

// Exam PIN products. exam: "waec" | "jamb". -> [{ code, name, amount }] (may be empty)
const getExamPackages = async (exam) => {
  const { userId } = credentials();
  const body = await get(exam === "jamb" ? "APIJAMBPackagesV2.asp" : "APIWAECPackagesV2.asp", { UserID: userId });
  const list = Array.isArray(body && body.EXAM_TYPE) ? body.EXAM_TYPE : [];
  return list
    .map((p) => ({ code: String(p.PRODUCT_CODE || ""), name: String(p.PRODUCT_DESCRIPTION || "").trim(), amount: num(p.PRODUCT_AMOUNT) }))
    .filter((p) => p.code && Number.isFinite(p.amount) && p.amount > 0);
};

const getBalance = async () => {
  const { userId, apiKey } = credentials();
  const body = await get("APIWalletBalanceV1.asp", { UserID: userId, APIKey: apiKey });
  const balance = num(body && body.balance);
  if (!Number.isFinite(balance)) {
    const status = body && (body.status || body.statuscode);
    throw new VtuProviderError(`Balance check failed${status ? ` (${status})` : ""}.`, "balance_failed");
  }
  return { balance };
};

// Data plans with the price ClubKonnect charges this account, from PlansV3:
//   PRODUCT_AMOUNT           network price for DIRECT bundles, our price for SME
//   PRODUCT_DISCOUNT_AMOUNT  multiplier for our cost (e.g. "0.97" = 3% off; "1" for SME)
//   DATA_TYPE                "SME" | "DIRECT" | …
// -> [{ network, networkCode, providerPlanId, providerPlanCode, name, cost, networkPrice, dataType }]
const getDataPlans = async () => {
  const { userId, apiKey } = credentials();
  const body = await get("APIDatabundlePlansV3.asp", { UserID: userId, APIKey: apiKey });
  const networks = (body && body.MOBILE_NETWORK) || {};
  const plans = [];
  for (const entries of Object.values(networks)) {
    for (const entry of Array.isArray(entries) ? entries : []) {
      const network = NETWORK_BY_CODE[String(entry.ID)];
      if (!network) continue;
      for (const p of Array.isArray(entry.PRODUCT) ? entry.PRODUCT : []) {
        const amount = num(p.PRODUCT_AMOUNT);
        const rawFactor = num(p.PRODUCT_DISCOUNT_AMOUNT);
        const factor = Number.isFinite(rawFactor) && rawFactor > 0 && rawFactor <= 1 ? rawFactor : 1;
        if (!p.PRODUCT_ID || !Number.isFinite(amount) || amount <= 0) continue;
        const dataType = String(p.DATA_TYPE || "").toUpperCase();
        plans.push({
          network,
          networkCode: String(entry.ID),
          providerPlanId: String(p.PRODUCT_ID),
          providerPlanCode: p.PRODUCT_CODE ? String(p.PRODUCT_CODE) : null,
          name: String(p.PRODUCT_NAME || "").trim(),
          cost: Math.round(amount * factor * 100) / 100,
          networkPrice: dataType === "DIRECT" ? amount : null,
          dataType,
        });
      }
    }
  }
  return plans;
};

module.exports = {
  name: "clubkonnect",
  simulated: false,
  requiresPlanMapping: true,
  purchase,
  queryStatus,
  getBalance,
  getDataPlans,
  verifyAccount,
  getCablePackages,
  getExamPackages,
  interpret,
  toLocalMsisdn,
  NETWORK_CODES,
  VtuProviderError,
  __setFetch,
  __resetPlanCodes,
  dataPlanCode,
};
