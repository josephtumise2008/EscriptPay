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

    // ---- Supplier mapping (never sent to browsers) ----
    // Which supplier delivers this plan and its plan code there
    // (ClubKonnect "DataPlan" / PRODUCT_ID).
    provider: {
      type: String,
      trim: true,
    },
    providerPlanId: {
      type: String,
      trim: true,
    },
    // What the supplier charges us, in Naira (for margin checks).
    costPrice: {
      type: Number,
      min: 0,
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

planSchema.index({ provider: 1, providerPlanId: 1, network: 1 });

// Supplier codes and our cost price are internal business data.
planSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.costPrice;
    delete ret.provider;
    delete ret.providerPlanId;
    return ret;
  },
});

const Plan = mongoose.model("Plan", planSchema);

module.exports = Plan;
