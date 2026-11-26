const crypto = require("crypto");
const { refreshStaleOrders } = require("../services/orderStatus");
const { runAlerts } = require("../services/alerts");
const { logEvent } = require("../utils/logger");

// GET /api/cron/sweep  (Authorization: Bearer <CRON_SECRET>)
//
// Called every few minutes by a scheduler (cron-job.org, or Vercel Cron,
// which sends this header automatically when CRON_SECRET is set):
//   1. brings unfinished orders up to date and refunds wallet orders the
//      supplier never received, without waiting for anyone to open a page
//   2. emails the owner about anything that needs review, and a low
//      supplier balance
const authorized = (req) => {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const header = req.get("authorization") || "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header.trim());
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

const sweep = async (req, res) => {
  if (!(process.env.CRON_SECRET || "").trim()) {
    return res.status(503).json({ success: false, message: "Scheduled checks are not configured." });
  }
  if (!authorized(req)) return res.status(401).json({ success: false });
  const started = Date.now();
  try {
    const checked = await refreshStaleOrders({}, { limit: 30 });
    const alerts = await runAlerts();
    const result = { checkedOrders: checked, ...alerts, ms: Date.now() - started };
    logEvent("cron.sweep", result);
    return res.json({ success: true, ...result });
  } catch (error) {
    logEvent("cron.sweep_error", { message: error && error.message });
    return res.status(500).json({ success: false });
  }
};

// GET /api/cron/backup  (Authorization: Bearer <CRON_SECRET>) — once a day.
// Emails a locked copy of the whole database to the owner; a failure emails
// an alert instead.
const backup = async (req, res) => {
  if (!(process.env.CRON_SECRET || "").trim()) {
    return res.status(503).json({ success: false, message: "Scheduled checks are not configured." });
  }
  if (!authorized(req)) return res.status(401).json({ success: false });
  try {
    const result = await require("../services/backup").runBackup();
    const AlertState = require("../models/AlertState");
    await AlertState.updateOne({ key: "last_backup" }, { $set: { lastSentAt: new Date() } }, { upsert: true });
    return res.json({ success: true, bytes: result.bytes, records: result.counts });
  } catch (error) {
    logEvent("backup.failed", { code: error && error.code, message: error && error.message });
    await require("../services/alerts")
      .sendToOwner("EscriptPay: last night's database backup FAILED", [
        `Reason: ${(error && error.message) || "unknown error"}`,
        "Your site is still working; only the backup copy is missing. Check BACKUP_PASSPHRASE and the email settings in Vercel.",
      ])
      .catch(() => {});
    return res.status(500).json({ success: false, code: (error && error.code) || "backup_failed" });
  }
};

// GET /api/cron/gift-push?slot=morning|evening  (same Authorization header).
// morning (about 8am WAT): "buy your data today" (+ today's gift box).
// evening (about 6pm WAT): "invite friends and earn". Both go to every
// subscribed browser, at most once a day each.
const giftPush = async (req, res) => {
  if (!(process.env.CRON_SECRET || "").trim()) {
    return res.status(503).json({ success: false, message: "Scheduled checks are not configured." });
  }
  if (!authorized(req)) return res.status(401).json({ success: false });
  const slot = String(req.query.slot || "").trim().toLowerCase();
  if (!["morning", "evening"].includes(slot)) {
    return res.status(400).json({ success: false, message: "slot must be morning or evening." });
  }
  try {
    const { createGiftPush } = require("../services/giftPush");
    const { createPushService } = require("../services/push");
    const { config } = require("../services");
    const runner = createGiftPush({
      push: createPushService({ logEvent }),
      AlertState: require("../models/AlertState"),
      appUrl: config.appUrl,
      logEvent,
    });
    const result = await runner.run({ slot, mode: config.paymentMode });
    logEvent("cron.gift_push", result);
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(502).json({ success: false, message: "Push service error.", status: error && error.status });
  }
};

module.exports = { sweep, backup, giftPush };
