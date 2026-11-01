// Admin-only business overview: sales, costs, profit, orders needing a
// person, supplier balance and contact messages. Routes are protected by
// requireAuth + requireAdmin (role stored in the database).
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const ContactMessage = require("../models/ContactMessage");
const WalletEntry = require("../models/WalletEntry");
const { vtu, config } = require("../services");
const { providerFee } = require("../services/walletFee");
const { logEvent } = require("../utils/logger");

const LAGOS_OFFSET_MS = 60 * 60 * 1000; // WAT = UTC+1, no daylight saving
const dayKey = (date) => new Date(new Date(date).getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
const startOfLagosDay = (daysAgo) => {
  const now = new Date(Date.now() + LAGOS_OFFSET_MS);
  now.setUTCHours(0, 0, 0, 0);
  return new Date(now.getTime() - daysAgo * 86400000 - LAGOS_OFFSET_MS);
};

// GET /api/admin/overview?days=30
const overview = async (req, res) => {
  try {
    await require("../services/orderStatus").refreshStaleOrders({}, { limit: 20 }).catch(() => {});
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
    const since = startOfLagosDay(days - 1);
    const mode = config.paymentMode;

    const delivered = await Transaction.find({ mode, status: "successful", createdAt: { $gte: since } })
      .select("amount paymentAmountKobo paymentProvider costKobo costSource type createdAt")
      .lean();

    const fee = { percent: 1.5, flatKobo: 10000, flatThresholdKobo: 250000, capKobo: 200000, ...(config.walletFee || {}) };
    const byDay = {};
    for (let i = days - 1; i >= 0; i -= 1) byDay[dayKey(startOfLagosDay(i))] = { sales: 0, cost: 0, fees: 0, profit: 0, orders: 0 };
    const totals = { sales: 0, cost: 0, fees: 0, profit: 0, orders: 0, data: 0, airtime: 0, unknownCost: 0 };

    for (const tx of delivered) {
      const salesK = tx.paymentAmountKobo || Math.round(tx.amount * 100);
      const costK = Number.isFinite(tx.costKobo) ? tx.costKobo : null;
      // Card orders: we pay the processor's fee. Wallet orders: the fee was
      // on the top-up (counted below).
      const feeK = tx.paymentProvider === "paystack" ? providerFee(salesK, fee) : 0;
      const profitK = costK === null ? 0 : salesK - costK - feeK;
      const d = byDay[dayKey(tx.createdAt)];
      for (const bucket of [totals, d].filter(Boolean)) {
        bucket.sales += salesK;
        bucket.cost += costK || 0;
        bucket.fees += feeK;
        bucket.profit += profitK;
        bucket.orders += 1;
      }
      totals[tx.type] += 1;
      if (costK === null) totals.unknownCost += 1;
    }

    // Card top-ups: whatever part of the processor's fee the customer didn't
    // pay (all of it when the top-up fee is switched off) is our cost.
    const fundings = await WalletEntry.find({ mode, kind: "funding", status: "successful", paymentProvider: "paystack", createdAt: { $gte: since } })
      .select("amountKobo chargedKobo feeKobo createdAt")
      .lean();
    for (const f of fundings) {
      const chargedK = f.chargedKobo || f.amountKobo;
      const absorbedK = Math.max(0, providerFee(chargedK, fee) - (f.feeKobo || 0));
      if (!absorbedK) continue;
      const d = byDay[dayKey(f.createdAt)];
      for (const bucket of [totals, d].filter(Boolean)) {
        bucket.fees += absorbedK;
        bucket.profit -= absorbedK;
      }
    }

    const toNaira = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, ["orders", "data", "airtime", "unknownCost"].includes(k) ? v : v / 100]));

    const [needsReview, pending, walletAgg, newMessages, failedRecent, blockedFundings] = await Promise.all([
      Transaction.find({ mode, needsReview: true }).sort({ updatedAt: -1 }).limit(50).populate("user", "name email").lean(),
      Transaction.countDocuments({ mode, status: "pending" }),
      User.aggregate([{ $group: { _id: null, total: { $sum: `$walletBalances.${mode}` } } }]),
      ContactMessage.find({ status: "new" }).sort({ createdAt: -1 }).limit(30).lean(),
      Transaction.countDocuments({ mode, status: "failed", createdAt: { $gte: since } }),
      // Wallet top-ups that were paid but not credited (foreign card, amount
      // mismatch). Read-only here: refunds happen in Paystack.
      WalletEntry.find({ mode, kind: "funding", needsReview: true }).sort({ updatedAt: -1 }).limit(20).populate("user", "name email").lean(),
    ]);
    const walletLiability = walletAgg[0] ? walletAgg[0].total / 100 : 0;

    let supplier = { name: vtu.name, simulated: vtu.simulated === true, balance: null };
    if (typeof vtu.getBalance === "function") {
      try {
        supplier.balance = (await vtu.getBalance()).balance;
      } catch (error) {
        supplier.error = "Could not check the supplier balance right now.";
        logEvent("admin.supplier_balance_error", { code: error && error.code });
      }
    }

    return res.json({
      success: true,
      mode,
      days,
      totals: toNaira(totals),
      series: Object.entries(byDay).map(([date, v]) => ({ date, ...toNaira(v) })),
      counts: { pending, failed: failedRecent, needsReview: needsReview.length, newMessages: newMessages.length },
      walletLiability,
      supplier,
      needsReview: needsReview.map((t) => ({
        id: String(t._id),
        transactionId: t.transactionId,
        type: t.type,
        network: t.network,
        plan: t.plan,
        phone: t.phone,
        amount: t.amount,
        paymentProvider: t.paymentProvider,
        paymentStatus: t.paymentStatus,
        providerStatus: t.providerStatus,
        providerStatusCode: t.providerStatusCode || null,
        failureReason: t.failureReason || null,
        cardCountry: t.cardCountry || null,
        refundStatus: t.refundStatus || null,
        customer: t.user ? { name: t.user.name, email: t.user.email } : null,
        createdAt: t.createdAt,
      })),
      blockedFundings: blockedFundings.map((e) => ({
        id: String(e._id),
        reference: e.reference,
        amount: (e.chargedKobo || e.amountKobo) / 100,
        failureReason: e.failureReason || null,
        cardCountry: e.cardCountry || null,
        refundStatus: e.refundStatus || null,
        customer: e.user ? { name: e.user.name, email: e.user.email } : null,
        createdAt: e.createdAt,
      })),
      messages: newMessages.map((m) => ({ id: String(m._id), name: m.name, email: m.email, message: m.message, createdAt: m.createdAt })),
    });
  } catch (error) {
    logEvent("admin.overview_error", { message: error && error.message });
    return res.status(500).json({ success: false, message: "Could not load the overview." });
  }
};

// POST /api/admin/transactions/:id/resolve { action, note }
//   refunded  — you refunded the customer (e.g. from the Paystack dashboard)
//   delivered — you confirmed with the supplier that it was delivered
//   dismissed — nothing to do
const resolveTransaction = async (req, res) => {
  const { id } = req.params;
  const action = (req.body || {}).action;
  const note = typeof (req.body || {}).note === "string" ? req.body.note.trim().slice(0, 300) : "";
  if (!mongoose.isValidObjectId(id) || !["refunded", "delivered", "dismissed"].includes(action)) {
    return res.status(400).json({ success: false, message: "Choose refunded, delivered or dismissed." });
  }
  const set = {
    needsReview: false,
    adminResolution: { action, note, at: new Date(), by: req.userId },
  };
  if (action === "delivered") Object.assign(set, { status: "successful", providerStatus: "successful", deliveredAt: new Date() });
  if (action === "refunded") Object.assign(set, { status: "failed", failureReason: "refunded_by_admin" });

  const tx = await Transaction.findOneAndUpdate({ _id: id, needsReview: true }, { $set: set }, { returnDocument: "after" });
  if (!tx) return res.status(404).json({ success: false, message: "That order no longer needs review." });
  logEvent("admin.resolved", { transactionId: tx.transactionId, action });
  return res.json({ success: true });
};

// POST /api/admin/messages/:id { status: "read" | "replied" }
const updateMessage = async (req, res) => {
  const { id } = req.params;
  const status = (req.body || {}).status;
  if (!mongoose.isValidObjectId(id) || !["read", "replied"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid request." });
  }
  const updated = await ContactMessage.findByIdAndUpdate(id, { $set: { status } }, { returnDocument: "after" });
  if (!updated) return res.status(404).json({ success: false, message: "Message not found." });
  return res.json({ success: true });
};

module.exports = { overview, resolveTransaction, updateMessage };
