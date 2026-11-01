const mongoose = require("mongoose");

// Wallet ledger. Every change to a user's wallet balance has one entry here:
//   funding  (credit) — money added through the payment provider
//   purchase (debit)  — an order paid from the wallet
//   refund   (credit) — a wallet-paid order the supplier definitively failed
//
// Amounts are integers in kobo. The balance itself lives on the User
// (walletBalances.<mode>) and is only changed with atomic $inc updates; this
// ledger is the audit trail and the idempotency guard for credits.
const walletEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Unique id shown to the customer (ESCW-… funding, ESCP-… order id for a
    // purchase, RF-ESCP-… refund). Unique: a credit can never apply twice.
    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    kind: {
      type: String,
      enum: ["funding", "purchase", "refund"],
      required: true,
    },
    direction: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    amountKobo: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: "amountKobo must be an integer." },
    },
    // Funding: what the customer is charged (amount + card fee) and the fee.
    // The provider must confirm exactly chargedKobo.
    chargedKobo: {
      type: Number,
      min: 0,
    },
    feeKobo: {
      type: Number,
      min: 0,
      default: 0,
    },
    // Balance right after this entry was applied (set once applied).
    balanceAfterKobo: {
      type: Number,
      min: 0,
    },
    // pending   — funding started, waiting for payment
    // crediting — payment verified, balance update in progress
    // successful / failed / expired
    status: {
      type: String,
      enum: ["pending", "crediting", "successful", "failed", "expired"],
      default: "pending",
      required: true,
    },
    mode: {
      type: String,
      enum: ["test", "live"],
      required: true,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    paymentProvider: {
      type: String,
      enum: ["test", "paystack", "wallet"],
    },
    // Funding only. No default: the sparse unique index must not see nulls.
    paymentReference: {
      type: String,
      trim: true,
    },
    checkoutUrl: String,
    gatewayTransactionId: String,
    paidAt: Date,
    verifiedVia: {
      type: String,
      enum: ["test", "callback", "webhook", "reconciliation"],
    },
    // Purchase/refund: the order this entry belongs to.
    orderTransactionId: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    clientReference: {
      type: String,
      trim: true,
    },
    needsReview: {
      type: Boolean,
      default: false,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    // Card issuing country (ISO) when a payment was blocked for it, and the
    // state of the automatic refund: requested | failed | not_supported.
    cardCountry: { type: String, trim: true },
    refundStatus: { type: String, trim: true },
    // When the owner was emailed about this needing review.
    alertedAt: { type: Date },
  },
  { timestamps: true }
);

walletEntrySchema.index({ user: 1, createdAt: -1 });
walletEntrySchema.index({ paymentReference: 1 }, { unique: true, sparse: true });
walletEntrySchema.index({ clientReference: 1 }, { unique: true, sparse: true });
walletEntrySchema.index({ status: 1, updatedAt: 1 });

walletEntrySchema.methods.toJSON = function toJSON() {
  return {
    id: String(this._id),
    reference: this.reference,
    kind: this.kind,
    direction: this.direction,
    amount: this.amountKobo / 100,
    fee: (this.feeKobo || 0) / 100,
    charged: (this.chargedKobo || this.amountKobo) / 100,
    balanceAfter: typeof this.balanceAfterKobo === "number" ? this.balanceAfterKobo / 100 : null,
    status: this.status,
    mode: this.mode,
    paymentProvider: this.paymentProvider,
    orderTransactionId: this.orderTransactionId || null,
    description: this.description || "",
    failureReason: this.failureReason || null,
    refundStatus: this.refundStatus || null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("WalletEntry", walletEntrySchema);
