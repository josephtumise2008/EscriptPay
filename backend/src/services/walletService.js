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
const { isForeignCard, refundBlockedPayment } = require("./payment/cardCheck");

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

  // Public view of a saved card (no token).
  const publicCard = (user) => {
    const c = user && user.savedCard;
    if (!c || !c.last4) return null;
    return { brand: c.brand || "Card", last4: c.last4, bank: c.bank || null, expMonth: c.expMonth || null, expYear: c.expYear || null };
  };
  const getSavedCard = async (userId) => publicCard(await User.findById(userId, { savedCard: 1 }));
  const removeSavedCard = async (userId) => {
    await User.updateOne({ _id: userId }, { $unset: { savedCard: "" } });
  };

  // After a verified card top-up the customer asked to save: keep the
  // reusable authorization for one-tap top-ups.
  const rememberCard = async (entry, verified) => {
    if (!entry.saveCard) return;
    const a = verified && verified.authorization;
    if (!a || a.channel !== "card" || a.reusable !== true || !a.code || !a.last4) return;
    if (isForeignCard(verified, config)) return;
    await User.updateOne(
      { _id: entry.user },
      {
        $set: {
          savedCard: {
            authorizationCode: a.code,
            signature: a.signature || undefined,
            brand: a.brand || "Card",
            last4: a.last4,
            bank: a.bank || undefined,
            expMonth: a.expMonth || undefined,
            expYear: a.expYear || undefined,
            savedAt: new Date(),
          },
        },
      }
    );
    logEvent("wallet.card_saved", { reference: entry.reference });
  };

  const fail = (message, code) => Object.assign(new Error(message), { code });

  // One-tap top-up with the saved card. The charge is confirmed through the
  // same verify path as checkout payments (amount, currency, card country).
  const chargeSavedCard = async (entry, { userId, email, reference, chargeKobo }) => {
    const user = await User.findById(userId, "+savedCard.authorizationCode");
    const code = user && user.savedCard && user.savedCard.authorizationCode;
    if (!code || typeof payment.chargeAuthorization !== "function") {
      await WalletEntry.updateOne({ _id: entry._id, status: "pending" }, { $set: { status: "failed", failureReason: "no_saved_card" } });
      throw fail("You don't have a saved card. Choose another way to pay.", "no_saved_card");
    }
    let charged;
    try {
      charged = await payment.chargeAuthorization({
        email,
        amountKobo: chargeKobo,
        authorizationCode: code,
        reference,
        metadata: { walletReference: reference, purpose: "wallet_funding", payVia: "saved_card" },
      });
    } catch (error) {
      // Unknown: Paystack's webhook or a later verify settles it.
      logEvent("wallet.saved_card_unknown", { reference, code: error && error.code });
      return { entry, pending: true };
    }
    if (charged.status === "success") {
      const result = await confirmFunding(reference, { source: "saved_card" });
      if (result.outcome === "credited" || result.outcome === "already_credited") {
        return { entry: result.entry, balanceKobo: result.balanceKobo ?? (await getBalanceKobo(userId)) };
      }
      return { entry: result.entry || entry, pending: result.outcome === "unpaid" || result.outcome === "in_progress" };
    }
    if (charged.status === "failed") {
      await WalletEntry.updateOne({ _id: entry._id, status: "pending" }, { $set: { status: "failed", failureReason: "card_declined" } });
      throw fail("Your saved card was declined. Try again or choose another way to pay.", "card_declined");
    }
    // e.g. the bank wants an OTP: this can't finish without the customer.
    await WalletEntry.updateOne({ _id: entry._id, status: "pending" }, { $set: { status: "failed", failureReason: "card_needs_otp" } });
    throw fail("Your bank wants to confirm this payment. Please choose “Other ways to pay” and use your card there.", "card_needs_action");
  };

  // Starts a wallet top-up. Test mode credits immediately (no real money);
  // Paystack returns a checkout URL and credits only after verification.
  // Checkout shows every method enabled on Paystack (bank app/OPay, transfer,
  // USSD, card). method "saved_card" charges the customer's saved card
  // instead, without a checkout page. saveCard: remember the card if this
  // top-up is paid by card.
  const startFunding = async ({ userId, email, amountNaira, clientReference, method, saveCard }) => {
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
        saveCard: checkout && saveCard === true ? true : undefined,
        payVia: checkout ? (method === "saved_card" ? "saved_card" : "checkout") : undefined,
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

    if (method === "saved_card") return chargeSavedCard(entry, { userId, email, reference, chargeKobo: quote.chargeKobo });

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
      return { entry: updated || entry, checkoutUrl: init.checkoutUrl, accessCode: init.accessCode || null };
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
      const foreign = isForeignCard(verified, config);
      if (foreign) problems.push("foreign_card");
      if (problems.length > 0) {
        const flagged = await WalletEntry.findOneAndUpdate(
          { _id: entry._id, status: { $in: [...FUNDING_CONFIRMABLE, "failed"] }, needsReview: { $ne: true } },
          {
            $set: {
              status: "failed",
              needsReview: true,
              failureReason: problems.join(","),
              verifiedVia: source,
              ...(verified.cardCountry ? { cardCountry: verified.cardCountry } : {}),
            },
          },
          AFTER
        );
        logEvent("wallet.funding_mismatch", { reference, problems, source, cardCountry: verified.cardCountry || null });
        if (flagged && foreign) {
          const refundStatus = await refundBlockedPayment(payment, reference);
          logEvent("wallet.foreign_card_refund", { reference, refundStatus });
          const updated = await WalletEntry.findOneAndUpdate({ _id: entry._id }, { $set: { refundStatus } }, AFTER);
          return { outcome: "mismatch", entry: updated || flagged };
        }
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
      const applied = await applyFunding(entry, {
        source,
        gatewayTransactionId: verified.gatewayTransactionId,
        paidAt: verified.paidAt,
      });
      if (applied.outcome === "credited") {
        await rememberCard(applied.entry || entry, verified).catch((e) => logEvent("wallet.card_save_failed", { message: e && e.message }));
      }
      return applied;
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
    getSavedCard,
    removeSavedCard,
    debitForOrder,
    reverseDebit,
    recordPurchase,
    refundOrder,
    listEntries,
  };
};

module.exports = { createWalletService, FUNDING_MIN_NAIRA, FUNDING_MAX_NAIRA };
