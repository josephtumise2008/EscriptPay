// Owner alerts by email:
//   - orders / wallet top-ups that need a human (paid but not delivered,
//     blocked foreign card, failed automatic refund, ...) — each one once
//   - supplier (ClubKonnect) balance below LOW_BALANCE_ALERT_NAIRA
//     (default 3000) — at most once every 6 hours while it stays low
//
// Recipients: ALERT_EMAIL (comma-separated) if set, otherwise every admin
// account. Sent through the normal email service (Resend).
const Transaction = require("../models/Transaction");
const WalletEntry = require("../models/WalletEntry");
const User = require("../models/User");
const AlertState = require("../models/AlertState");
const { vtu, config } = require("./index");
const { sendEmail } = require("./email");
const { logEvent } = require("../utils/logger");

const LOW_BALANCE_REPEAT_MS = 6 * 60 * 60 * 1000;

const escape = (s) =>
  String(s == null ? "" : s).replace(/[&<>"\']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "\'": "&#39;" })[c]);

const recipients = async () => {
  const fromEnv = (process.env.ALERT_EMAIL || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  const admins = await User.find({ role: "admin" }).select("email").lean();
  return admins.map((a) => a.email).filter(Boolean);
};

const sendToOwner = async (subject, lines) => {
  const to = await recipients();
  if (!to.length) return 0;
  const text = `${lines.join("\n")}\n\nOpen the Business page: ${config.appUrl}/admin`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">
<p style="font-size:16px;font-weight:bold">${escape(subject)}</p>
<ul>${lines.map((l) => `<li style="margin:6px 0">${escape(l)}</li>`).join("")}</ul>
<p><a href="${escape(config.appUrl)}/admin">Open the Business page</a></p></div>`;
  let sent = 0;
  for (const address of to) {
    try {
      const r = await sendEmail({ to: address, subject, html, text });
      if (r.sent) sent += 1;
    } catch (error) {
      logEvent("alerts.email_failed", { code: error && error.code });
    }
  }
  return sent;
};

const naira = (kobo) => `N${(kobo / 100).toLocaleString("en-NG")}`;

const reviewAlerts = async () => {
  const mode = config.paymentMode;
  const [orders, fundings] = await Promise.all([
    Transaction.find({ mode, needsReview: true, alertedAt: { $exists: false } }).limit(20).lean(),
    WalletEntry.find({ mode, kind: "funding", needsReview: true, alertedAt: { $exists: false } }).limit(20).lean(),
  ]);
  if (!orders.length && !fundings.length) return 0;

  const reason = (r) => (r ? r.replace(/_/g, " ") : "needs a look");
  const lines = [
    ...orders.map(
      (t) =>
        `${t.transactionId}: ${t.network} ${t.type === "airtime" ? "airtime" : t.plan || "data"} N${t.amount} to ${t.phone} (${reason(t.failureReason)}${
          t.cardCountry ? `, card from ${t.cardCountry}` : ""
        }${t.refundStatus ? `, refund ${t.refundStatus}` : ""})`
    ),
    ...fundings.map(
      (e) =>
        `${e.reference}: wallet top-up ${naira(e.chargedKobo || e.amountKobo)} (${reason(e.failureReason)}${
          e.cardCountry ? `, card from ${e.cardCountry}` : ""
        }${e.refundStatus ? `, refund ${e.refundStatus}` : ""})`
    ),
  ];
  const count = lines.length;
  const sent = await sendToOwner(`EscriptPay: ${count} payment${count === 1 ? "" : "s"} need${count === 1 ? "s" : ""} your attention`, lines);
  if (sent > 0) {
    const now = new Date();
    await Promise.all([
      orders.length && Transaction.updateMany({ _id: { $in: orders.map((t) => t._id) } }, { $set: { alertedAt: now } }),
      fundings.length && WalletEntry.updateMany({ _id: { $in: fundings.map((e) => e._id) } }, { $set: { alertedAt: now } }),
    ]);
  }
  return sent > 0 ? count : 0;
};

const lowBalanceAlert = async () => {
  if (typeof vtu.getBalance !== "function" || vtu.simulated) return null;
  const threshold = Number(process.env.LOW_BALANCE_ALERT_NAIRA || 3000);
  let balance;
  try {
    balance = (await vtu.getBalance()).balance;
  } catch (error) {
    logEvent("alerts.balance_check_failed", { code: error && error.code });
    return null;
  }
  if (!(balance < threshold)) return { balance, alerted: false };

  const key = "low_supplier_balance";
  const state = await AlertState.findOne({ key }).lean();
  if (state && state.lastSentAt && Date.now() - new Date(state.lastSentAt).getTime() < LOW_BALANCE_REPEAT_MS) {
    return { balance, alerted: false };
  }
  const sent = await sendToOwner(`EscriptPay: ${vtu.name} balance is low (N${balance.toLocaleString("en-NG")})`, [
    `Your ${vtu.name} balance is N${balance.toLocaleString("en-NG")}, below your alert level of N${threshold.toLocaleString("en-NG")}.`,
    "When it runs out, data and airtime orders fail (wallet customers are refunded automatically). Fund it soon.",
  ]);
  if (sent > 0) await AlertState.updateOne({ key }, { $set: { lastSentAt: new Date() } }, { upsert: true });
  return { balance, alerted: sent > 0 };
};

const runAlerts = async () => {
  const [review, balance] = await Promise.all([
    reviewAlerts().catch((e) => {
      logEvent("alerts.review_failed", { message: e && e.message });
      return 0;
    }),
    lowBalanceAlert().catch(() => null),
  ]);
  return { reviewAlerts: review, supplierBalance: balance ? balance.balance : null, lowBalanceAlerted: Boolean(balance && balance.alerted) };
};

module.exports = { runAlerts, reviewAlerts, lowBalanceAlert };
