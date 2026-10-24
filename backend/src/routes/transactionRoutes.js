const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  getUserTransactions,
  getTransactionById,
  createDataTransaction,
  createAirtimeTransaction,
  verifyTransactionPayment,
} = require("../controllers/transactionController");

const { requireVerifiedEmail } = require("../services/email/verification");

const router = express.Router();

router.use(requireAuth);

router.get("/", getUserTransactions);
router.get("/:id", getTransactionById);
router.post("/data", requireVerifiedEmail, createDataTransaction);
// Original route name, kept so existing clients keep working.
router.post("/test", requireVerifiedEmail, createDataTransaction);
router.post("/airtime", requireVerifiedEmail, createAirtimeTransaction);
router.post("/verify", verifyTransactionPayment);

module.exports = router;
