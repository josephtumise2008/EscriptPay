const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getWallet, getBalance, fundWallet, verifyFunding } = require("../controllers/walletController");

const router = express.Router();

router.use(requireAuth);

router.get("/", getWallet);
router.get("/balance", getBalance);
router.post("/fund", fundWallet);
router.post("/verify", verifyFunding);

module.exports = router;
