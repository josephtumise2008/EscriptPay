const mongoose = require("mongoose");

// Schema notes for existing data: every field added for the Paystack flow is
// optional or has a default, and the original enums only gained values, so
// documents created by the earlier test-mode flow remain valid unchanged.
const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required."],
      index: true,
    },
    transactionId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["data", "airtime"],
      default: "data",
      required: true,
    },
    network: {
      type: String,
      required: true,
      trim: true,
    },
    plan: {
      type: String,
      required: true,
      trim: true,
    },
    // Set for data purchases so the UI can pre-select the exact plan on
    // "Buy Again". Null for airtime (amount-based).
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    // Price in whole Naira, always computed server-side.
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    // Overall status shown to the customer.
    status: {
      type: String,
      enum: ["pending", "successful", "failed"],
      default: "pending",
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["not_required", "pending", "successful", "failed", "expired"],
      default: "not_required",
      required: true,
    },
    // Delivery (fulfilment) status. "pending" = not started yet.
    providerStatus: {
      type: String,
      enum: ["pending", "processing", "successful", "failed", "unknown"],
      default: "pending",
      required: true,
    },
    mode: {
      type: String,
      enum: ["test", "live"],
      default: "test",
      required: true,
    },
    // Client-generated key used for idempotency (prevents duplicate orders).
    clientReference: {
      type: String,
      trim: true,
    },
    // Reference returned by the VTU/airtime supplier.
    providerReference: {
      type: String,
      trim: true,
    },

    // ---- Payment (Paystack) ----
    paymentProvider: {
      type: String,
      enum: ["test", "paystack", "wallet"],
      default: "test",
    },
    // Reference sent to the payment provider. No default: the sparse unique
    // index must not see null values.
    paymentReference: {
      type: String,
      trim: true,
    },
    // Exact amount the provider must confirm, in kobo.
    paymentAmountKobo: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    checkoutUrl: {
      type: String,
    },
    gatewayTransactionId: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
    paymentVerifiedVia: {
      type: String,
      enum: ["callback", "webhook", "reconciliation"],
    },

    // ---- Fulfilment ----
    vtuProvider: {
      type: String,
    },
    fulfillmentAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    fulfillmentStartedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    // Last time the supplier was asked about this order (reconciliation).
    lastStatusCheckAt: {
      type: Date,
    },
    // Supplier's own status code/text, for support and disputes.
    providerStatusCode: {
      type: String,
      trim: true,
    },

    // ---- Operations ----
    // True when a person must look at this order (paid but not delivered,
    // amount mismatch, ambiguous supplier response). Blocks fulfilment.
    needsReview: {
      type: Boolean,
      default: false,
    },
    // Short machine-readable code, safe to show (no provider internals).
    failureReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ user: 1, createdAt: -1 });
// Sparse + unique: an idempotency key must be globally unique, but
// transactions created without one (null/absent) must not collide.
transactionSchema.index({ clientReference: 1 }, { unique: true, sparse: true });
// One order per payment reference. Sparse: test-mode orders have none.
transactionSchema.index({ paymentReference: 1 }, { unique: true, sparse: true });
// Operations queue: orders needing a human, and stuck deliveries.
transactionSchema.index({ needsReview: 1, updatedAt: -1 });
transactionSchema.index({ providerStatus: 1, updatedAt: 1 });

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;
