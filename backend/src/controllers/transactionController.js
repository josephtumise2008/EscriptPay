const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const Plan = require("../models/Plan");
const { generateTransactionId } = require("../utils/transactionId");
const { validateNigerianPhone } = require("../utils/validators");
const { payment, vtu } = require("../services");

const serialize = (tx) => tx.toJSON();

const AIRTIME_NETWORKS = ["MTN", "Airtel", "Glo", "9mobile"];

const normalizeNetwork = (value) => {
  const raw = (value || "").trim();
  if (!raw) return null;
  return AIRTIME_NETWORKS.find((n) => n.toLowerCase() === raw.toLowerCase()) || null;
};

const validateAirtimeAmount = (value) => {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 100 || amount > 10000) {
    return { valid: false, amount: null };
  }
  return { valid: true, amount };
};

// Runs the simulated payment then VTU delivery steps for a transaction.
// Shared by the data and airtime purchase flows. This is where a real
// Paystack / VTU provider would be invoked through the service layer.
const processOrder = async (tx, plan) => {
  const paymentResult = await payment.processPayment({
    user: tx.user,
    transaction: tx,
    amount: tx.amount,
  });

  const vtuResult = await vtu.purchaseData({
    network: tx.network,
    phone: tx.phone,
    plan,
    transaction: tx,
  });

  tx.paymentStatus = paymentResult.paymentStatus || tx.paymentStatus;
  tx.providerStatus = vtuResult.providerStatus || "failed";
  tx.providerReference = vtuResult.reference || tx.providerReference;
  tx.status = vtuResult.providerStatus === "successful" ? "successful" : "failed";
  await tx.save();
  return tx;
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
      const term = new RegExp(q.trim(), "i");
      query.$or = [{ transactionId: term }, { network: term }, { plan: term }, { phone: term }];
    }

    if (from || to) {
      const range = {};
      if (from && !Number.isNaN(Date.parse(from))) range.$gte = new Date(from);
      if (to && !Number.isNaN(Date.parse(to))) {
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
      : { transactionId: id.toUpperCase(), user: req.userId };

    const tx = await Transaction.findOne(query);
    if (!tx) {
      return res.status(404).json({ success: false, message: "Transaction not found." });
    }
    return res.json({ success: true, transaction: serialize(tx) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch transaction." });
  }
};

// POST /api/transactions/test — simulated DATA purchase flow.
//
// TEST MODE: payment and VTU delivery are simulated through the service
// layer. The plan (name, network, price) is always read from MongoDB —
// anything price-related sent by the client is ignored.
const createTestTransaction = async (req, res) => {
  let created = null;

  try {
    const { planId, phone, clientReference } = req.body || {};

    if (!planId) {
      return res.status(400).json({ success: false, message: "Plan is required." });
    }

    const phoneCheck = validateNigerianPhone(phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ success: false, message: phoneCheck.message });
    }

    // Idempotency: if a transaction already exists for this user + reference,
    // return it instead of creating a duplicate purchase.
    if (clientReference) {
      const existing = await Transaction.findOne({ user: req.userId, clientReference });
      if (existing) {
        return res.json({ success: true, transaction: serialize(existing), reused: true });
      }
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(400).json({ success: false, message: "Selected plan no longer exists." });
    }

    created = await Transaction.create({
      user: req.userId,
      transactionId: generateTransactionId(),
      type: "data",
      network: plan.network,
      plan: plan.name,
      planId: plan._id,
      phone: phoneCheck.normalized,
      amount: plan.price,
      status: "pending",
      paymentStatus: "not_required",
      providerStatus: "pending",
      mode: "test",
      clientReference: clientReference || undefined,
    });

    await processOrder(created, plan);

    return res.status(201).json({ success: true, transaction: serialize(created) });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("transactionController.createTestTransaction:", error.message);
    }
    if (created) {
      created.status = "failed";
      created.providerStatus = "failed";
      await created.save().catch(() => {});
    }
    return res.status(502).json({
      success: false,
      message: "Purchase could not be completed. Please try again.",
    });
  }
};

// POST /api/transactions/airtime — simulated AIRTIME purchase flow.
//
// Same architecture as data: only the network, amount and phone are accepted;
// the amount range is validated server-side; payment + VTU are simulated.
const createAirtimeTransaction = async (req, res) => {
  let created = null;

  try {
    const { network, amount, phone, clientReference } = req.body || {};

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

    const phoneCheck = validateNigerianPhone(phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ success: false, message: phoneCheck.message });
    }

    if (clientReference) {
      const existing = await Transaction.findOne({ user: req.userId, clientReference });
      if (existing) {
        return res.json({ success: true, transaction: serialize(existing), reused: true });
      }
    }

    created = await Transaction.create({
      user: req.userId,
      transactionId: generateTransactionId(),
      type: "airtime",
      network: networkName,
      plan: `Airtime ₦${amountCheck.amount}`,
      phone: phoneCheck.normalized,
      amount: amountCheck.amount,
      status: "pending",
      paymentStatus: "not_required",
      providerStatus: "pending",
      mode: "test",
      clientReference: clientReference || undefined,
    });

    await processOrder(created, null);

    return res.status(201).json({ success: true, transaction: serialize(created) });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("transactionController.createAirtimeTransaction:", error.message);
    }
    if (created) {
      created.status = "failed";
      created.providerStatus = "failed";
      await created.save().catch(() => {});
    }
    return res.status(502).json({
      success: false,
      message: "Purchase could not be completed. Please try again.",
    });
  }
};

module.exports = {
  getUserTransactions,
  getTransactionById,
  createTestTransaction,
  createAirtimeTransaction,
};