const express = require("express");

const {
  getPlans,
  createPlan,
  getPlanById,
  updatePlan,
  deletePlan,
} = require("../controllers/planController");

const router = express.Router();

router.get("/", getPlans);

router.get("/:id", getPlanById);

router.post("/", createPlan);

router.put("/:id", updatePlan);

router.delete("/:id", deletePlan);

module.exports = router;