const User = require("../models/User");
const wallet = require("../services/wallet");
const { FUNDING_MIN_NAIRA, FUNDING_MAX_NAIRA } = require("../services/walletService");
const { config } = require("../services");
const { logEvent } = require("../utils/logger");

const CLIENT_REFERENCE_PATTERN = /^[A-Za-z0-9_.:-]{8,100}$/;
const PAYMENT_REFERENCE_PATTERN = /^[A-Za-z0-9.=-]{1,100}$/;

const walletSummary = (balanceKobo) => ({
  balance: balanceKobo / 100,
  currency: config.currency,
  mode: wallet.mode,
  limits: { minFunding: FUNDING_MIN_NAIRA, maxFunding: FUNDING_MAX_NAIRA },
});

// GET /api/wallet?page=1&limit=20 — balance and recent wallet activity.
const getWallet = async (req, res) => {
  try {
    await require("../services/orderStatus").refreshStaleOrders({ user: req.userId }, { budgetMs: 1500 }).catch(() => {});
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const [balanceKobo, { entries, total }] = await Promise.all([
      wallet.getBalanceKobo(req.userId),
      wallet.listEntries(req.userId, { page, limit }),
    ]);
    return res.json({
      success: true,
      wallet: { ...walletSummary(balanceKobo), savedCard: await wallet.getSavedCard(req.userId) },
      entries: entries.map((e) => e.toJSON()),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not load your wallet." });
  }
};

// GET /api/wallet/balance — lightweight, polled by the header.
const getBalance = async (req, res) => {
  try {
    return res.json({ success: true, wallet: walletSummary(await wallet.getBalanceKobo(req.userId)) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not load your balance." });
  }
};

// GET /api/wallet/quote?amount=5000 — what the customer pays for a top-up
// (amount + card fee), so the page can show it before they continue.
const quoteFunding = async (req, res) => {
  const value = Number(req.query.amount);
  if (!Number.isInteger(value) || value < FUNDING_MIN_NAIRA || value > FUNDING_MAX_NAIRA) {
    return res.status(400).json({ success: false, message: "Enter a valid amount." });
  }
  const q = wallet.quote(value);
  return res.json({ success: true, quote: { amount: q.amountKobo / 100, fee: q.feeKobo / 100, total: q.chargeKobo / 100 } });
};

// POST /api/wallet/fund { amount, clientReference, method: "checkout" | "saved_card", saveCard }
const fundWallet = async (req, res) => {
  const { amount, clientReference } = req.body || {};
  const method = (req.body || {}).method === "saved_card" ? "saved_card" : "checkout";
  const saveCard = (req.body || {}).saveCard === true;
  const value = Number(amount);
  if (!Number.isInteger(value) || value < FUNDING_MIN_NAIRA || value > FUNDING_MAX_NAIRA) {
    return res.status(400).json({
      success: false,
      message: `Enter a whole amount between ₦${FUNDING_MIN_NAIRA.toLocaleString("en-NG")} and ₦${FUNDING_MAX_NAIRA.toLocaleString("en-NG")}.`,
    });
  }
  const ref = typeof clientReference === "string" && CLIENT_REFERENCE_PATTERN.test(clientReference) ? clientReference : undefined;

  try {
    const user = await User.findById(req.userId).select("email");
    if (!user) return res.status(401).json({ success: false, message: "Not authenticated." });

    const result = await wallet.startFunding({ userId: req.userId, email: user.email, amountNaira: value, clientReference: ref, method, saveCard });
    const body = {
      success: true,
      entry: result.entry.toJSON(),
      wallet: walletSummary(await wallet.getBalanceKobo(req.userId)),
    };
    const checkoutUrl = result.checkoutUrl || (result.reused && result.entry.status === "pending" ? result.entry.checkoutUrl : null);
    if (checkoutUrl) body.checkoutUrl = checkoutUrl;
    if (result.reused) body.reused = true;
    if (result.pending) {
      body.pending = true;
      body.message = "We're confirming your card payment. Your wallet updates automatically once it's confirmed.";
    }
    return res.status(result.reused ? 200 : 201).json(body);
  } catch (error) {
    if (error && ["no_saved_card", "card_declined", "card_needs_action"].includes(error.code)) {
      return res.status(402).json({ success: false, code: error.code, message: error.message });
    }
    if (error && error.code === "payment_init_failed") {
      return res.status(502).json({ success: false, message: error.message });
    }
    logEvent("wallet.fund_error", { message: error && error.message });
    return res.status(500).json({ success: false, message: "Could not fund your wallet. Please try again." });
  }
};

// POST /api/wallet/verify { reference } — after the Paystack redirect.
const verifyFunding = async (req, res) => {
  const reference = typeof (req.body || {}).reference === "string" ? req.body.reference.trim() : "";
  if (!PAYMENT_REFERENCE_PATTERN.test(reference)) {
    return res.status(400).json({ success: false, message: "A valid payment reference is required." });
  }
  try {
    const WalletEntry = require("../models/WalletEntry");
    const owned = await WalletEntry.findOne({ paymentReference: reference, user: req.userId, kind: "funding" });
    if (!owned) return res.status(404).json({ success: false, message: "Wallet payment not found." });

    let entry = owned;
    try {
      const result = await wallet.confirmFunding(reference, { source: "callback" });
      entry = result.entry || owned;
    } catch (error) {
      logEvent("wallet.verify_error", { reference, code: error && error.code });
      return res.status(502).json({
        success: false,
        message: "We could not confirm your payment yet. If you were debited, your wallet will be credited automatically.",
        entry: owned.toJSON(),
      });
    }
    return res.json({
      success: true,
      entry: entry.toJSON(),
      wallet: walletSummary(await wallet.getBalanceKobo(req.userId)),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not check this payment. Please try again." });
  }
};

// DELETE /api/wallet/card — forget the saved card.
const removeCard = async (req, res) => {
  try {
    await wallet.removeSavedCard(req.userId);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not remove the card. Please try again." });
  }
};

module.exports = { getWallet, getBalance, fundWallet, verifyFunding, quoteFunding, removeCard };
