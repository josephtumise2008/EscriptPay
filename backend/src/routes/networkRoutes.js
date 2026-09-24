const express = require("express");
const { getNetworks } = require("../controllers/networkController");

const router = express.Router();

router.get("/", getNetworks);

module.exports = router;