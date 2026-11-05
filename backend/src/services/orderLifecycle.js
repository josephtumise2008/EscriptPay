// Order lifecycle: payment confirmation and fulfilment.
//
// THE RULE: airtime/data is never requested from the supplier until the
// server has verified the payment with the payment provider (or, in pure
// test mode, payment is "not_required" AND delivery is simulated).
//
// States on a Transaction:
//   paymentStatus:  not_required | pending | successful | failed | expired
//   providerStatus: pending (not started) | processing (claimed / sent to
//                   supplier) | successful | failed | unknown (ambiguous —
//                   needs reconciliation, never auto-retried)
//   status:         overall, shown to the customer: pending | successful | failed
//   needsReview:    true when a human must look (paid but undelivered, amount
//                   mismatch, ambiguous supplier response)
//
// Concurrency: every state change is a single-document conditional update
// (findOneAndUpdate with the expected current state in the filter). MongoDB
// applies these atomically per document, so when a callback verification and
// a webhook (or two webhooks) race, exactly one of them wins each transition
// and only the winner calls the supplier.

const PAYMENT_CONFIRMABLE = ["pending", "expired", "failed"];
// How long the supplier may take to show an order before "no such order"
// is believed.
const NOT_FOUND_GRACE_MS = Number(process.env.VTU_NOT_FOUND_GRACE_SECONDS || 60) * 1000;
const AFTER = { returnDocument: "after" };
// Connection failures (the request never left us) are retried at once, this
// many times in total, with these pauses in between.
const SEND_ATTEMPTS = 3;
const SEND_RETRY_DELAYS_MS = [400, 1200];
// When the supplier says it has no record of an order (and gave us no order
// reference), send it again this many times before giving up and refunding.
const MAX_RESENDS = Number(process.env.VTU_MAX_RESENDS ?? 1);
// ...but only once the order is at least this old, so a request that is
// still in flight isn't sent twice.
const RESEND_AFTER_MS = Number(process.env.VTU_RESEND_AFTER_SECONDS || 20) * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { isForeignCard, refundBlockedPayment } = require("./payment/cardCheck");

// Fields that carry what the customer bought (electricity token, PINs).
const { parsePins } = require("./billsText");
const deliverables = (result, tx) => {
  const set = {};
  if (result && result.token && !(tx && tx.token)) set.token = String(result.token).slice(0, 200);
  if (result && result.cardDetails && !(tx && tx.cardDetails)) {
    set.cardDetails = String(result.cardDetails).slice(0, 2000);
    const pins = parsePins(result.cardDetails);
    if (pins.length) set.pins = pins;
  }
  return set;
};

const createOrderLifecycle = ({ Transaction, Plan, payment, vtu, config, logEvent = () => {}, onDelivered = null }) => {
  const reload = (id) => Transaction.findById(id);
  const delivered = (tx) => {
    if (tx && onDelivered) Promise.resolve(onDelivered(tx)).catch(() => {});
  };

  // Verify a payment with the provider and record the result. Idempotent:
  // safe to call any number of times, from the callback page and webhooks.
  const confirmPayment = async (reference, { source }) => {
    const tx = await Transaction.findOne({ paymentReference: reference });
    if (!tx) return { outcome: "not_found", tx: null };
    if (tx.paymentStatus === "successful") return { outcome: "already_paid", tx };
    if (tx.paymentStatus === "not_required") return { outcome: "not_applicable", tx };
    if (tx.needsReview) return { outcome: "needs_review", tx };

    // Throws PaymentProviderError on network/provider problems — the caller
    // decides how to respond; nothing has been changed yet.
    const verified = await payment.verifyPayment(reference);

    if (verified.status === "success") {
      const problems = [];
      if (verified.reference !== reference) problems.push("reference_mismatch");
      if (verified.currency !== config.currency) problems.push("currency_mismatch");
      if (!Number.isInteger(verified.amountKobo) || verified.amountKobo !== tx.paymentAmountKobo) {
        problems.push("amount_mismatch");
      }
      const foreign = isForeignCard(verified, config);
      if (foreign) problems.push("foreign_card");

      if (problems.length > 0) {
        // Money was taken but not for this exact order (or from a card we do
        // not accept): never deliver; flag for review. needsReview in the
        // filter means only one caller wins the flag (and the refund).
        const flagged = await Transaction.findOneAndUpdate(
          { _id: tx._id, paymentStatus: { $in: PAYMENT_CONFIRMABLE }, needsReview: { $ne: true } },
          {
            $set: {
              paymentStatus: "failed",
              status: "failed",
              needsReview: true,
              failureReason: problems.join(","),
              paymentVerifiedVia: source,
              ...(verified.cardCountry ? { cardCountry: verified.cardCountry } : {}),
            },
          },
          AFTER
        );
        logEvent("payment.mismatch", { transactionId: tx.transactionId, problems, source, cardCountry: verified.cardCountry || null });
        if (flagged && foreign) {
          const refundStatus = await refundBlockedPayment(payment, reference);
          logEvent("payment.foreign_card_refund", { transactionId: tx.transactionId, refundStatus });
          const updated = await Transaction.findOneAndUpdate({ _id: tx._id }, { $set: { refundStatus } }, AFTER);
          return { outcome: "mismatch", tx: updated || flagged };
        }
        return { outcome: "mismatch", tx: flagged || (await reload(tx._id)) };
      }

      const paid = await Transaction.findOneAndUpdate(
        { _id: tx._id, paymentStatus: { $in: PAYMENT_CONFIRMABLE }, needsReview: { $ne: true } },
        {
          $set: {
            paymentStatus: "successful",
            status: "pending",
            paidAt: verified.paidAt ? new Date(verified.paidAt) : new Date(),
            paymentVerifiedVia: source,
            gatewayTransactionId: verified.gatewayTransactionId,
          },
          $unset: { failureReason: "" },
        },
        AFTER
      );

      if (!paid) {
        const current = await reload(tx._id);
        return { outcome: current && current.paymentStatus === "successful" ? "already_paid" : "conflict", tx: current };
      }
      logEvent("payment.confirmed", { transactionId: paid.transactionId, source });
      return { outcome: "paid", tx: paid };
    }

    if (verified.status === "failed" || verified.status === "reversed") {
      const failed = await Transaction.findOneAndUpdate(
        { _id: tx._id, paymentStatus: { $in: ["pending", "expired"] } },
        { $set: { paymentStatus: "failed", status: "failed", failureReason: `payment_${verified.status}` } },
        AFTER
      );
      logEvent("payment.failed", { transactionId: tx.transactionId, source, providerStatus: verified.status });
      return { outcome: "failed", tx: failed || (await reload(tx._id)) };
    }

    // abandoned / ongoing / pending / processing / queued … : not paid (yet).
    const ageMs = Date.now() - new Date(tx.createdAt).getTime();
    if (tx.paymentStatus === "pending" && ageMs > config.paymentExpiryMinutes * 60 * 1000) {
      // "expired" is reversible: a later verified success still confirms it.
      const expired = await Transaction.findOneAndUpdate(
        { _id: tx._id, paymentStatus: "pending" },
        { $set: { paymentStatus: "expired", status: "failed", failureReason: "payment_expired" } },
        AFTER
      );
      return { outcome: "expired", tx: expired || (await reload(tx._id)) };
    }
    return { outcome: "unpaid", tx };
  };

  const canFulfill = (tx) => {
    if (!tx || tx.needsReview) return false;
    if (tx.paymentStatus === "successful") return true;
    // Pure test mode only: no payment AND simulated delivery.
    return tx.paymentStatus === "not_required" && config.paymentProvider === "test" && vtu.simulated === true;
  };

  // Claims the order (pending -> processing) and asks the supplier exactly
  // once. Never retries a possibly-chargeable request automatically.
  const fulfillOrder = async (txOrId) => {
    const tx = txOrId && txOrId._id ? txOrId : await reload(txOrId);
    if (!canFulfill(tx)) {
      logEvent("fulfilment.blocked", { transactionId: tx && tx.transactionId, paymentStatus: tx && tx.paymentStatus });
      return { outcome: "blocked", tx };
    }

    const claimed = await Transaction.findOneAndUpdate(
      {
        _id: tx._id,
        providerStatus: "pending",
        paymentStatus: tx.paymentStatus,
        needsReview: { $ne: true },
      },
      {
        $set: { providerStatus: "processing", fulfillmentStartedAt: new Date(), vtuProvider: vtu.name },
        $inc: { fulfillmentAttempts: 1 },
      },
      AFTER
    );
    if (!claimed) return { outcome: "already_claimed", tx: await reload(tx._id) };

    return dispatch(claimed);
  };

  // Sends a claimed (providerStatus "processing") order to the supplier and
  // records the result. Requests that certainly never reached the supplier
  // (connection failures) are retried immediately; anything ambiguous
  // (timeout, unreadable reply) is never re-sent blindly: it becomes
  // "unknown" and reconcileOrder asks the supplier first.
  const dispatch = async (claimed) => {
    let plan = null;
    if (claimed.type === "data" && claimed.planId && Plan) {
      plan = await Plan.findById(claimed.planId);
    }

    let result;
    let notSent = false;
    for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt += 1) {
      notSent = false;
      try {
        result = await vtu.purchase({
          type: claimed.type,
          network: claimed.network,
          phone: claimed.phone,
          amount: claimed.amount,
          plan,
          transaction: claimed,
          requestId: claimed.transactionId,
        });
        notSent = Boolean(result && result.outcome === "failed" && result.notSent);
      } catch (error) {
        result = { outcome: "unknown", errorCode: error && error.code, status: `error_${(error && error.code) || "unknown"}` };
        notSent = Boolean(error && error.code === "not_sent");
      }
      if (!notSent || attempt === SEND_ATTEMPTS) break;
      logEvent("fulfilment.retry", { transactionId: claimed.transactionId, attempt, errorCode: result && result.errorCode });
      await sleep(SEND_RETRY_DELAYS_MS[attempt - 1] || 1000);
    }
    // Still couldn't connect after the quick retries: the supplier certainly
    // never got it, so stop now (wallet orders are refunded straight away)
    // and tell the customer it was a network connection error.
    if (notSent) {
      result = { outcome: "failed", errorCode: (result && result.errorCode) || "not_sent", networkError: true };
    }

    const outcome = ["delivered", "accepted", "failed"].includes(result && result.outcome) ? result.outcome : "unknown";
    const paid = claimed.paymentStatus === "successful";
    const set = { lastStatusCheckAt: new Date() };
    if (result && result.reference) set.providerReference = result.reference;
    if (result && (result.statusCode !== undefined && result.statusCode !== null)) set.providerStatusCode = String(result.statusCode);
    else if (result && result.status) set.providerStatusCode = String(result.status).slice(0, 40);
    if (result && result.attention) logEvent("vtu.attention", { transactionId: claimed.transactionId, statusCode: set.providerStatusCode });
    if (result && result.errorCode) set.purchaseErrorCode = String(result.errorCode).slice(0, 40);
    Object.assign(set, deliverables(result, claimed));

    if (outcome === "delivered") {
      Object.assign(set, { providerStatus: "successful", status: "successful", deliveredAt: new Date() });
    } else if (outcome === "failed") {
      Object.assign(set, {
        providerStatus: "failed",
        status: "failed",
        failureReason: result.networkError ? "network_error" : "delivery_failed",
        // Paid but definitively not delivered: wallet orders are refunded
        // automatically; card payments need a person to refund.
        needsReview: paid && claimed.paymentProvider !== "wallet",
      });
    } else if (outcome === "accepted") {
      // Supplier took the order but has not confirmed delivery yet.
      Object.assign(set, { providerStatus: "processing", status: "pending" });
    } else {
      Object.assign(set, {
        providerStatus: "unknown",
        status: "pending",
        needsReview: true,
        failureReason: "delivery_unconfirmed",
      });
    }

    const updated = await Transaction.findOneAndUpdate(
      { _id: claimed._id, providerStatus: "processing" },
      { $set: set },
      AFTER
    );
    logEvent("fulfilment.result", { transactionId: claimed.transactionId, outcome, errorCode: result && result.errorCode });
    if (outcome === "delivered") delivered(updated);
    return { outcome, tx: updated || (await reload(claimed._id)) };
  };

  // Asks the supplier for the final result of an order that was accepted but
  // not confirmed ("processing"), or whose outcome was ambiguous ("unknown",
  // e.g. a timeout). Idempotent and throttled; never re-sends the purchase.
  //   -> { outcome: "delivered" | "failed" | "pending" | "skipped", tx }
  const reconcileOrder = async (txOrId, { minIntervalMs, source = "poll", notFoundGraceMs = NOT_FOUND_GRACE_MS } = {}) => {
    const interval = Number.isFinite(minIntervalMs) ? minIntervalMs : config.statusCheckIntervalMs || 20000;
    const tx = txOrId && txOrId._id ? txOrId : await reload(txOrId);
    if (!tx || !["processing", "unknown"].includes(tx.providerStatus) || typeof vtu.queryStatus !== "function") {
      return { outcome: "skipped", tx };
    }
    // An order claimed seconds ago may still be waiting on its first response.
    const started = tx.fulfillmentStartedAt ? new Date(tx.fulfillmentStartedAt).getTime() : 0;
    if (tx.providerStatus === "processing" && !tx.providerReference && Date.now() - started < 30 * 1000) {
      return { outcome: "skipped", tx };
    }
    const last = tx.lastStatusCheckAt ? new Date(tx.lastStatusCheckAt).getTime() : 0;
    if (Date.now() - last < interval) return { outcome: "skipped", tx };

    // Claim this check so parallel pollers don't all hit the supplier.
    const claimed = await Transaction.findOneAndUpdate(
      {
        _id: tx._id,
        providerStatus: { $in: ["processing", "unknown"] },
        $or: [{ lastStatusCheckAt: { $exists: false } }, { lastStatusCheckAt: { $lte: new Date(Date.now() - interval) } }],
      },
      { $set: { lastStatusCheckAt: new Date() } },
      AFTER
    );
    if (!claimed) return { outcome: "skipped", tx: await reload(tx._id) };

    let result;
    try {
      result = await vtu.queryStatus({ transaction: claimed });
    } catch (error) {
      logEvent("reconcile.error", { transactionId: claimed.transactionId, code: error && error.code });
      return { outcome: "pending", tx: claimed };
    }

    const set = deliverables(result, claimed);
    if (result.reference && !claimed.providerReference) set.providerReference = result.reference;
    if (result.statusCode !== undefined && result.statusCode !== null) set.providerStatusCode = String(result.statusCode);
    // The supplier's own figure for what this order cost us. ClubKonnect's
    // status query reports the product's face value (e.g. 100 for ₦100
    // airtime) while its history shows the discounted amount actually taken
    // (97). So only use it when it is LOWER than the cost we already know.
    if (Number.isFinite(result.amountCharged) && result.amountCharged > 0) {
      const supplierKobo = Math.round(result.amountCharged * 100);
      if (!Number.isFinite(claimed.costKobo) || supplierKobo < claimed.costKobo) {
        set.costKobo = supplierKobo;
        set.costSource = "supplier";
      }
    }

    // The supplier has no record of an order we sent minutes ago and never got
    // an order reference for: it never arrived (e.g. a timeout before they
    // received it). Nothing was charged, so treat it as failed (wallet orders
    // are then refunded automatically by the caller).
    const ageMs = Date.now() - new Date(claimed.fulfillmentStartedAt || claimed.createdAt).getTime();
    const neverArrived = result.outcome === "not_found" && !claimed.providerReference && ageMs >= notFoundGraceMs;
    if (result.outcome === "not_found" && !set.providerStatusCode && result.status) set.providerStatusCode = String(result.status).slice(0, 40);

    // The supplier never got it: send it again (same RequestID) so the
    // customer still gets their airtime/data, before ever refunding.
    const canResend =
      result.outcome === "not_found" && !claimed.providerReference && ageMs >= RESEND_AFTER_MS && (claimed.resendCount || 0) < MAX_RESENDS;
    if (canResend) {
      const resending = await Transaction.findOneAndUpdate(
        {
          _id: claimed._id,
          providerStatus: { $in: ["processing", "unknown"] },
          ...(claimed.resendCount ? { resendCount: claimed.resendCount } : { $or: [{ resendCount: { $exists: false } }, { resendCount: 0 }] }),
        },
        {
          $set: { ...set, providerStatus: "processing", status: "pending", needsReview: false, fulfillmentStartedAt: new Date() },
          $unset: { failureReason: "" },
          $inc: { resendCount: 1, fulfillmentAttempts: 1 },
        },
        AFTER
      );
      if (resending) {
        logEvent("fulfilment.resend", { transactionId: claimed.transactionId, source });
        const sent = await dispatch(resending);
        return { outcome: sent.outcome === "delivered" ? "delivered" : sent.outcome === "failed" ? "failed" : "pending", tx: sent.tx };
      }
      return { outcome: "pending", tx: await reload(claimed._id) };
    }

    let outcome = "pending";
    if (neverArrived) {
      outcome = "failed";
      Object.assign(set, {
        providerStatus: "failed",
        status: "failed",
        failureReason: "not_received_by_supplier",
        needsReview: claimed.paymentStatus === "successful" && claimed.paymentProvider !== "wallet",
      });
    } else if (result.outcome === "delivered") {
      outcome = "delivered";
      Object.assign(set, { providerStatus: "successful", status: "successful", deliveredAt: new Date(), needsReview: false });
    } else if (result.outcome === "failed") {
      outcome = "failed";
      const paid = claimed.paymentStatus === "successful";
      Object.assign(set, {
        providerStatus: "failed",
        status: "failed",
        failureReason: "delivery_failed",
        // Wallet orders are refunded automatically by the caller; card
        // payments need a person to refund.
        needsReview: paid && claimed.paymentProvider !== "wallet",
      });
    }

    const update = { $set: set };
    if (outcome === "delivered") update.$unset = { failureReason: "" };
    const updated = await Transaction.findOneAndUpdate(
      { _id: claimed._id, providerStatus: { $in: ["processing", "unknown"] } },
      update,
      AFTER
    );
    logEvent("reconcile.result", { transactionId: claimed.transactionId, outcome, source, statusCode: set.providerStatusCode });
    if (outcome === "delivered") delivered(updated);
    if (result.attention) logEvent("vtu.attention", { transactionId: claimed.transactionId, statusCode: set.providerStatusCode });
    return { outcome, tx: updated || (await reload(claimed._id)) };
  };

  return { confirmPayment, fulfillOrder, canFulfill, reconcileOrder };
};

module.exports = { createOrderLifecycle, PAYMENT_CONFIRMABLE };
