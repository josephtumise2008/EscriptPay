const referrals = require("../services/referral");
const { config } = require("../services");
const { getConfig } = require("../config/payments");

// GET /api/referrals — the signed-in user's invite code, link and rewards.
const getReferrals = async (req, res) => {
  try {
    const data = await referrals.summary(req.userId, { mode: config.paymentMode });
    const link = `${getConfig().appUrl}/signup?ref=${encodeURIComponent(data.code)}`;
    return res.json({ success: true, referrals: { ...data, link } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not load your invites." });
  }
};

module.exports = { getReferrals };
