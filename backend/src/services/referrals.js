// Referral rewards.
//
// Rules (agreed with the owner):
// - Only the person who invites is rewarded: REFERRAL_REWARD_NAIRA (default ₦100).
// - It is paid once per invited friend, when that friend's wallet top-up of at
//   least REFERRAL_MIN_TOPUP_NAIRA (default ₦500) is credited.
// - It goes into the inviter's wallet and can only be spent on EscriptPay.
//
// Safety
// - One reward per invited user, guaranteed by the unique ledger reference
//   REF-<inviteeId>, so retried webhooks or double credits can't pay twice.
// - A reward never blocks or undoes the friend's top-up: failures are logged.
// - Signing up with your own phone number as the inviter's doesn't count.

const crypto = require("crypto");

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
const CODE_LENGTH = 6;
const CODE_PATTERN = /^[A-Z0-9]{4,12}$/;

const nairaFromEnv = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
};

const rules = () => ({
  rewardKobo: nairaFromEnv("REFERRAL_REWARD_NAIRA", 100) * 100,
  minTopupKobo: nairaFromEnv("REFERRAL_MIN_TOPUP_NAIRA", 500) * 100,
});

const randomCode = () => {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
};

const normalizeCode = (code) => {
  const c = String(code || "").trim().toUpperCase();
  return CODE_PATTERN.test(c) ? c : null;
};

// "Tunde Okafor" -> "Tunde O."
const shortName = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A friend";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
};

// notify(userIds, { heading, text, url }) sends a push; best effort.
const createReferralService = ({ User, WalletEntry, logEvent = () => {}, notify = null }) => {
  const alert = (userId, message) => {
    if (!notify || !userId) return;
    Promise.resolve()
      .then(() => notify([String(userId)], message))
      .catch((error) => logEvent("referral.push_failed", { message: error && error.message }));
  };

  // Tells the inviter a friend joined with their link.
  const notifySignup = ({ inviterId, friendName }) => {
    const { rewardKobo, minTopupKobo } = rules();
    alert(inviterId, {
      heading: "🎉 Your friend just joined EscriptPay",
      text: `${shortName(friendName)} signed up with your link. You get ₦${rewardKobo / 100} when they add ₦${minTopupKobo / 100}+ to their wallet.`,
      url: "/refer",
    });
  };

  // Gives the user a code if they don't have one yet. Returns the code.
  const ensureCode = async (userId) => {
    const current = await User.findById(userId, { referralCode: 1 }).lean();
    if (!current) return null;
    if (current.referralCode) return current.referralCode;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const updated = await User.findOneAndUpdate(
          { _id: userId, referralCode: { $exists: false } },
          { $set: { referralCode: randomCode() } },
          { returnDocument: "after", projection: { referralCode: 1 } }
        ).lean();
        if (updated) return updated.referralCode;
        const again = await User.findById(userId, { referralCode: 1 }).lean();
        if (again && again.referralCode) return again.referralCode;
      } catch (error) {
        if (!(error && error.code === 11000)) throw error; // code taken: try another
      }
    }
    throw new Error("Could not create a referral code.");
  };

  // The inviter for a code typed at signup, or null.
  const findInviter = async (code, { phone } = {}) => {
    const clean = normalizeCode(code);
    if (!clean) return null;
    const inviter = await User.findOne({ referralCode: clean }, { _id: 1, phone: 1 }).lean();
    if (!inviter) return null;
    if (phone && inviter.phone && inviter.phone === phone) return null;
    return inviter;
  };

  // Called after a wallet top-up is credited. Pays the inviter once.
  const rewardForTopup = async ({ userId, amountKobo, mode, currency = "NGN" }) => {
    const { rewardKobo, minTopupKobo } = rules();
    if (!userId || !(amountKobo >= minTopupKobo)) return { outcome: "below_minimum" };

    const invitee = await User.findById(userId, { referredBy: 1, name: 1 }).lean();
    if (!invitee || !invitee.referredBy) return { outcome: "not_referred" };
    if (String(invitee.referredBy) === String(userId)) return { outcome: "not_referred" };

    let entry;
    try {
      entry = await WalletEntry.create({
        user: invitee.referredBy,
        reference: `REF-${userId}`,
        kind: "referral",
        direction: "credit",
        amountKobo: rewardKobo,
        status: "crediting",
        mode,
        currency,
        paymentProvider: "wallet",
        referredUser: userId,
        description: `Referral reward · ${shortName(invitee.name)}`.slice(0, 120),
      });
    } catch (error) {
      if (error && error.code === 11000) return { outcome: "already_rewarded" };
      throw error;
    }

    const inviter = await User.findOneAndUpdate(
      { _id: invitee.referredBy },
      { $inc: { [`walletBalances.${mode}`]: rewardKobo } },
      { returnDocument: "after", projection: { walletBalances: 1 } }
    ).lean();
    if (!inviter) {
      await WalletEntry.updateOne({ _id: entry._id }, { $set: { status: "failed", failureReason: "user_missing" } });
      logEvent("referral.inviter_missing", { reference: entry.reference });
      return { outcome: "inviter_missing" };
    }
    const balance = (inviter.walletBalances && inviter.walletBalances[mode]) || 0;
    await WalletEntry.updateOne(
      { _id: entry._id, status: "crediting" },
      { $set: { status: "successful", balanceAfterKobo: balance } }
    );
    logEvent("referral.rewarded", { reference: entry.reference });
    alert(invitee.referredBy, {
      heading: `💰 ₦${rewardKobo / 100} added to your wallet`,
      text: `${shortName(invitee.name)} topped up, so your referral reward is in. Invite more friends to earn more!`,
      url: "/refer",
    });
    return { outcome: "rewarded", rewardKobo };
  };

  // What the "Invite & earn" page shows.
  const summary = async (userId, { mode }) => {
    const code = await ensureCode(userId);
    const [friends, rewards] = await Promise.all([
      User.find({ referredBy: userId }, { name: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(50).lean(),
      WalletEntry.find({ user: userId, kind: "referral", mode, status: "successful" }, { referredUser: 1, amountKobo: 1, createdAt: 1 }).lean(),
    ]);
    const invited = await User.countDocuments({ referredBy: userId });
    const paid = new Map(rewards.map((r) => [String(r.referredUser), r]));
    const earnedKobo = rewards.reduce((sum, r) => sum + r.amountKobo, 0);
    const { rewardKobo, minTopupKobo } = rules();
    return {
      code,
      reward: rewardKobo / 100,
      minTopup: minTopupKobo / 100,
      invited,
      rewarded: rewards.length,
      earned: earnedKobo / 100,
      friends: friends.map((f) => {
        const r = paid.get(String(f._id));
        return {
          name: shortName(f.name),
          joinedAt: f.createdAt,
          status: r ? "rewarded" : "waiting",
          rewardedAt: r ? r.createdAt : null,
        };
      }),
    };
  };

  return { ensureCode, findInviter, rewardForTopup, summary, notifySignup };
};

module.exports = { createReferralService, normalizeCode, shortName, randomCode, rules };
