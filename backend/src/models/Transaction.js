const mongoose = require("mongoose");

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
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "successful", "failed"],
      default: "pending",
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["not_required", "pending", "successful", "failed"],
      default: "not_required",
      required: true,
    },
    providerStatus: {
      type: String,
      enum: ["pending", "successful", "failed"],
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
    // Reference returned by the (future) VTU/airtime provider.
    providerReference: {
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

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;