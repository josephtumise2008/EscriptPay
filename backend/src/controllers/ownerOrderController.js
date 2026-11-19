// "Buy for myself" on the admin page: the owner sends data or airtime to his
// own line, paid straight from the supplier (ClubKonnect) balance, the same
// way `npm run vtu:test-order` does in the terminal. No card, no wallet.
//
// Safety: admin-only route; ₦20,000 cap per order; an idempotency key stops a
// double tap from sending twice; the order goes through the normal guarded
// delivery path (never re-sent blindly) and shows in the owner's history.
// These orders are left out of sales and profit.
const Transaction = require("../models/Transaction");
const Plan = require("../models/Plan");
const User = require("../models/User");
const { generateTransactionId } = require("../utils/transactionId");
const { validateNigerianPhone } = require("../utils/validators");
const { toKobo } = require("../utils/money");
const { logEvent } = require("../utils/logger");
const { vtu, config } = require("../services");
const lifecycle = require("../services/lifecycle");

const NETWORKS = ["MTN", "Airtel", "Glo", "9mobile"];
const MAX_NAIRA = 20000;
const AIRTIME_MIN = 50;
const KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,100}$/;

const view = (tx) => ({
  id: String(tx._id),
  transactionId: tx.transactionId,
  type: tx.type,
  network: tx.network,
  plan: tx.plan || null,
  phone: tx.phone,
  cost: tx.amount,
  status: tx.status,
  providerStatus: tx.providerStatus,
  failureReason: tx.failureReason || null,
  createdAt: tx.createdAt,
});

// GET /api/admin/self-order — plans with what they cost you, your number,
// and your recent self-orders.
const selfOrderInfo = async (req, res) => {
  try {
    const [plans, me, recent] = await Promise.all([
      Plan.find({ active: { $ne: false } }).sort({ network: 1, price: 1 }).lean(),
      User.findById(req.userId, { phone: 1 }).lean(),
      Transaction.find({ user: req.userId, paymentProvider: "owner" }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);
    return res.json({
      success: true,
      maxNaira: MAX_NAIRA,
      phone: me && me.phone ? `0${me.phone.slice(4)}` : "",
      simulated: vtu.simulated === true,
      plans: plans
        .filter((p) => p.providerPlanId || vtu.simulated === true)
        .map((p) => ({
          id: String(p._id),
          network: p.network,
          name: p.name,
          validity: p.validity,
          price: p.price,
          cost: Number.isFinite(p.costPrice) && p.costPrice > 0 ? p.costPrice : null,
        })),
      recent: recent.map(view),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not load plans." });
  }
};

// POST /api/admin/self-order
//   { type: "data", planId, phone, clientReference }
//   { type: "airtime", network, amount, phone, clientReference }
const selfOrder = async (req, res) => {
  try {
    const b = req.body || {};
    const phoneCheck = validateNigerianPhone(b.phone);
    if (!phoneCheck.valid) return res.status(400).json({ success: false, message: phoneCheck.message });
    const clientReference = typeof b.clientReference === "string" && KEY_PATTERN.test(b.clientReference) ? b.clientReference : undefined;
    if (!clientReference) return res.status(400).json({ success: false, message: "Missing order key. Refresh the page and try again." });

    const existing = await Transaction.findOne({ user: req.userId, clientReference });
    if (existing) return res.json({ success: true, order: view(existing), reused: true });

    let spec;
    if (b.type === "data") {
      const plan = typeof b.planId === "string" && /^[a-f0-9]{24}$/i.test(b.planId) ? await Plan.findById(b.planId).lean() : null;
      if (!plan || plan.active === false) return res.status(400).json({ success: false, message: "Pick a data plan." });
      const cost = Number.isFinite(plan.costPrice) && plan.costPrice > 0 ? plan.costPrice : plan.price;
      spec = { type: "data", network: plan.network, plan: plan.name, planId: plan._id, amount: cost, costKobo: toKobo(cost) };
    } else if (b.type === "airtime") {
      const network = NETWORKS.find((n) => n.toLowerCase() === String(b.network || "").toLowerCase());
      const amount = Number(b.amount);
      if (!network) return res.status(400).json({ success: false, message: "Pick a network." });
      if (!Number.isInteger(amount) || amount < AIRTIME_MIN || amount > MAX_NAIRA) {
        return res.status(400).json({ success: false, message: `Airtime must be a whole amount from ₦${AIRTIME_MIN} to ₦${MAX_NAIRA.toLocaleString("en-NG")}.` });
      }
      spec = { type: "airtime", network, amount };
    } else {
      return res.status(400).json({ success: false, message: "Choose data or airtime." });
    }
    if (spec.amount > MAX_NAIRA) {
      return res.status(400).json({ success: false, message: `That costs more than the ₦${MAX_NAIRA.toLocaleString("en-NG")} limit.` });
    }

    let created;
    try {
      created = await Transaction.create({
        user: req.userId,
        transactionId: generateTransactionId(),
        type: spec.type,
        network: spec.network,
        plan: spec.plan,
        planId: spec.planId,
        phone: phoneCheck.normalized,
        amount: spec.amount,
        status: "pending",
        paymentStatus: "successful",
        providerStatus: "pending",
        mode: config.paymentMode,
        paymentProvider: "owner",
        paymentAmountKobo: toKobo(spec.amount),
        currency: config.currency,
        paidAt: new Date(),
        clientReference,
        ...(spec.costKobo ? { costKobo: spec.costKobo, costSource: "plan" } : {}),
      });
    } catch (error) {
      if (error && error.code === 11000) {
        const again = await Transaction.findOne({ user: req.userId, clientReference });
        if (again) return res.json({ success: true, order: view(again), reused: true });
      }
      throw error;
    }
    logEvent("owner.self_order", { transactionId: created.transactionId, type: spec.type });

    let { tx } = await lifecycle.fulfillOrder(created);
    if (tx && ["processing", "unknown"].includes(tx.providerStatus)) {
      tx = await require("./transactionController").awaitDelivery(tx);
    }
    return res.status(201).json({ success: true, order: view(tx || created) });
  } catch (error) {
    logEvent("owner.self_order_error", { message: error && error.message });
    return res.status(500).json({ success: false, message: "Could not send that order. Check your history before trying again." });
  }
};

module.exports = { selfOrderInfo, selfOrder };
