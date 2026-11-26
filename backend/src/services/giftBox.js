// Default gift-box service wired to the real models.
const User = require("../models/User");
const WalletEntry = require("../models/WalletEntry");
const GiftBox = require("../models/GiftBox");
const GiftBudget = require("../models/GiftBudget");
const Transaction = require("../models/Transaction");
const { createGiftBoxService } = require("./giftBoxes");
const { logEvent } = require("../utils/logger");

module.exports = createGiftBoxService({ User, WalletEntry, GiftBox, GiftBudget, Transaction, logEvent });
