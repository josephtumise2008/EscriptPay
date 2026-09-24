const User = require("../models/User");
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
  createdAt: user.createdAt,
});

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

module.exports = { signup, login, logout, me, updateProfile, changePassword };