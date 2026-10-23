const jwt = require("jsonwebtoken");
const ContactMessage = require("../models/ContactMessage");
const { logEvent } = require("../utils/logger");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const clean = (value, max) => (typeof value === "string" ? value.trim().slice(0, max + 1) : "");

// Links the message to the signed-in account when there is a valid session
// cookie. Never required: visitors can write without an account.
const optionalUserId = (req) => {
  const token = req.cookies && req.cookies["escriptpay_token"];
  if (!token || !process.env.JWT_SECRET) return undefined;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload && (payload.id || payload.userId || payload.sub);
  } catch {
    return undefined;
  }
};

// POST /api/contact { name, email, message, website }
// `website` is a hidden honeypot field: real visitors leave it empty.
const sendMessage = async (req, res) => {
  const body = req.body || {};
  if (typeof body.website === "string" && body.website.trim()) {
    // Bot: pretend success, store nothing.
    return res.status(201).json({ success: true });
  }

  const name = clean(body.name, 80);
  const email = clean(body.email, 254).toLowerCase();
  const message = clean(body.message, 2000);

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ success: false, field: "name", message: "Enter your name (2–80 characters)." });
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return res.status(400).json({ success: false, field: "email", message: "Enter a valid email address." });
  }
  if (message.length < 10 || message.length > 2000) {
    return res
      .status(400)
      .json({ success: false, field: "message", message: "Your message should be between 10 and 2,000 characters." });
  }

  try {
    await ContactMessage.create({ name, email, message, user: optionalUserId(req) });
    logEvent("contact.received", {});
    return res.status(201).json({ success: true, message: "Thanks — your message has been sent. We'll reply by email." });
  } catch (error) {
    logEvent("contact.error", { message: error && error.message });
    return res.status(500).json({ success: false, message: "Could not send your message. Please try again." });
  }
};

module.exports = { sendMessage };
