const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    network: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    // Selling price in whole Naira. The server always charges this value.
    price: {
      type: Number,
      required: true,
      min: [1, "Price must be at least ₦1."],
    },

    validity: {
      type: String,
      required: true,
    },

    // Unavailable plans are hidden from the catalogue and cannot be bought.
    // Existing documents without this field are treated as active.
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Plan = mongoose.model("Plan", planSchema);

module.exports = Plan;
