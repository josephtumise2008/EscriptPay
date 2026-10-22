// Minimal structured logger for payment/fulfilment events.
//
// Log identifiers and states only. Never pass phone numbers, emails, card
// data, provider secrets, raw webhook bodies or full provider responses.
const logEvent = (event, fields = {}) => {
  if (process.env.NODE_ENV === "test" && process.env.LOG_IN_TESTS !== "true") return;
  try {
    console.log(JSON.stringify({ at: new Date().toISOString(), event, ...fields }));
  } catch {
    console.log(`[${event}]`);
  }
};

module.exports = { logEvent };
