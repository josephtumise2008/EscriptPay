const express = require("express");
const { sweep } = require("../controllers/cronController");

const router = express.Router();

router.get("/sweep", sweep);

module.exports = router;
