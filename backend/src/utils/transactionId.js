const crypto = require("crypto");

// Human-readable unique transaction id, e.g. ESCP-20260924-A1B2C3
const generateTransactionId = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ESCP-${yyyy}${mm}${dd}-${random}`;
};

module.exports = { generateTransactionId };