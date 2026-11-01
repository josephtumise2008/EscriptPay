const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const Plan = require("../models/Plan");
const User = require("../models/User");
const { generateTransactionId } = require("../utils/transactionId");
const { validateNigerianPhone } = require("../utils/validators");
const { toKobo } = require("../utils/money");
const { logEvent } = require("../utils/logger");
const { payment, config } = require("../services");
const lifecycle = require("../services/lifecycle");
const wallet = require("../services/wallet");
const { vtu } = require("../services");
const { refreshOrder, refreshStaleOrders } = require("../services/orderStatus");

const serialize = (tx) => {
  const json = tx.toJSON();
  // Internal business numbers are not shown to customers.
  delete json.costKobo;
  delete json.costSource;
  delete json.adminResolution;
  return json;
};

// Our cost for an order, for profit reporting.
const costFor = (spec) => {
  if (Number.isFinite(spec.costPrice) && spec.costPrice > 0) {
    return { costKobo: Math.round(spec.costPrice * 100), costSource: "plan" };
  }
  if (spec.type === "airtime") {
    const pct = (config.airtimeDiscountPercent || {})[spec.network];
    if (Number.isFinite(pct)) return { costKobo: Math.round(spec.amount * 100 * (1 - pct / 100)), costSource: "estimate" };
  }
  return {};
};

const AIRTIME_NETWORKS = ["MTN", "Airtel", "Glo", "9mobile"];
const AIRTIME_MIN = 100;
const AIRTIME_MAX = 10000;
const CLIENT_REFERENCE_PATTERN = /^[A-Za-z0-9_.:-]{8,100}$/;
const PAYMENT_REFERENCE_PATTERN = /^[A-Za-z0-9.=-]{1,100}$/;

const normalizeNetwork = (value) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  return AIRTIME_NETWORKS.find((n) => n.toLowerCase() === raw.toLowerCase()) || null;
};

const validateAirtimeAmount = (value) => {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < AIRTIME_MIN || amount > AIRTIME_MAX) {
    return { valid: false, amount: null };
  }
  return { valid: true, amount };
};

// Escapes user input before it is used inside a RegExp (prevents regex
// injection / catastrophic backtracking from the history search box).
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Response for an order that already exists for this idempotency key.
const reusedResponse = (res, tx) => {
  const body = { success: true, transaction: serialize(tx), reused: true };
  if (tx.paymentStatus === "pending" && tx.checkoutUrl) body.checkoutUrl = tx.checkoutUrl;
  return res.json(body);
};

const findByClientReference = (userId, clientReference) =>
  Transaction.findOne({ user: userId, clientReference });

// Creates the order with a server-computed price, then either:
//   - Paystack: initializes checkout and returns `checkoutUrl` (nothing is
//     delivered until the payment is verified), or
//   - test mode: simulates payment and delivery (original behaviour).
const startOrder = async (req, res, spec) => {
  const clientReference =
    typeof spec.clientReference === "string" && CLIENT_REFERENCE_PATTERN.test(spec.clientReference)
      ? spec.clientReference
      : undefined;

  if (clientReference) {
    const existing = await findByClientReference(req.userId, clientReference);
    if (existing) return reusedResponse(res, existing);
  }

  const user = await User.findById(req.userId).select("email");
  if (!user) {
    return res.status(401).json({ success: false, message: "Not authenticated." });
  }

  if (spec.payWith === "wallet") return startWalletOrder(req, res, spec, clientReference);

  const checkout = payment.requiresCheckout === true;
  const transactionId = generateTransactionId();

  let created;
  try {
    created = await Transaction.create({
      user: req.userId,
      transactionId,
      type: spec.type,
      network: spec.network,
      plan: spec.planName,
      planId: spec.planId,
      phone: spec.phone,
      amount: spec.amount,
      status: "pending",
      paymentStatus: checkout ? "pending" : "not_required",
      providerStatus: "pending",
      mode: config.paymentMode,
      paymentProvider: config.paymentProvider,
      paymentReference: checkout ? transactionId : undefined,
      paymentAmountKobo: toKobo(spec.amount),
      currency: config.currency,
      clientReference,
      ...costFor(spec),
    });
  } catch (error) {
    // Two identical requests raced past the lookup: return the winner.
    if (error && error.code === 11000 && clientReference) {
      const existing = await findByClientReference(req.userId, clientReference);
      if (existing) return reusedResponse(res, existing);
    }
    throw error;
  }

  if (checkout) {
    try {
      const init = await payment.initializePayment({
        email: user.email,
        amountKobo: created.paymentAmountKobo,
        reference: created.paymentReference,
        callbackUrl: `${config.appUrl}/payment/callback`,
        metadata: { transactionId: created.transactionId },
      });
      const updated = await Transaction.findOneAndUpdate(
        { _id: created._id, paymentStatus: "pending" },
        { $set: { checkoutUrl: init.checkoutUrl } },
        { returnDocument: "after" }
      );
      logEvent("payment.initialized", { transactionId: created.transactionId });
      return res
        .status(201)
        .json({ success: true, transaction: serialize(updated || created), checkoutUrl: init.checkoutUrl, accessCode: init.accessCode || undefined });
    } catch (error) {
      logEvent("payment.init_failed", { transactionId: created.transactionId, code: error && error.code });
      await Transaction.updateOne(
        { _id: created._id, paymentStatus: "pending" },
        { $set: { paymentStatus: "failed", status: "failed", failureReason: "payment_init_failed" } }
      ).catch(() => {});
      return res.status(502).json({
        success: false,
        message: "We could not start the payment. You have not been charged. Please try again.",
      });
    }
  }

  // TEST MODE: simulated payment, then simulated delivery through the same
  // guarded fulfilment path used after a verified real payment.
  await payment.processPayment({ user: req.userId, transaction: created, amount: created.amount });
  const { tx } = await lifecycle.fulfillOrder(created);
  return res.status(201).json({ success: true, transaction: serialize(tx) });
};

// Most suppliers accept an order first and confirm delivery a few seconds
// later. Wait briefly for that confirmation so the customer usually sees the
// final result straight away instead of "in progress". Never re-sends the
// order; only asks for its status.
const INLINE_CONFIRM_MS = Number(process.env.INLINE_CONFIRM_MS || 12000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const awaitDelivery = async (tx) => {
  let current = tx;
  const deadline = Date.now() + INLINE_CONFIRM_MS;
  for (let wait = 1500; current && ["processing", "unknown"].includes(current.providerStatus) && Date.now() + wait < deadline; wait = 2500) {
    await sleep(wait);
    try {
      // A request that errored before ClubKonnect gave us an order number is
      // checked by RequestID; if they still have no record after a few
      // seconds it never reached them, so it fails now and is refunded
      // straight away instead of waiting minutes.
      current = (await refreshOrder(current, { minIntervalMs: 1000, source: "inline", notFoundGraceMs: 4000 })).tx || current;
    } catch (error) {
      logEvent("reconcile.inline_error", { transactionId: current.transactionId, message: error && error.message });
      break;
    }
  }
  return current;
};

// Pays for the order from the wallet balance: the amount is taken with one
// atomic conditional update (never below zero), the order is created as paid,
// and delivery starts through the same guarded fulfilment path. A definitive
// supplier failure refunds the wallet automatically.
const startWalletOrder = async (req, res, spec, clientReference) => {
  const amountKobo = toKobo(spec.amount);
  const balanceKobo = await wallet.debitForOrder(req.userId, amountKobo);
  if (balanceKobo === null) {
    return res.status(400).json({
      success: false,
      code: "insufficient_funds",
      message: "Your wallet balance is too low for this purchase. Fund your wallet or pay with card.",
    });
  }

  let created;
  try {
    created = await Transaction.create({
      user: req.userId,
      transactionId: generateTransactionId(),
      type: spec.type,
      network: spec.network,
      plan: spec.planName,
      planId: spec.planId,
      phone: spec.phone,
      amount: spec.amount,
      status: "pending",
      paymentStatus: "successful",
      providerStatus: "pending",
      mode: config.paymentMode,
      paymentProvider: "wallet",
      paymentAmountKobo: amountKobo,
      currency: config.currency,
      paidAt: new Date(),
      clientReference,
      ...costFor(spec),
    });
  } catch (error) {
    await wallet.reverseDebit(req.userId, amountKobo);
    if (error && error.code === 11000 && clientReference) {
      const existing = await findByClientReference(req.userId, clientReference);
      if (existing) return reusedResponse(res, existing);
    }
    throw error;
  }

  try {
    await wallet.recordPurchase({ userId: req.userId, tx: created, balanceKobo });
  } catch (error) {
    logEvent("wallet.ledger_error", { transactionId: created.transactionId, message: error && error.message });
  }
  logEvent("wallet.paid", { transactionId: created.transactionId });

  let { tx } = await lifecycle.fulfillOrder(created);
  if (tx && ["processing", "unknown"].includes(tx.providerStatus)) tx = await awaitDelivery(tx);
  if (tx && tx.providerStatus === "failed") {
    const refunded = await wallet.refundOrder(tx);
    tx = refunded.tx || tx;
  }
  return res.status(201).json({
    success: true,
    transaction: serialize(tx),
    wallet: { balance: (await wallet.getBalanceKobo(req.userId)) / 100 },
  });
};

// GET /api/transactions — all transactions for the authenticated user.
// Supports optional query filters (used by the history page):
//   ?status=pending|successful|failed
//   ?type=data|airtime
//   ?network=MTN|Airtel|Glo|9mobile
//   ?q=search (matches transactionId, network, plan, phone)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD
//   ?page=1&limit=25 (pagination; without these the full list is returned)
const getUserTransactions = async (req, res) => {
  try {
    await refreshStaleOrders({ user: req.userId }, { budgetMs: 1500 }).catch(() => {});
    const { status, type, network, q, from, to, page, limit } = req.query || {};
    const query = { user: req.userId };

    if (status && ["pending", "successful", "failed"].includes(status)) {
      query.status = status;
    }

    if (type && ["data", "airtime"].includes(type)) {
      query.type = type;
    }

    if (typeof network === "string" && network.trim()) {
      const name = normalizeNetwork(network.trim());
      if (name) query.network = name;
    }

    if (typeof q === "string" && q.trim()) {
      const term = new RegExp(escapeRegex(q.trim().slice(0, 64)), "i");
      query.$or = [{ transactionId: term }, { network: term }, { plan: term }, { phone: term }];
    }

    if (from || to) {
      const range = {};
      if (typeof from === "string" && !Number.isNaN(Date.parse(from))) range.$gte = new Date(from);
      if (typeof to === "string" && !Number.isNaN(Date.parse(to))) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
      if (Object.keys(range).length) query.createdAt = range;
    }

    const pageNum = page ? Math.max(1, parseInt(page, 10) || 1) : null;
    const limitNum = limit ? Math.min(100, Math.max(1, parseInt(limit, 10) || 25)) : null;

    const find = Transaction.find(query).sort({ createdAt: -1 });
    const total = await Transaction.countDocuments(query);

    let transactions;
    if (pageNum && limitNum) {
      transactions = await find.skip((pageNum - 1) * limitNum).limit(limitNum);
    } else {
      transactions = await find;
    }

    return res.json({
      success: true,
      count: transactions.length,
      transactions: transactions.map(serialize),
      pagination: {
        page: pageNum || 1,
        limit: limitNum || total,
        total,
        pages: limitNum && limitNum > 0 ? Math.max(1, Math.ceil(total / limitNum)) : 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch transactions." });
  }
};

// GET /api/transactions/:id — single transaction, scoped to the authenticated user.
const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = mongoose.isValidObjectId(id)
      ? { _id: id, user: req.userId }
      : { transactionId: String(id).toUpperCase(), user: req.userId };

    let tx = await Transaction.findOne(query);
    if (!tx) {
      return res.status(404).json({ success: false, message: "Transaction not found." });
    }
    // The order page polls this while delivery is pending: ask the supplier
    // for the final result (throttled; never re-sends the purchase).
    if (["processing", "unknown"].includes(tx.providerStatus)) {
      try {
        // Fresh orders are checked often (delivery usually lands within
        // seconds); older ones fall back to the normal throttle.
        const young = Date.now() - new Date(tx.createdAt).getTime() < 3 * 60 * 1000;
        tx = (await refreshOrder(tx, { source: "poll", ...(young ? { minIntervalMs: 3000 } : {}) })).tx || tx;
      } catch (error) {
        logEvent("reconcile.poll_error", { transactionId: tx.transactionId, message: error && error.message });
      }
    }
    return res.json({ success: true, transaction: serialize(tx) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch transaction." });
  }
};

// POST /api/transactions/data (and the original /test) — DATA purchase.
//
// Only planId + phone are accepted; plan name, network and price are always
// read from MongoDB — anything price-related sent by the client is ignored.
const createTestTransaction = async (req, res) => {
  try {
    const { planId, phone, clientReference, payWith } = req.body || {};

    if (!planId || !mongoose.isValidObjectId(planId)) {
      return res.status(400).json({ success: false, message: "Plan is required." });
    }

    const phoneCheck = validateNigerianPhone(typeof phone === "string" ? phone : "");
    if (!phoneCheck.valid) {
      return res.status(400).json({ success: false, message: phoneCheck.message });
    }

    const plan = await Plan.findById(planId);
    if (!plan || plan.active === false) {
      return res.status(400).json({ success: false, message: "Selected plan is no longer available." });
    }
    if (!Number.isFinite(plan.price) || plan.price <= 0) {
      return res.status(400).json({ success: false, message: "Selected plan is no longer available." });
    }
    if (vtu.requiresPlanMapping && (!plan.providerPlanId || plan.provider !== vtu.name)) {
      logEvent("order.plan_not_mapped", { planId: String(plan._id) });
      return res.status(400).json({ success: false, message: "Selected plan is no longer available." });
    }
    if (Number.isFinite(plan.costPrice) && plan.price < plan.costPrice) {
      logEvent("order.below_cost", { planId: String(plan._id) });
      return res.status(400).json({ success: false, message: "Selected plan is no longer available." });
    }

    return await startOrder(req, res, {
      type: "data",
      network: plan.network,
      planName: plan.name,
      planId: plan._id,
      phone: phoneCheck.normalized,
      amount: plan.price,
      costPrice: plan.costPrice,
      clientReference,
      payWith: payWith === "wallet" ? "wallet" : "card",
    });
  } catch (error) {
    logEvent("order.error", { type: "data", message: error && error.message });
    return res.status(502).json({
      success: false,
      message: "Purchase could not be completed. Please try again.",
    });
  }
};

// POST /api/transactions/airtime — AIRTIME purchase.
// Network, amount range and phone are validated server-side.
const createAirtimeTransaction = async (req, res) => {
  try {
    const { network, amount, phone, clientReference, payWith } = req.body || {};

    const networkName = normalizeNetwork(network);
    if (!networkName) {
      return res.status(400).json({ success: false, message: "Select a valid network." });
    }

    const amountCheck = validateAirtimeAmount(amount);
    if (!amountCheck.valid) {
      return res
        .status(400)
        .json({ success: false, message: "Amount must be a whole number between ₦100 and ₦10,000." });
    }

    const phoneCheck = validateNigerianPhone(typeof phone === "string" ? phone : "");
    if (!phoneCheck.valid) {
      return res.status(400).json({ success: false, message: phoneCheck.message });
    }

    return await startOrder(req, res, {
      type: "airtime",
      network: networkName,
      planName: `Airtime ₦${amountCheck.amount}`,
      planId: undefined,
      phone: phoneCheck.normalized,
      amount: amountCheck.amount,
      clientReference,
      payWith: payWith === "wallet" ? "wallet" : "card",
    });
  } catch (error) {
    logEvent("order.error", { type: "airtime", message: error && error.message });
    return res.status(502).json({
      success: false,
      message: "Purchase could not be completed. Please try again.",
    });
  }
};

// POST /api/transactions/verify  { reference }
//
// Called by the payment callback page after Paystack redirects back. The
// redirect itself proves nothing: the server asks Paystack, checks the
// amount/currency/reference, and only then starts delivery. Scoped to the
// authenticated owner of the order.
const verifyTransactionPayment = async (req, res) => {
  const reference = typeof (req.body || {}).reference === "string" ? req.body.reference.trim() : "";
  if (!PAYMENT_REFERENCE_PATTERN.test(reference)) {
    return res.status(400).json({ success: false, message: "A valid payment reference is required." });
  }

  try {
    const owned = await Transaction.findOne({ paymentReference: reference, user: req.userId });
    if (!owned) {
      return res.status(404).json({ success: false, message: "Transaction not found." });
    }
    if (owned.paymentStatus === "not_required") {
      return res.json({ success: true, transaction: serialize(owned) });
    }

    let tx = owned;
    try {
      const result = await lifecycle.confirmPayment(reference, { source: "callback" });
      tx = result.tx || owned;
    } catch (error) {
      logEvent("payment.verify_error", { transactionId: owned.transactionId, code: error && error.code });
      return res.status(502).json({
        success: false,
        message:
          "We could not confirm your payment yet. If you were debited, it will be confirmed automatically — check your history shortly.",
        transaction: serialize(owned),
      });
    }

    if (tx.paymentStatus === "successful" && tx.providerStatus === "pending") {
      const fulfilled = await lifecycle.fulfillOrder(tx);
      tx = fulfilled.tx || tx;
    }

    return res.json({ success: true, transaction: serialize(tx) });
  } catch (error) {
    logEvent("payment.verify_exception", { message: error && error.message });
    return res.status(500).json({ success: false, message: "Could not check this payment. Please try again." });
  }
};

module.exports = {
  getUserTransactions,
  getTransactionById,
  createTestTransaction,
  createDataTransaction: createTestTransaction,
  createAirtimeTransaction,
  verifyTransactionPayment,
};
