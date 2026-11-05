const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getCatalog, verify } = require("../controllers/billController");

const router = express.Router();

router.get("/catalog", getCatalog);
router.post("/verify", requireAuth, verify);

module.exports = router;
