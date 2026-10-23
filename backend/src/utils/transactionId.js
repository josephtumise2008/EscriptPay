const crypto = require("crypto");

const datePart = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
};

const randomPart = () => crypto.randomBytes(3).toString("hex").toUpperCase();

// Human-readable unique transaction id, e.g. ESCP-20260924-A1B2C3
const generateTransactionId = () => `ESCP-${datePart()}-${randomPart()}`;

// Wallet top-up reference, e.g. ESCW-20260924-A1B2C3
const generateWalletReference = () => `ESCW-${datePart()}-${randomPart()}`;

module.exports = { generateTransactionId, generateWalletReference };
