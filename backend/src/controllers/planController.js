const Plan = require("../models/Plan");

// Only these fields may be written by the admin endpoints (no mass assignment).
const PLAN_FIELDS = ["network", "name", "price", "validity", "active"];
const pickPlanFields = (body = {}) =>
  Object.fromEntries(Object.entries(body || {}).filter(([key]) => PLAN_FIELDS.includes(key)));

// Get all plans
const getPlans = async (req, res) => {
  try {
    // Plans explicitly marked inactive are hidden; older plans without the
    // field are treated as active.
    const plans = await Plan.find({ active: { $ne: false } });

    // Same for everyone: let Vercel's CDN serve it for 2 minutes (and an
    // older copy for up to 10 more while it refreshes), so busy times don't
    // hit the database. Price edits show within ~2 minutes.
    res.set("Cache-Control", "public, max-age=0, s-maxage=120, stale-while-revalidate=600");
    res.json({
      success: true,
      count: plans.length,
      plans,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch plans",
    });
  }
};

// Create a new plan
const createPlan = async (req, res) => {
  try {
    const plan = await Plan.create(pickPlanFields(req.body));

    res.status(201).json({
      success: true,
      message: "Plan created successfully",
      plan,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create plan",
    });
  }
};

// Get one plan by ID
const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await Plan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    res.json({
      success: true,
      plan,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch plan",
    });
  }
};

// Update a plan
const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedPlan = await Plan.findByIdAndUpdate(
      id,
      { $set: pickPlanFields(req.body) },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!updatedPlan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    res.json({
      success: true,
      message: "Plan updated successfully",
      plan: updatedPlan,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update plan",
    });
  }
};

// Delete a plan
const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedPlan = await Plan.findByIdAndDelete(id);

    if (!deletedPlan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    res.json({
      success: true,
      message: "Plan deleted successfully",
      plan: deletedPlan,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete plan",
    });
  }
};

module.exports = {
  getPlans,
  createPlan,
  getPlanById,
  updatePlan,
  deletePlan,
};