const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getToday, openToday } = require("../controllers/giftController");

const router = express.Router();

router.use(requireAuth);
router.get("/today", getToday);
router.post("/open", openToday);

module.exports = router;
