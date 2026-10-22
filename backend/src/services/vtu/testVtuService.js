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

const purchase = async () => {
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

module.exports = { name: "test", simulated: true, purchase, queryStatus, purchaseData };
