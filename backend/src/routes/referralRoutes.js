const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getReferrals } = require("../controllers/referralController");

const router = express.Router();

router.use(requireAuth);
router.get("/", getReferrals);

module.exports = router;
