// Wallet: funding, paying for orders, and refunds.
//
// Money rules
// - Balances are integers in kobo on User.walletBalances.<mode>, where mode is
//   the payment mode ("test" | "live"). Test money never pays for live orders.
// - Debits are one conditional update: { balance >= amount } -> $inc -amount.
//   MongoDB applies it atomically per document, so two simultaneous purchases
//   can never overspend the balance.
// - Credits are idempotent. A funding entry is claimed pending -> crediting
//   with a conditional update before the balance is incremented, and refunds
//   are keyed by a unique ledger reference, so retried webhooks, callback +
//   webhook races and double clicks credit at most once.
// - Funding through Paystack is only credited after the server verifies the
//   reference, exact amount and currency with Paystack itself.

const { quoteFunding } = require("./walletFee");

const AFTER = { returnDocument: "after" };
const FUNDING_CONFIRMABLE = ["pending", "expired"];

const FUNDING_MIN_NAIRA = 100;
const FUNDING_MAX_NAIRA = 500000;

const createWalletService = ({
  User,
  WalletEntry,
  Transaction,
  payment,
  config,
  generateReference,
  logEvent = () => {},
}) => {
  const mode = config.paymentMode;
  const field = `walletBalances.${mode}`;

  const balanceOf = (user) => {
    const value = user && user.walletBalances && user.walletBalances[mode];
    return Number.isInteger(value) && value > 0 ? value : 0;
  };

  const BALANCE_ONLY = { ...AFTER, projection: { walletBalances: 1 } };

  const getBalanceKobo = async (userId) => balanceOf(await User.findById(userId, { walletBalances: 1 }));

  const creditUser = async (userId, amountKobo) => {
    const user = await User.findOneAndUpdate({ _id: userId }, { $inc: { [field]: amountKobo } }, BALANCE_ONLY);
    return user ? balanceOf(user) : null;
  };

  // Returns the new balance, or null when the balance is too low.
  const debitUser = async (userId, amountKobo) => {
    const user = await User.findOneAndUpdate(
      { _id: userId, [field]: { $gte: amountKobo } },
      { $inc: { [field]: -amountKobo } },
      BALANCE_ONLY
    );
    return user ? balanceOf(user) : null;
  };

  // Moves a verified funding entry into the balance exactly once.
  const applyFunding = async (entry, { source, gatewayTransactionId, paidAt }) => {
    const claimed = await WalletEntry.findOneAndUpdate(
      { _id: entry._id, status: { $in: FUNDING_CONFIRMABLE }, needsReview: { $ne: true } },
      {
        $set: {
          status: "crediting",
          verifiedVia: source,
          gatewayTransactionId,
          paidAt: paidAt ? new Date(paidAt) : new Date(),
        },
        $unset: { failureReason: "" },
      },
      AFTER
    );
    if (!claimed) {
      const current = await WalletEntry.findById(entry._id);
      return { outcome: current && current.status === "successful" ? "already_credited" : "conflict", entry: current };
    }

    const balance = await creditUser(claimed.user, claimed.amountKobo);
    if (balance === null) {
      // The account no longer exists: keep the money visible for a person.
      const flagged = await WalletEntry.findOneAndUpdate(
        { _id: claimed._id, status: "crediting" },
        { $set: { needsReview: true, failureReason: "user_missing" } },
        AFTER
      );
      logEvent("wallet.credit_failed", { reference: claimed.reference, reason: "user_missing" });
      return { outcome: "needs_review", entry: flagged };
    }

    const credited = await WalletEntry.findOneAndUpdate(
      { _id: claimed._id, status: "crediting" },
      { $set: { status: "successful", balanceAfterKobo: balance } },
      AFTER
    );
    logEvent("wallet.funded", { reference: claimed.reference, source });
    return { outcome: "credited", entry: credited, balanceKobo: balance };
  };

  // Starts a wallet top-up. Test mode credits immediately (no real money);
  // Paystack returns a checkout URL and credits only after verification.
  const startFunding = async ({ userId, email, amountNaira, clientReference }) => {
    if (clientReference) {
      const existing = await WalletEntry.findOne({ user: userId, clientReference });
      if (existing) return { reused: true, entry: existing };
    }

    const amountKobo = Math.round(amountNaira * 100);
    const reference = generateReference();
    const checkout = payment.requiresCheckout === true;
    // Card fee is paid by the customer on top (only when a real checkout runs).
    const quote = checkout ? quoteFunding(amountKobo, config.walletFee) : { feeKobo: 0, chargeKobo: amountKobo };

    let entry;
    try {
      entry = await WalletEntry.create({
        user: userId,
        reference,
        kind: "funding",
        direction: "credit",
        amountKobo,
        chargedKobo: quote.chargeKobo,
        feeKobo: quote.feeKobo,
        status: "pending",
        mode,
        currency: config.currency,
        paymentProvider: config.paymentProvider,
        paymentReference: checkout ? reference : undefined,
        clientReference,
        description: "Wallet top-up",
      });
    } catch (error) {
      if (error && error.code === 11000 && clientReference) {
        const existing = await WalletEntry.findOne({ user: userId, clientReference });
        if (existing) return { reused: true, entry: existing };
      }
      throw error;
    }

    if (!checkout) {
      await payment.processPayment({ user: userId, amount: amountNaira });
      const result = await applyFunding(entry, { source: "test" });
      return { entry: result.entry, balanceKobo: result.balanceKobo };
    }

    try {
      const init = await payment.initializePayment({
        email,
        amountKobo: quote.chargeKobo,
        reference,
        callbackUrl: `${config.appUrl}/payment/callback?purpose=wallet`,
        metadata: { walletReference: reference, purpose: "wallet_funding" },
      });
      const updated = await WalletEntry.findOneAndUpdate(
        { _id: entry._id, status: "pending" },
        { $set: { checkoutUrl: init.checkoutUrl } },
        AFTER
      );
      logEvent("wallet.funding_initialized", { reference });
      return { entry: updated || entry, checkoutUrl: init.checkoutUrl };
    } catch (error) {
      logEvent("wallet.funding_init_failed", { reference, code: error && error.code });
      await WalletEntry.updateOne(
        { _id: entry._id, status: "pending" },
        { $set: { status: "failed", failureReason: "payment_init_failed" } }
      ).catch(() => {});
      const failure = new Error("We could not start the payment. You have not been charged. Please try again.");
      failure.code = "payment_init_failed";
      throw failure;
    }
  };

  // Verifies a funding payment with the provider and credits it once.
  // Safe to call repeatedly from the callback page and webhooks.
  const confirmFunding = async (reference, { source }) => {
    const entry = await WalletEntry.findOne({ paymentReference: reference, kind: "funding" });
    if (!entry) return { outcome: "not_found", entry: null };
    if (entry.status === "successful") return { outcome: "already_credited", entry };
    if (entry.status === "crediting") return { outcome: "in_progress", entry };
    if (entry.needsReview) return { outcome: "needs_review", entry };

    const verified = await payment.verifyPayment(reference);

    if (verified.status === "success") {
      const problems = [];
      if (verified.reference !== reference) problems.push("reference_mismatch");
      if (verified.currency !== config.currency) problems.push("currency_mismatch");
      const expectedKobo = entry.chargedKobo || entry.amountKobo;
      if (!Number.isInteger(verified.amountKobo) || verified.amountKobo !== expectedKobo) {
        problems.push("amount_mismatch");
      }
      if (problems.length > 0) {
        const flagged = await WalletEntry.findOneAndUpdate(
          { _id: entry._id, status: { $in: [...FUNDING_CONFIRMABLE, "failed"] } },
          { $set: { status: "failed", needsReview: true, failureReason: problems.join(","), verifiedVia: source } },
          AFTER
        );
        logEvent("wallet.funding_mismatch", { reference, problems, source });
        return { outcome: "mismatch", entry: flagged || (await WalletEntry.findById(entry._id)) };
      }
      if (entry.status === "failed") {
        // A verified success after an earlier failure (e.g. init timeout):
        // reopen it so it can be credited.
        await WalletEntry.updateOne(
          { _id: entry._id, status: "failed", needsReview: { $ne: true } },
          { $set: { status: "pending" } }
        );
      }
      return applyFunding(entry, {
        source,
        gatewayTransactionId: verified.gatewayTransactionId,
        paidAt: verified.paidAt,
      });
    }

    if (verified.status === "failed" || verified.status === "reversed") {
      const failed = await WalletEntry.findOneAndUpdate(
        { _id: entry._id, status: { $in: FUNDING_CONFIRMABLE } },
        { $set: { status: "failed", failureReason: `payment_${verified.status}` } },
        AFTER
      );
      return { outcome: "failed", entry: failed || (await WalletEntry.findById(entry._id)) };
    }

    const ageMs = Date.now() - new Date(entry.createdAt).getTime();
    if (entry.status === "pending" && ageMs > config.paymentExpiryMinutes * 60 * 1000) {
      const expired = await WalletEntry.findOneAndUpdate(
        { _id: entry._id, status: "pending" },
        { $set: { status: "expired", failureReason: "payment_expired" } },
        AFTER
      );
      return { outcome: "expired", entry: expired || (await WalletEntry.findById(entry._id)) };
    }
    return { outcome: "unpaid", entry };
  };

  // Takes the order amount from the wallet. Returns the new balance or null
  // (insufficient funds). The caller records the purchase entry once the
  // order exists, or calls reverseDebit if creating the order fails.
  const debitForOrder = (userId, amountKobo) => debitUser(userId, amountKobo);
  const reverseDebit = (userId, amountKobo) => creditUser(userId, amountKobo);

  const recordPurchase = ({ userId, tx, balanceKobo }) =>
    WalletEntry.create({
      user: userId,
      reference: tx.transactionId,
      kind: "purchase",
      direction: "debit",
      amountKobo: tx.paymentAmountKobo,
      balanceAfterKobo: balanceKobo,
      status: "successful",
      mode,
      currency: config.currency,
      paymentProvider: "wallet",
      orderTransactionId: tx.transactionId,
      description: `${tx.network} ${tx.type === "airtime" ? "airtime" : tx.plan} · ${tx.phone}`.slice(0, 120),
    });

  // Returns the money for a wallet-paid order that the supplier definitively
  // failed. Never refunds "unknown" outcomes (the supplier may have delivered).
  const refundOrder = async (tx) => {
    if (!tx || tx.paymentProvider !== "wallet" || tx.providerStatus !== "failed") {
      return { outcome: "not_applicable", tx };
    }
    const reference = `RF-${tx.transactionId}`;
    let entry;
    try {
      entry = await WalletEntry.create({
        user: tx.user,
        reference,
        kind: "refund",
        direction: "credit",
        amountKobo: tx.paymentAmountKobo,
        status: "crediting",
        mode: tx.mode,
        currency: tx.currency || config.currency,
        paymentProvider: "wallet",
        orderTransactionId: tx.transactionId,
        description: "Refund for failed order",
      });
    } catch (error) {
      if (error && error.code === 11000) return { outcome: "already_refunded", tx };
      throw error;
    }

    const balance = await creditUser(tx.user, entry.amountKobo);
    await WalletEntry.updateOne(
      { _id: entry._id, status: "crediting" },
      balance === null
        ? { $set: { needsReview: true, failureReason: "user_missing" } }
        : { $set: { status: "successful", balanceAfterKobo: balance } }
    );
    const updated = await Transaction.findOneAndUpdate(
      { _id: tx._id, providerStatus: "failed" },
      { $set: { needsReview: balance === null, failureReason: "delivery_failed_refunded" } },
      AFTER
    );
    logEvent("wallet.refunded", { transactionId: tx.transactionId });
    return { outcome: "refunded", tx: updated || tx, balanceKobo: balance };
  };

  const listEntries = async (userId, { page = 1, limit = 20 } = {}) => {
    const query = { user: userId, mode, status: { $in: ["successful", "pending", "crediting", "failed"] } };
    const [entries, total] = await Promise.all([
      WalletEntry.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      WalletEntry.countDocuments(query),
    ]);
    return { entries, total };
  };

  const quote = (amountNaira) => {
    const checkout = payment.requiresCheckout === true;
    const amountKobo = Math.round(amountNaira * 100);
    return checkout ? quoteFunding(amountKobo, config.walletFee) : { amountKobo, feeKobo: 0, chargeKobo: amountKobo };
  };

  return {
    mode,
    quote,
    getBalanceKobo,
    startFunding,
    confirmFunding,
    debitForOrder,
    reverseDebit,
    recordPurchase,
    refundOrder,
    listEntries,
  };
};

module.exports = { createWalletService, FUNDING_MIN_NAIRA, FUNDING_MAX_NAIRA };
