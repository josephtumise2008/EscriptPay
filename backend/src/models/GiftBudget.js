const mongoose = require("mongoose");

// How much gift-box cashback has been paid out on one Lagos day, so the
// total can never pass GIFT_BOX_DAILY_BUDGET_NAIRA. Only changed with a
// conditional $inc in services/giftBoxes.js.
const giftBudgetSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, trim: true },
    mode: { type: String, enum: ["test", "live"], required: true },
    spentKobo: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

giftBudgetSchema.index({ day: 1, mode: 1 }, { unique: true });

module.exports = mongoose.model("GiftBudget", giftBudgetSchema);
