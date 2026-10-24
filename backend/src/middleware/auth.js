const jwt = require("jsonwebtoken");

const COOKIE_NAME = "escriptpay_token";

const signToken = (user) => {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// Sets an httpOnly cookie containing the JWT.
const setAuthCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
};

const clearAuthCookie = (res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
  });
};

// Resolves the bearer token from cookie or Authorization header.
const extractToken = (req) => {
  if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return null;
};

// Verifies the token, then checks the account still exists and that the
// token wasn't issued before a forced logout or password change.
const requireAuth = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "Not authenticated." });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
  }

  try {
    const User = require("../models/User");
    const user = await User.findById(payload.sub).select("+sessionsValidAfter").lean();
    const validAfter = user && user.sessionsValidAfter
      ? Math.floor(new Date(user.sessionsValidAfter).getTime() / 1000)
      : 0;
    if (!user || !payload.iat || payload.iat < validAfter) {
      clearAuthCookie(res);
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not check your session." });
  }

  req.userId = payload.sub;
  return next();
};

// Composes with requireAuth. Only users whose DB record has role === "admin"
// may pass. The DB is the real authorization boundary — a forged token still
// has to correspond to a stored admin user.
const requireAdmin = async (req, res, next) => {
  try {
    const User = require("../models/User");
    const user = await User.findById(req.userId).select("role");
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found." });
    }
    if (user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required." });
    }
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: "Authorization failed." });
  }
};

module.exports = { requireAuth, requireAdmin, signToken, setAuthCookie, clearAuthCookie, COOKIE_NAME };