const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  getUserTransactions,
  getTransactionById,
  createTestTransaction,
  createAirtimeTransaction,
} = require("../controllers/transactionController");

const router = express.Router();

router.use(requireAuth);

router.get("/", getUserTransactions);
router.get("/:id", getTransactionById);
router.post("/test", createTestTransaction);
router.post("/airtime", createAirtimeTransaction);

module.exports = router;