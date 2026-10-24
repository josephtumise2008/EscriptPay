const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getWallet, getBalance, fundWallet, verifyFunding, quoteFunding } = require("../controllers/walletController");

const { requireVerifiedEmail } = require("../services/email/verification");

const router = express.Router();

router.use(requireAuth);

router.get("/", getWallet);
router.get("/balance", getBalance);
router.get("/quote", quoteFunding);
router.post("/fund", requireVerifiedEmail, fundWallet);
router.post("/verify", verifyFunding);

module.exports = router;
