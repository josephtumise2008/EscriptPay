const mongoose = require("mongoose");

// Daily gift box. One per user per Lagos day (and payment mode). Opening it
// reveals a cashback amount; the cashback is paid into the wallet when the
// user's data order of at least GIFT_BOX_MIN_PURCHASE_NAIRA is delivered the
// same day.
//
// status:
//   opened     — cashback revealed, waiting for a qualifying data order
//   crediting  — a qualifying order was delivered, wallet credit in progress
//   credited   — cashback is in the wallet
//   budget_out — today's gift budget ran out before this one could be paid
const giftBoxSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Lagos calendar day, "YYYY-MM-DD".
    day: { type: String, required: true, trim: true },
    mode: { type: String, enum: ["test", "live"], required: true },
    prizeKobo: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: "prizeKobo must be an integer." },
    },
    status: {
      type: String,
      enum: ["opened", "crediting", "credited", "budget_out"],
      default: "opened",
      required: true,
    },
    openedAt: { type: Date, default: Date.now },
    creditedAt: Date,
    // The data order that unlocked the cashback.
    orderTransactionId: { type: String, trim: true },
  },
  { timestamps: true }
);

giftBoxSchema.index({ user: 1, day: 1, mode: 1 }, { unique: true });
giftBoxSchema.index({ day: 1, mode: 1, status: 1 });

module.exports = mongoose.model("GiftBox", giftBoxSchema);
