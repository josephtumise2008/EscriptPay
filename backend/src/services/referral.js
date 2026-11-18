// Default referral service wired to the real models.
const User = require("../models/User");
const WalletEntry = require("../models/WalletEntry");
const { createReferralService } = require("./referrals");
const { logEvent } = require("../utils/logger");

module.exports = createReferralService({ User, WalletEntry, logEvent });
