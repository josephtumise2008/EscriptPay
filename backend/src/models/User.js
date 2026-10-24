const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required."],
      trim: true,
      minlength: [3, "Name must be at least 3 characters."],
      maxlength: [80, "Name must be at most 80 characters."],
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Enter a valid email address."],
      index: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required."],
      trim: true,
    },
    state: {
      type: String,
      trim: true,
      maxlength: [40, "State must be at most 40 characters."],
      default: "",
    },
    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [8, "Password must be at least 8 characters."],
      select: false,
    },
    // Access role. "admin" unlocks the plan-management endpoints.
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true,
    },
    // Wallet balances in kobo, kept separate per payment mode so money added
    // with test payments can never pay for live orders. Only ever changed by
    // atomic $inc updates in services/wallet.js.
    walletBalances: {
      test: { type: Number, default: 0, min: 0 },
      live: { type: Number, default: 0, min: 0 },
    },
    // Email verification. The 6-digit code is stored only as a hash.
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: Date,
    emailCodeHash: { type: String, select: false },
    emailCodeExpires: { type: Date, select: false },
    emailCodeAttempts: { type: Number, default: 0, select: false },
    emailCodeSentAt: { type: Date, select: false },
    // Any login token issued before this moment is rejected (forced logout,
    // password change or reset).
    sessionsValidAfter: { type: Date, select: false },
    // Password-reset token (stored as a one-way hash, not the raw token).
    resetTokenHash: {
      type: String,
      select: false,
    },
    resetTokenExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailCodeHash;
  delete obj.emailCodeExpires;
  delete obj.emailCodeAttempts;
  delete obj.emailCodeSentAt;
  delete obj.sessionsValidAfter;
  return obj;
};

const User = mongoose.model("User", userSchema);

module.exports = User;