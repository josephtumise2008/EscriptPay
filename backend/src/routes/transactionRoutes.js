const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  getUserTransactions,
  getTransactionById,
  createDataTransaction,
  createAirtimeTransaction,
  verifyTransactionPayment,
} = require("../controllers/transactionController");

const router = express.Router();

router.use(requireAuth);

router.get("/", getUserTransactions);
router.get("/:id", getTransactionById);
router.post("/data", createDataTransaction);
// Original route name, kept so existing clients keep working.
router.post("/test", createDataTransaction);
router.post("/airtime", createAirtimeTransaction);
router.post("/verify", verifyTransactionPayment);

module.exports = router;
