// Email verification codes.
//
// - 6 digits from a cryptographically secure generator, valid 10 minutes.
// - Stored only as a salted SHA-256 hash; compared in constant time.
// - At most 5 wrong attempts per code, then a new code is needed.
// - A new code can be requested once a minute.
// Verification is REQUIRED only when an email provider is configured, so a
// missing email setup can never lock everyone out.
const crypto = require("crypto");
const User = require("../../models/User");
const { sendEmail, isConfigured } = require("./index");
const templates = require("./templates");

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const verificationRequired = () => isConfigured() && process.env.EMAIL_VERIFICATION !== "off";

const hashCode = (userId, code) =>
  crypto.createHash("sha256").update(`${process.env.JWT_SECRET || ""}:${userId}:${code}`).digest("hex");

const sendVerificationCode = async (userId) => {
  const user = await User.findById(userId).select("+emailCodeSentAt name email emailVerified");
  if (!user) return { outcome: "not_found" };
  if (user.emailVerified) return { outcome: "already_verified" };

  const last = user.emailCodeSentAt ? new Date(user.emailCodeSentAt).getTime() : 0;
  const wait = last + RESEND_COOLDOWN_MS - Date.now();
  if (wait > 0) return { outcome: "cooldown", retryAfter: Math.ceil(wait / 1000) };

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  // Claim the send atomically so double clicks don't send two codes.
  const claimed = await User.findOneAndUpdate(
    {
      _id: user._id,
      $or: [{ emailCodeSentAt: { $exists: false } }, { emailCodeSentAt: { $lte: new Date(Date.now() - RESEND_COOLDOWN_MS) } }],
    },
    {
      $set: {
        emailCodeHash: hashCode(String(user._id), code),
        emailCodeExpires: new Date(Date.now() + CODE_TTL_MS),
        emailCodeAttempts: 0,
        emailCodeSentAt: new Date(),
      },
    }
  );
  if (!claimed) return { outcome: "cooldown", retryAfter: 60 };

  const mail = templates.verificationCode({ name: user.name, code, minutes: CODE_TTL_MS / 60000 });
  const result = await sendEmail({ to: user.email, ...mail });
  return { outcome: result.sent ? "sent" : "not_sent", retryAfter: RESEND_COOLDOWN_MS / 1000 };
};

const verifyCode = async (userId, rawCode) => {
  const code = String(rawCode || "").replace(/\D/g, "");
  if (code.length !== 6) return { outcome: "invalid" };
  const user = await User.findById(userId).select("+emailCodeHash +emailCodeExpires +emailCodeAttempts emailVerified");
  if (!user) return { outcome: "not_found" };
  if (user.emailVerified) return { outcome: "already_verified" };
  if (!user.emailCodeHash || !user.emailCodeExpires || new Date(user.emailCodeExpires).getTime() < Date.now()) {
    return { outcome: "expired" };
  }
  if ((user.emailCodeAttempts || 0) >= MAX_ATTEMPTS) return { outcome: "too_many" };

  const expected = Buffer.from(user.emailCodeHash, "hex");
  const given = Buffer.from(hashCode(String(user._id), code), "hex");
  const ok = expected.length === given.length && crypto.timingSafeEqual(expected, given);
  if (!ok) {
    const updated = await User.findOneAndUpdate(
      { _id: user._id },
      { $inc: { emailCodeAttempts: 1 } },
      { returnDocument: "after" }
    ).select("+emailCodeAttempts");
    const left = Math.max(0, MAX_ATTEMPTS - ((updated && updated.emailCodeAttempts) || MAX_ATTEMPTS));
    return { outcome: left > 0 ? "wrong" : "too_many", attemptsLeft: left };
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: { emailVerified: true, emailVerifiedAt: new Date() },
      $unset: { emailCodeHash: "", emailCodeExpires: "", emailCodeAttempts: "" },
    }
  );
  return { outcome: "verified" };
};

// Express middleware: blocks money actions until the email is verified.
const requireVerifiedEmail = async (req, res, next) => {
  if (!verificationRequired()) return next();
  try {
    const user = await User.findById(req.userId).select("emailVerified");
    if (user && user.emailVerified) return next();
    return res.status(403).json({
      success: false,
      code: "email_unverified",
      message: "Please verify your email address before making a purchase.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not check your account." });
  }
};

module.exports = { verificationRequired, sendVerificationCode, verifyCode, requireVerifiedEmail, MAX_ATTEMPTS };
