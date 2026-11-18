const express = require("express");
const { sweep, backup } = require("../controllers/cronController");

const router = express.Router();

router.get("/sweep", sweep);
router.get("/backup", backup);

module.exports = router;
