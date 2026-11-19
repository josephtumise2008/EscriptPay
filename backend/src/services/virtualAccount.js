// Gives a customer their own bank account number (Paystack Dedicated Virtual
// Account) so they can fund their wallet by transfer from any bank or app.
// Off unless config.virtualAccounts.enabled (Paystack only offers this to
// registered businesses).
const User = require("../models/User");
const { payment, config } = require("./index");
const { logEvent } = require("../utils/logger");

const STUCK_MS = 2 * 60 * 1000;

const view = (va) =>
  va && va.status === "active"
    ? { status: "active", accountNumber: va.accountNumber, accountName: va.accountName, bankName: va.bankName }
    : va && va.status === "requesting"
      ? { status: "requesting" }
      : va && va.status === "failed"
        ? { status: "failed" }
        : null;

const splitName = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0] || "Customer";
  return { firstName: first, lastName: parts.length > 1 ? parts[parts.length - 1] : first };
};

const enabled = () => config.virtualAccounts && config.virtualAccounts.enabled === true && typeof payment.createDedicatedAccount === "function";

const getAccount = async (userId) => {
  const user = await User.findById(userId, { virtualAccount: 1 }).lean();
  return { enabled: enabled(), account: view(user && user.virtualAccount) };
};

const requestAccount = async (userId) => {
  if (!enabled()) return { enabled: false, account: null };
  const now = Date.now();
  // Claim the request so double taps don't create two accounts.
  const claimed = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { "virtualAccount.status": { $exists: false } },
        { "virtualAccount.status": "failed" },
        { "virtualAccount.status": "requesting", "virtualAccount.requestedAt": { $lt: new Date(now - STUCK_MS) } },
      ],
    },
    { $set: { "virtualAccount.status": "requesting", "virtualAccount.requestedAt": new Date(now) }, $unset: { "virtualAccount.failureReason": "" } },
    { returnDocument: "after", projection: { name: 1, email: 1, phone: 1, virtualAccount: 1 } }
  ).lean();
  if (!claimed) return getAccount(userId);

  try {
    let customerCode = claimed.virtualAccount && claimed.virtualAccount.customerCode;
    if (!customerCode) {
      const { firstName, lastName } = splitName(claimed.name);
      ({ customerCode } = await payment.createCustomer({ email: claimed.email, firstName, lastName, phone: claimed.phone }));
      await User.updateOne({ _id: userId }, { $set: { "virtualAccount.customerCode": customerCode } });
    }
    const acct = await payment.createDedicatedAccount({ customerCode, preferredBank: config.virtualAccounts.preferredBank });
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          "virtualAccount.status": "active",
          "virtualAccount.accountNumber": acct.accountNumber,
          "virtualAccount.accountName": acct.accountName,
          "virtualAccount.bankName": acct.bankName,
          "virtualAccount.providerSlug": acct.providerSlug,
          "virtualAccount.dedicatedAccountId": acct.dedicatedAccountId,
          "virtualAccount.assignedAt": new Date(),
        },
      }
    );
    logEvent("wallet.account_assigned", {});
  } catch (error) {
    logEvent("wallet.account_failed", { code: error && error.code, reason: error && error.providerMessage });
    await User.updateOne(
      { _id: userId, "virtualAccount.status": "requesting" },
      { $set: { "virtualAccount.status": "failed", "virtualAccount.failureReason": (error && (error.providerMessage || error.code)) || "error" } }
    );
  }
  return getAccount(userId);
};

module.exports = { getAccount, requestAccount, splitName, view };
