// Default referral service wired to the real models.
const User = require("../models/User");
const WalletEntry = require("../models/WalletEntry");
const { createReferralService } = require("./referrals");
const { logEvent } = require("../utils/logger");

const { createPushService } = require("./push");
const { getConfig } = require("../config/payments");

const push = createPushService({ logEvent });
const notify = (userIds, message) =>
  push.toUsers(userIds, { ...message, url: `${(getConfig().appUrl || "").replace(/\/+$/, "")}${message.url}`, topic: "referral" });

module.exports = createReferralService({ User, WalletEntry, logEvent, notify });
