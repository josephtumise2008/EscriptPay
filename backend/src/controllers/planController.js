const Plan = require("../models/Plan");

// Get all plans
const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find();

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
    const { network, name, price, validity } = req.body;

    const plan = await Plan.create({
      network,
      name,
      price,
      validity,
    });

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
      req.body,
      {
        new: true,
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