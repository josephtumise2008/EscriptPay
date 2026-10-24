// Outgoing email (verification codes, password resets).
//
// Provider: Resend (https://resend.com) — POST https://api.resend.com/emails
// with "Authorization: Bearer <RESEND_API_KEY>" and a JSON body
// { from, to, subject, html, text }.
//
// Environment:
//   RESEND_API_KEY   secret, backend only
//   EMAIL_FROM       e.g. "EscriptPay <no-reply@escriptpay.com>" (domain must
//                    be verified in Resend)
// When not configured, emails are not sent: in development the content is
// printed to the server console instead so you can still test the flows.
// The API key is never logged.

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS || 10000);

let fetchImpl = (...args) => fetch(...args);
const __setFetch = (fn) => {
  fetchImpl = fn || ((...args) => fetch(...args));
};

const isConfigured = () => Boolean((process.env.RESEND_API_KEY || "").trim() && (process.env.EMAIL_FROM || "").trim());

class EmailError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "EmailError";
    this.code = code;
  }
}

// Returns { sent: true, id } | { sent: false, reason }. Throws EmailError on
// provider failures so callers can decide whether that is fatal.
const sendEmail = async ({ to, subject, html, text }) => {
  if (!isConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[email not configured] To: ${to}\nSubject: ${subject}\n${text}\n`);
    }
    return { sent: false, reason: "not_configured" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: process.env.EMAIL_FROM.trim(), to: [to], subject, html, text }),
      signal: controller.signal,
    });
  } catch (error) {
    throw new EmailError("Could not reach the email service.", error && error.name === "AbortError" ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new EmailError(`Email service returned HTTP ${response.status}.`, `http_${response.status}`);
  return { sent: true, id: body && body.id };
};

module.exports = { sendEmail, isConfigured, EmailError, __setFetch };
