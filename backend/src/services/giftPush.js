// Daily push notifications, sent by the scheduler:
//   morning — everyone subscribed: buy your data today (+ today's gift box)
//   evening — everyone subscribed: invite friends and earn ₦{reward} each
//
// Each slot goes out at most once per day: the send is claimed first with a
// unique AlertState key (gift_push_<slot>_<mode>_<day>), so a scheduler retry
// or a double call can't spam anyone.

const { lagosDay, rules } = require("./giftBoxes");
const { rules: referralRules } = require("./referrals");

// Rotates daily so the notification doesn't read the same every day.
const MORNING = [
  { heading: "📶 Buy your data today", text: "Cheap MTN, Airtel, Glo and 9mobile data in seconds. Your daily gift box is waiting too: up to ₦{max} cashback." },
  { heading: "Running low on data? 📶", text: "Top up on EscriptPay now. Buy ₦{min}+ data today and collect your gift box cashback." },
  { heading: "Good morning! ☀️", text: "Start the day connected. Buy data on EscriptPay and open today's gift box." },
  { heading: "📶 Don't run out today", text: "Buy data for yourself or your people in one tap. Today's gift box: up to ₦{max} back." },
  { heading: "🎁 Data + cashback today", text: "Open your gift box, buy ₦{min}+ data, and the cashback lands in your wallet." },
];
// Used when the gift box is switched off (GIFT_BOX_ENABLED=false).
const MORNING_PLAIN = [
  { heading: "📶 Buy your data today", text: "Cheap MTN, Airtel, Glo and 9mobile data in seconds on EscriptPay." },
  { heading: "Running low on data? 📶", text: "Top up on EscriptPay now. It takes one tap from your wallet." },
  { heading: "Good morning! ☀️", text: "Start the day connected. Buy your data on EscriptPay." },
];
const EVENING = [
  { heading: "💰 Earn ₦{reward} per friend", text: "Invite your friends to EscriptPay. When they add ₦{minTopup}+ to their wallet, you get ₦{reward}." },
  { heading: "Share EscriptPay, get paid 💰", text: "Send your invite link to friends and family. ₦{reward} for every friend who tops up." },
  { heading: "Your friends need cheap data too 📶", text: "Invite them with your link and earn ₦{reward} each when they fund their wallet." },
];

const pick = (list, day) => {
  const n = Number(String(day).replace(/-/g, "")) || 0;
  return list[n % list.length];
};

const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, k) => (values[k] === undefined ? "" : values[k]));

const createGiftPush = ({ push, AlertState, appUrl = "", logEvent = () => {} }) => {
  const claimSlot = async (key) => {
    try {
      await AlertState.create({ key, lastSentAt: new Date() });
      return true;
    } catch (error) {
      if (error && error.code === 11000) return false;
      throw error;
    }
  };

  const run = async ({ slot, mode, now = new Date() }) => {
    if (!["morning", "evening"].includes(slot)) return { outcome: "bad_slot" };
    if (!push.enabled()) return { outcome: "push_not_configured" };

    const day = lagosDay(now);
    const key = `gift_push_${slot}_${mode}_${day}`;
    if (!(await claimSlot(key))) return { outcome: "already_sent", day };

    const gift = rules();
    const ref = referralRules();
    const values = {
      max: Math.max(...gift.prizes.map((p) => p.naira)),
      min: gift.minPurchaseKobo / 100,
      reward: ref.rewardKobo / 100,
      minTopup: ref.minTopupKobo / 100,
    };
    const base = (appUrl || "").replace(/\/+$/, "");
    const list = slot === "evening" ? EVENING : gift.enabled ? MORNING : MORNING_PLAIN;
    const t = pick(list, day);
    const url = slot === "evening" ? `${base}/refer` : gift.enabled ? `${base}/dashboard?gift=1` : `${base}/buy-data`;
    try {
      const result = await push.toEveryone({ heading: fill(t.heading, values), text: fill(t.text, values), url, topic: `daily-${slot}` });
      return { outcome: "sent", slot, day, ...result };
    } catch (error) {
      // Let the scheduler's next call try again.
      await AlertState.deleteOne({ key }).catch(() => {});
      logEvent("push.failed", { slot, status: error && error.status, message: error && error.message });
      throw error;
    }
  };

  return { run };
};

module.exports = { createGiftPush, MORNING, MORNING_PLAIN, EVENING, fill, pick };
