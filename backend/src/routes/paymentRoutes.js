const express = require("express");
const { paystackWebhook } = require("../controllers/paymentWebhookController");

const router = express.Router();

// Paystack calls this server-to-server. No auth cookie, no rate limit: the
// HMAC signature is the authentication.
router.post("/paystack/webhook", paystackWebhook);

module.exports = router;
