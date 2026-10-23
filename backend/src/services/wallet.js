// Default wallet instance wired to the real models and configured providers.
const User = require("../models/User");
const WalletEntry = require("../models/WalletEntry");
const Transaction = require("../models/Transaction");
const { payment, config } = require("./index");
const { createWalletService } = require("./walletService");
const { generateWalletReference } = require("../utils/transactionId");
const { logEvent } = require("../utils/logger");

module.exports = createWalletService({
  User,
  WalletEntry,
  Transaction,
  payment,
  config,
  generateReference: generateWalletReference,
  logEvent,
});
