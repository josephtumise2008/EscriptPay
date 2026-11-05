// Test VTU service.
//
// TEST MODE: simulates delivery. No data or airtime is really delivered and no
// supplier is contacted. A real supplier adapter must implement the same
// interface (see services/index.js) from the supplier's official docs.
//
// For manual testing of failure handling (never in production), set
//   TEST_VTU_OUTCOME=delivered|accepted|failed|unknown|timeout

const crypto = require("crypto");

const OUTCOMES = ["delivered", "accepted", "failed", "unknown", "timeout"];

const forcedOutcome = () => {
  if (process.env.NODE_ENV === "production") return "delivered";
  const value = (process.env.TEST_VTU_OUTCOME || "").trim().toLowerCase();
  return OUTCOMES.includes(value) ? value : "delivered";
};

const purchase = async ({ type } = {}) => {
  const delay = Number(process.env.TEST_VTU_DELAY_MS ?? 1200);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

  const outcome = forcedOutcome();
  if (outcome === "timeout") {
    const error = new Error("Simulated supplier timeout.");
    error.code = "timeout";
    throw error;
  }

  return {
    outcome,
    ...(outcome === "delivered" && type === "electricity" ? { token: "1234-5678-9012-3456-7890" } : {}),
    ...(outcome === "delivered" && type === "exam" ? { cardDetails: "Serial No:WRN000000001, pin: 123456789012" } : {}),
    reference: `VTU-TEST-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    simulated: true,
    message: "Test mode: VTU delivery simulated.",
  };
};

// The simulated supplier "knows" every order it accepted was delivered.
const queryStatus = async ({ transaction }) => ({
  outcome: "delivered",
  reference: transaction?.providerReference || null,
  simulated: true,
});

// Original interface, kept for backward compatibility.
const purchaseData = async (args) => {
  const result = await purchase(args);
  const providerStatus =
    result.outcome === "delivered" ? "successful" : result.outcome === "failed" ? "failed" : "pending";
  return { providerStatus, reference: result.reference, delivered: false, message: result.message };
};

// Simulated bill catalog and account checks. Numbers starting with 0000 are
// "invalid" so the error path can be tried.
const verifyAccount = async ({ account }) => (/^0000/.test(String(account)) ? { valid: false } : { valid: true, name: "TEST CUSTOMER" });

const getCablePackages = async () => [
  { provider: "dstv", code: "dstv-padi", name: "DStv Padi", amount: 4400, cost: 4356 },
  { provider: "dstv", code: "dstv-yanga", name: "DStv Yanga", amount: 6000, cost: 5940 },
  { provider: "gotv", code: "gotv-smallie", name: "GOtv Smallie - monthly", amount: 1900, cost: 1881 },
  { provider: "startimes", code: "nova", name: "Nova (Dish) - 1 Month", amount: 2100, cost: 2058 },
];

const getExamPackages = async (exam) =>
  exam === "waec" ? [{ code: "waecdirect", name: "WAEC Result Checker PIN", amount: 5350 }] : [];

module.exports = { name: "test", simulated: true, purchase, queryStatus, purchaseData, verifyAccount, getCablePackages, getExamPackages };
