const express = require("express");
const { clubkonnectCallback } = require("../controllers/vtuCallbackController");

const router = express.Router();

// Server-to-server from the supplier: no auth cookie. Results are always
// confirmed through the supplier's authenticated query API.
router.all("/clubkonnect/callback", clubkonnectCallback);

module.exports = router;
