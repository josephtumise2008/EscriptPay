// Emails the customer what they bought when it's something they must keep:
// an electricity token or exam PINs. Sent once per order (claimed with an
// atomic update), best effort: a failed email never affects the order.
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { sendEmail } = require("./email");
const { billDelivered } = require("./email/templates");
const { config } = require("./index");
const { logEvent } = require("../utils/logger");

const linesFor = (tx) => {
  if (tx.type === "electricity" && tx.token) {
    return [
      ["Token", tx.token],
      ["Meter", tx.account],
      ["Amount", `N${Math.round((tx.faceAmountKobo || tx.amount * 100) / 100).toLocaleString("en-NG")}`],
      ["Company", tx.network],
    ];
  }
  if (tx.type === "exam" && (tx.pins?.length || tx.cardDetails)) {
    if (!tx.pins?.length) return [["PIN details", tx.cardDetails]];
    return tx.pins.flatMap((p, i) => [
      [tx.pins.length > 1 ? `Serial No ${i + 1}` : "Serial No", p.serial],
      [tx.pins.length > 1 ? `PIN ${i + 1}` : "PIN", p.pin],
    ]);
  }
  return null;
};

const emailDelivery = async (tx) => {
  if (!tx || !["electricity", "exam"].includes(tx.type) || !linesFor(tx)) return;
  const claimed = await Transaction.findOneAndUpdate(
    { _id: tx._id, status: "successful", deliveryEmailedAt: { $exists: false } },
    { $set: { deliveryEmailedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!claimed) return;
  const user = await User.findById(claimed.user).select("name email").lean();
  if (!user || !user.email) return;
  const title = claimed.type === "electricity" ? `Your ${claimed.network} token` : `Your ${claimed.network} PIN`;
  const msg = billDelivered({ name: user.name, title, lines: linesFor(claimed), appUrl: config.appUrl });
  try {
    await sendEmail({ to: user.email, ...msg });
  } catch (error) {
    logEvent("bill.email_failed", { transactionId: claimed.transactionId, code: error && error.code });
  }
};

module.exports = { emailDelivery };
