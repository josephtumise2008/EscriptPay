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

module.exports = { sweep };
