const gifts = require("../services/giftBox");
const { config } = require("../services");

// GET /api/gifts/today — today's gift box for the signed-in user.
const getToday = async (req, res) => {
  try {
    const gift = await gifts.status(req.userId, { mode: config.paymentMode });
    return res.json({ success: true, gift });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not load today's gift." });
  }
};

// POST /api/gifts/open — opens today's gift box (once a day).
const openToday = async (req, res) => {
  try {
    const result = await gifts.open(req.userId, { mode: config.paymentMode });
    if (result.outcome === "disabled") {
      return res.status(403).json({ success: false, message: "Daily gifts are paused right now.", gift: result.box });
    }
    return res.json({ success: true, outcome: result.outcome, gift: result.box });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not open your gift. Please try again." });
  }
};

module.exports = { getToday, openToday };
