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
//   Plans:    APIDatabundlePlansV2.asp?UserID=…
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

// GET <path>?<params>. Returns parsed JSON. Throws VtuProviderError with
// code "timeout" | "network" | "http_<status>" | "bad_response".
const get = async (path, params) => {
  const url = `${BASE_URL}/${path}?${new URLSearchParams(params).toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(url, { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal });
  } catch (error) {
    const timedOut = error && error.name === "AbortError";
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
  if (s === "ORDER_COMPLETED") return "unknown"; // completed but no code: confirm by query
  if (["ORDER_RECEIVED", "ORDER_PROCESSING", "ORDER_ONHOLD"].includes(s)) return "accepted";
  if (["ORDER_CANCELLED", "ORDER_REFUNDED"].includes(s)) return "failed";
  if (/^(INVALID_|MISSING_|MINIMUM_|INSUFFICIENT_)/.test(s)) return "failed";
  return "unknown";
};

// Supplier errors that mean our own setup/account needs attention.
const ATTENTION_CODES = new Set([400, 401, 402, 403, 413, 414, 415, 416, 417]);

const interpret = (body) => {
  const data = body && typeof body === "object" ? body : {};
  const rawCode = data.statuscode ?? data.StatusCode ?? data.status_code;
  const code = rawCode !== undefined && rawCode !== "" && Number.isFinite(Number(rawCode)) ? Number(rawCode) : null;
  const status = data.status ?? data.orderstatus ?? data.OrderStatus ?? "";
  const outcome = code !== null ? OUTCOME_BY_CODE(code) : OUTCOME_BY_TEXT(status);
  const orderId = data.orderid ?? data.OrderID ?? data.orderId;
  const charged = Number(data.amountcharged ?? data.AmountCharged);
  return {
    outcome,
    reference: orderId ? String(orderId) : null,
    statusCode: code,
    status: String(status || ""),
    remark: typeof (data.remark ?? data.orderremark) === "string" ? (data.remark ?? data.orderremark).slice(0, 200) : undefined,
    amountCharged: Number.isFinite(charged) && charged > 0 ? charged : undefined,
    attention: code !== null ? ATTENTION_CODES.has(code) : /^(INVALID_CREDENTIALS|MISSING_|INSUFFICIENT_)/.test(String(status).toUpperCase()),
  };
};

// purchase({ type, network, phone, amount, plan, requestId })
//   -> { outcome, reference, statusCode, status, attention }
// Throws VtuProviderError on timeout/network/unreadable responses; the order
// lifecycle treats that as "unknown" (may have been delivered) and reconciles
// it later by RequestID instead of retrying.
const purchase = async ({ type, network, phone, amount, plan, requestId }) => {
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
    path = "APIDatabundleV1.asp";
    params.DataPlan = String(planId);
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

const getBalance = async () => {
  const { userId, apiKey } = credentials();
  const body = await get("APIWalletBalanceV1.asp", { UserID: userId, APIKey: apiKey });
  const balance = Number(body && body.balance);
  if (!Number.isFinite(balance)) {
    const status = body && (body.status || body.statuscode);
    throw new VtuProviderError(`Balance check failed${status ? ` (${status})` : ""}.`, "balance_failed");
  }
  return { balance };
};

// Data plans with the price ClubKonnect charges this account.
// -> [{ network, networkCode, providerPlanId, name, cost }]
const getDataPlans = async () => {
  const { userId } = credentials();
  const body = await get("APIDatabundlePlansV2.asp", { UserID: userId });
  const networks = (body && body.MOBILE_NETWORK) || {};
  const plans = [];
  for (const entries of Object.values(networks)) {
    for (const entry of Array.isArray(entries) ? entries : []) {
      const network = NETWORK_BY_CODE[String(entry.ID)];
      if (!network) continue;
      for (const p of Array.isArray(entry.PRODUCT) ? entry.PRODUCT : []) {
        const cost = Number(p.PRODUCT_AMOUNT);
        if (!p.PRODUCT_ID || !Number.isFinite(cost) || cost <= 0) continue;
        plans.push({
          network,
          networkCode: String(entry.ID),
          providerPlanId: String(p.PRODUCT_ID),
          name: String(p.PRODUCT_NAME || "").trim(),
          cost: Math.round(cost * 100) / 100,
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
  interpret,
  toLocalMsisdn,
  NETWORK_CODES,
  VtuProviderError,
  __setFetch,
};
