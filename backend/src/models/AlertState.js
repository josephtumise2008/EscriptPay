const mongoose = require("mongoose");

// Remembers when each kind of owner alert was last sent, so a problem that
// lasts for hours sends one email, not one per check.
const alertStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    lastSentAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AlertState", alertStateSchema);
