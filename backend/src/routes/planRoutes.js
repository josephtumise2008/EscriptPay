const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const {
  getPlans,
  createPlan,
  getPlanById,
  updatePlan,
  deletePlan,
} = require("../controllers/planController");

const router = express.Router();

// Public read-only catalog — anyone (even unauthenticated) can list plans.
router.get("/", getPlans);
router.get("/:id", getPlanById);

// Writes are admin-only. The DB role is the real authorization boundary.
router.post("/", requireAuth, requireAdmin, createPlan);
router.put("/:id", requireAuth, requireAdmin, updatePlan);
router.delete("/:id", requireAuth, requireAdmin, deletePlan);

module.exports = router;