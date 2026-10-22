const User = require("../models/User");
const crypto = require("crypto");
const { validateNigerianPhone } = require("../utils/validators");
const {
  requireAuth,
  signToken,
  setAuthCookie,
  clearAuthCookie,
} = require("../middleware/auth");

const sanitize = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  state: user.state || "",
  role: user.role || "user",
  createdAt: user.createdAt,
});

// Password-reset tokens are one-time, single-URL, expire after 60 minutes,
// and are stored only as an SHA-256 hash — the raw token never touches the DB.
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const hashResetToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const generateResetToken = () => crypto.randomBytes(32).toString("hex");

const buildResetLink = (token) => {
  const origin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
  return `${origin}/reset-password?token=${encodeURIComponent(token)}`;
};

// POST /api/auth/signup
const signup = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body || {};

    const nameClean = (name || "").trim();
    const emailClean = (email || "").trim().toLowerCase();

    if (nameClean.length < 3) {
      return res
        .status(400)
        .json({ success: false, message: "Enter your full name (minimum 3 characters)." });
    }
    if (!/^\S+@\S+\.\S+$/.test(emailClean)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address." });
    }
    if (!password || password.length < 8) {
      return res
        .status(400)
        .json({ success: false, message: "Password must be at least 8 characters." });
    }
    const phoneCheck = validateNigerianPhone(phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ success: false, message: phoneCheck.message });
    }

    const exists = await User.findOne({ email: emailClean });
    if (exists) {
      return res
        .status(409)
        .json({ success: false, message: "An account with this email already exists." });
    }

    const user = await User.create({
      name: nameClean,
      email: emailClean,
      phone: phoneCheck.normalized,
      password,
    });

    const token = signToken(user);
    setAuthCookie(res, token);

    return res.status(201).json({ success: true, user: sanitize(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "An account with this email already exists." });
    }
    return res.status(500).json({ success: false, message: "Signup failed. Please try again." });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const emailClean = (email || "").trim().toLowerCase();

    if (!emailClean || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const user = await User.findOne({ email: emailClean }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    return res.json({ success: true, user: sanitize(user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Login failed. Please try again." });
  }
};

// POST /api/auth/logout
const logout = (req, res) => {
  clearAuthCookie(res);
  return res.json({ success: true, message: "Logged out." });
};

// GET /api/auth/me
const me = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      clearAuthCookie(res);
      return res.status(404).json({ success: false, message: "User not found." });
    }
    return res.json({ success: true, user: sanitize(user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load account." });
  }
};

// PUT /api/auth/me — update name / phone / state
const updateProfile = async (req, res) => {
  try {
    const { name, phone, state } = req.body || {};
    const updates = {};

    if (typeof name === "string") {
      const nameClean = name.trim();
      if (nameClean.length < 3) {
        return res
          .status(400)
          .json({ success: false, message: "Name must be at least 3 characters." });
      }
      updates.name = nameClean;
    }
    if (typeof phone === "string") {
      const phoneCheck = validateNigerianPhone(phone);
      if (!phoneCheck.valid) {
        return res.status(400).json({ success: false, message: phoneCheck.message });
      }
      updates.phone = phoneCheck.normalized;
    }
    if (typeof state === "string") {
      const stateClean = state.trim();
      if (stateClean.length > 40) {
        return res
          .status(400)
          .json({ success: false, message: "State must be at most 40 characters." });
      }
      updates.state = stateClean;
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    return res.json({ success: true, user: sanitize(user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update profile." });
  }
};

// POST /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Current and new passwords are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters." });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: "New password must differ from your current password." });
    }

    const user = await User.findById(req.userId).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }

    user.password = newPassword;
    await user.save();

    return res.json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to change password." });
  }
};

// POST /api/auth/forgot-password
//
// Generates a single-use reset token, stores its hash + expiry on the user,
// and (in the future) emails a reset link. We intentionally return the same
// generic response whether or not the email exists, so attackers cannot use
// this endpoint to enumerate registered accounts.
//
// STAGING: email delivery is not connected yet. In non-production the reset
// link is printed to the server console so the flow can be tested end-to-end.
const forgotPassword = async (req, res) => {
  try {
    const emailClean = ((req.body || {}).email || "").trim().toLowerCase();
    const generic = {
      success: true,
      message: "If an account exists for that email, a password reset link has been sent.",
    };

    if (!/^\S+@\S+\.\S+$/.test(emailClean)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address." });
    }

    const user = await User.findOne({ email: emailClean }).select("_id name email");
    if (!user) {
      return res.status(200).json(generic);
    }

    const token = generateResetToken();
    user.resetTokenHash = hashResetToken(token);
    user.resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    if (process.env.NODE_ENV !== "production") {
      // STAGING HELP: replace with a real email send (SendGrid/Postmark/etc.)
      // in production. logRelevant* is intentionally console-only here.
      console.log(
        `[forgot-password] reset link for ${user.email}: ${buildResetLink(token)} ` +
          `(expires in 60 minutes)`
      );
    }

    // Email dispatch (e.g. sendResetEmail(to, link)) is a future integration.
    return res.status(200).json(generic);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("authController.forgotPassword:", error.message);
    }
    return res.status(500).json({ success: false, message: "Could not process the request." });
  }
};

// POST /api/auth/reset-password  { token, password }
//
// Verifies the raw token against the stored hash and expiry, then sets the
// new password and expires the token immediately (single use). Rate-limited.
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (!token || typeof token !== "string") {
      return res.status(400).json({ success: false, message: "Reset token is required." });
    }
    if (!password || password.length < 8) {
      return res
        .status(400)
        .json({ success: false, message: "Password must be at least 8 characters." });
    }

    const tokenHash = hashResetToken(token.trim());
    const user = await User.findOne({ resetTokenHash: tokenHash }).select(
      "+resetTokenHash +resetTokenExpires"
    );

    if (
      !user ||
      !user.resetTokenExpires ||
      user.resetTokenExpires.getTime() < Date.now()
    ) {
      return res
        .status(400)
        .json({ success: false, message: "This reset link is invalid or has expired." });
    }

    user.password = password;
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    return res.json({ success: true, message: "Password reset successful. You can now sign in." });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("authController.resetPassword:", error.message);
    }
    return res.status(500).json({ success: false, message: "Could not reset your password." });
  }
};

module.exports = { signup, login, logout, me, updateProfile, changePassword, forgotPassword, resetPassword };