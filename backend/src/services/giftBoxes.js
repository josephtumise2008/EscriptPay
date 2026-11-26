// Daily gift box.
//
// Rules (owner's choice, Nov 2026 — all tunable with env, see .env.example):
// - Once a day (Lagos time) a signed-in user can open a gift box. It reveals
//   a cashback amount picked at random from GIFT_BOX_PRIZES
//   (default ₦5 45%, ₦10 35%, ₦20 15%, ₦50 5% — about ₦11 on average).
// - The cashback is paid into the wallet (spend-only, like referral rewards)
//   when one of the user's DATA orders of at least GIFT_BOX_MIN_PURCHASE_NAIRA
//   (default ₦500) is delivered the same day. An order delivered earlier that
//   day, before the box was opened, also counts.
// - Total cashback paid per day never passes GIFT_BOX_DAILY_BUDGET_NAIRA
//   (default ₦2,000). When the budget runs out the box says so.
// - GIFT_BOX_ENABLED=false switches the whole thing off.
//
// Safety
// - One box per user per day (unique index user+day+mode).
// - One wallet credit per box (unique ledger reference GIFT-<boxId>, plus the
//   box is claimed with a conditional update before any money moves).
// - Owner orders (bought from the supplier balance) never count.
// - A failure here never affects the order: callers catch and log.

const crypto = require("crypto");

const LAGOS_OFFSET_MS = 60 * 60 * 1000; // WAT = UTC+1, no daylight saving
const lagosDay = (date = new Date()) =>
  new Date(new Date(date).getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);

const nairaFromEnv = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
};

const DEFAULT_PRIZES = [
  { naira: 5, weight: 45 },
  { naira: 10, weight: 35 },
  { naira: 20, weight: 15 },
  { naira: 50, weight: 5 },
];

// "5:45,10:35,20:15,50:5" -> [{ naira: 5, weight: 45 }, ...]
const parsePrizes = (value) => {
  if (!value || !String(value).trim()) return DEFAULT_PRIZES;
  const prizes = String(value)
    .split(",")
    .map((part) => part.split(":").map((s) => Number(s.trim())))
    .filter(([naira, weight]) => Number.isInteger(naira) && naira > 0 && naira <= 1000 && Number.isFinite(weight) && weight > 0)
    .map(([naira, weight]) => ({ naira, weight }));
  return prizes.length ? prizes : DEFAULT_PRIZES;
};

const rules = () => ({
  enabled: String(process.env.GIFT_BOX_ENABLED || "true").trim().toLowerCase() !== "false",
  prizes: parsePrizes(process.env.GIFT_BOX_PRIZES),
  minPurchaseKobo: nairaFromEnv("GIFT_BOX_MIN_PURCHASE_NAIRA", 500) * 100,
  dailyBudgetKobo: nairaFromEnv("GIFT_BOX_DAILY_BUDGET_NAIRA", 2000) * 100,
});

// Weighted random pick. `random` is injectable for tests (0 <= r < 1).
const pickPrize = (prizes, random = () => crypto.randomInt(0, 1e9) / 1e9) => {
  const total = prizes.reduce((sum, p) => sum + p.weight, 0);
  let roll = random() * total;
  for (const p of prizes) {
    if (roll < p.weight) return p.naira * 100;
    roll -= p.weight;
  }
  return prizes[prizes.length - 1].naira * 100;
};

const orderKobo = (tx) => (Number.isInteger(tx.paymentAmountKobo) && tx.paymentAmountKobo > 0 ? tx.paymentAmountKobo : Math.round(Number(tx.amount || 0) * 100));

// A delivered order that unlocks today's cashback.
const qualifies = (tx, minPurchaseKobo) =>
  Boolean(tx) &&
  tx.type === "data" &&
  tx.status === "successful" &&
  tx.paymentProvider !== "owner" &&
  orderKobo(tx) >= minPurchaseKobo;

const createGiftBoxService = ({ User, WalletEntry, GiftBox, GiftBudget, Transaction, logEvent = () => {}, random } = {}) => {
  const publicBox = (box, r = rules()) => ({
    enabled: r.enabled,
    day: box ? box.day : lagosDay(),
    opened: Boolean(box),
    status: box ? box.status : "closed",
    prize: box ? box.prizeKobo / 100 : null,
    minPurchase: r.minPurchaseKobo / 100,
    maxPrize: Math.max(...r.prizes.map((p) => p.naira)),
    orderTransactionId: box ? box.orderTransactionId || null : null,
  });

  // Reserves `amountKobo` from the day's budget. False when it would pass it.
  const reserveBudget = async ({ day, mode, amountKobo, budgetKobo }) => {
    try {
      await GiftBudget.create({ day, mode, spentKobo: 0 });
    } catch (error) {
      if (!(error && error.code === 11000)) throw error; // already exists: fine
    }
    const updated = await GiftBudget.findOneAndUpdate(
      { day, mode, spentKobo: { $lte: budgetKobo - amountKobo } },
      { $inc: { spentKobo: amountKobo } },
      { returnDocument: "after" }
    );
    return Boolean(updated);
  };

  const releaseBudget = ({ day, mode, amountKobo }) =>
    GiftBudget.updateOne({ day, mode }, { $inc: { spentKobo: -amountKobo } }).catch(() => {});

  // Pays an opened box into the wallet, once. `tx` is the qualifying order.
  const credit = async (box, tx) => {
    const r = rules();
    const claimed = await GiftBox.findOneAndUpdate(
      { _id: box._id, status: "opened" },
      { $set: { status: "crediting", orderTransactionId: tx.transactionId } },
      { returnDocument: "after" }
    );
    if (!claimed) return { outcome: "already_claimed" };

    const reserved = await reserveBudget({ day: claimed.day, mode: claimed.mode, amountKobo: claimed.prizeKobo, budgetKobo: r.dailyBudgetKobo });
    if (!reserved) {
      await GiftBox.updateOne({ _id: claimed._id, status: "crediting" }, { $set: { status: "budget_out" } });
      logEvent("gift.budget_out", { day: claimed.day });
      return { outcome: "budget_out" };
    }

    let entry;
    try {
      entry = await WalletEntry.create({
        user: claimed.user,
        reference: `GIFT-${claimed._id}`,
        kind: "gift",
        direction: "credit",
        amountKobo: claimed.prizeKobo,
        status: "crediting",
        mode: claimed.mode,
        currency: "NGN",
        paymentProvider: "wallet",
        orderTransactionId: tx.transactionId,
        description: "Daily gift box cashback",
      });
    } catch (error) {
      if (error && error.code === 11000) {
        await GiftBox.updateOne({ _id: claimed._id }, { $set: { status: "credited" } });
        return { outcome: "already_credited" };
      }
      // Put the box back so a later order can try again.
      await GiftBox.updateOne({ _id: claimed._id, status: "crediting" }, { $set: { status: "opened" }, $unset: { orderTransactionId: 1 } });
      await releaseBudget({ day: claimed.day, mode: claimed.mode, amountKobo: claimed.prizeKobo });
      throw error;
    }

    const user = await User.findOneAndUpdate(
      { _id: claimed.user },
      { $inc: { [`walletBalances.${claimed.mode}`]: claimed.prizeKobo } },
      { returnDocument: "after", projection: { walletBalances: 1 } }
    );
    if (!user) {
      await WalletEntry.updateOne({ _id: entry._id }, { $set: { status: "failed", failureReason: "user_missing" } });
      await releaseBudget({ day: claimed.day, mode: claimed.mode, amountKobo: claimed.prizeKobo });
      return { outcome: "user_missing" };
    }
    const balance = (user.walletBalances && user.walletBalances[claimed.mode]) || 0;
    await WalletEntry.updateOne({ _id: entry._id, status: "crediting" }, { $set: { status: "successful", balanceAfterKobo: balance } });
    await GiftBox.updateOne({ _id: claimed._id }, { $set: { status: "credited", creditedAt: new Date() } });
    logEvent("gift.credited", { reference: entry.reference, transactionId: tx.transactionId });
    return { outcome: "credited", prizeKobo: claimed.prizeKobo };
  };

  // Today's box for the dashboard.
  const status = async (userId, { mode }) => {
    const r = rules();
    if (!r.enabled) return publicBox(null, r);
    const box = await GiftBox.findOne({ user: userId, day: lagosDay(), mode });
    return publicBox(box, r);
  };

  // Opens today's box (once). If a qualifying data order was already
  // delivered today, the cashback is paid straight away.
  const open = async (userId, { mode }) => {
    const r = rules();
    if (!r.enabled) return { outcome: "disabled", box: publicBox(null, r) };
    const day = lagosDay();
    let box;
    try {
      box = await GiftBox.create({ user: userId, day, mode, prizeKobo: pickPrize(r.prizes, random), status: "opened", openedAt: new Date() });
    } catch (error) {
      if (!(error && error.code === 11000)) throw error;
      box = await GiftBox.findOne({ user: userId, day, mode });
      return { outcome: "already_opened", box: publicBox(box, r) };
    }
    logEvent("gift.opened", { day });

    if (Transaction) {
      try {
        const start = new Date(`${day}T00:00:00.000+01:00`);
        const earlier = await Transaction.findOne({
          user: userId,
          mode,
          type: "data",
          status: "successful",
          paymentProvider: { $ne: "owner" },
          paymentAmountKobo: { $gte: r.minPurchaseKobo },
          createdAt: { $gte: start },
        });
        if (earlier && qualifies(earlier, r.minPurchaseKobo)) {
          await credit(box, earlier);
          box = await GiftBox.findOne({ _id: box._id });
        }
      } catch (error) {
        logEvent("gift.open_credit_failed", { message: error && error.message });
      }
    }
    return { outcome: "opened", box: publicBox(box, r) };
  };

  // Called when any order is delivered (services/lifecycle.js).
  const onOrderDelivered = async (tx) => {
    const r = rules();
    if (!r.enabled || !qualifies(tx, r.minPurchaseKobo)) return { outcome: "not_qualifying" };
    const box = await GiftBox.findOne({ user: tx.user, day: lagosDay(tx.createdAt), mode: tx.mode, status: "opened" });
    if (!box) return { outcome: "no_open_box" };
    return credit(box, tx);
  };

  return { status, open, onOrderDelivered, credit };
};

module.exports = { createGiftBoxService, rules, parsePrizes, pickPrize, lagosDay, qualifies };
