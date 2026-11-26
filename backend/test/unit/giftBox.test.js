const test = require("node:test");
const assert = require("node:assert/strict");
const { createGiftBoxService, parsePrizes, pickPrize, lagosDay, qualifies, rules } = require("../../src/services/giftBoxes");
const { createPushService } = require("../../src/services/push");
const { createGiftPush, fill } = require("../../src/services/giftPush");
const { createFakeModel } = require("../helpers/fakeModel");

const ENV_KEYS = ["GIFT_BOX_ENABLED", "GIFT_BOX_PRIZES", "GIFT_BOX_MIN_PURCHASE_NAIRA", "GIFT_BOX_DAILY_BUDGET_NAIRA"];
const withEnv = async (vars, fn) => {
  const before = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  try {
    return await fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (before[k] === undefined) delete process.env[k];
      else process.env[k] = before[k];
    }
  }
};

const setup = ({ balance = 0, transactions = [], random = () => 0 } = {}) => {
  const User = createFakeModel({ docs: [{ _id: "u1", walletBalances: { test: balance, live: 0 } }, { _id: "u2", walletBalances: { test: 0, live: 0 } }] });
  const WalletEntry = createFakeModel({ unique: ["reference"] });
  const GiftBox = createFakeModel({ unique: [] });
  // The fake model has single-field unique keys only; emulate user+day+mode.
  const realCreate = GiftBox.create;
  GiftBox.create = async (data) => {
    if (GiftBox.docs.some((d) => String(d.user) === String(data.user) && d.day === data.day && d.mode === data.mode)) {
      const error = new Error("E11000 duplicate key");
      error.code = 11000;
      throw error;
    }
    return realCreate(data);
  };
  const GiftBudget = createFakeModel({ unique: [] });
  const realBudgetCreate = GiftBudget.create;
  GiftBudget.create = async (data) => {
    if (GiftBudget.docs.some((d) => d.day === data.day && d.mode === data.mode)) {
      const error = new Error("E11000 duplicate key");
      error.code = 11000;
      throw error;
    }
    return realBudgetCreate(data);
  };
  const Transaction = createFakeModel({ docs: transactions });
  const gifts = createGiftBoxService({ User, WalletEntry, GiftBox, GiftBudget, Transaction, random });
  return { gifts, User, WalletEntry, GiftBox, GiftBudget };
};

const dataOrder = (over = {}) => ({
  _id: `tx${Math.random()}`,
  transactionId: "ESCP-1",
  user: "u1",
  type: "data",
  status: "successful",
  paymentProvider: "wallet",
  paymentAmountKobo: 60000,
  amount: 600,
  mode: "test",
  createdAt: new Date(),
  ...over,
});

test("Lagos day rolls over at midnight WAT, not UTC", () => {
  assert.equal(lagosDay(new Date("2026-11-26T22:59:00Z")), "2026-11-26");
  assert.equal(lagosDay(new Date("2026-11-26T23:00:00Z")), "2026-11-27");
});

test("prizes: parsed from env, bad values fall back to the defaults", () => {
  assert.deepEqual(parsePrizes("5:50, 20:50"), [{ naira: 5, weight: 50 }, { naira: 20, weight: 50 }]);
  assert.equal(parsePrizes("abc").length, 4);
  assert.equal(parsePrizes("").length, 4);
  assert.equal(parsePrizes("0:10,-5:2,5000:1").length, 4);
});

test("weighted pick covers every prize and returns kobo", () => {
  const prizes = [{ naira: 5, weight: 1 }, { naira: 10, weight: 1 }];
  assert.equal(pickPrize(prizes, () => 0), 500);
  assert.equal(pickPrize(prizes, () => 0.49), 500);
  assert.equal(pickPrize(prizes, () => 0.5), 1000);
  assert.equal(pickPrize(prizes, () => 0.999), 1000);
  for (let i = 0; i < 200; i += 1) assert.ok([500, 1000].includes(pickPrize(prizes)));
});

test("only delivered data orders over the minimum, never owner orders, qualify", () => {
  assert.equal(qualifies(dataOrder(), 50000), true);
  assert.equal(qualifies(dataOrder({ paymentAmountKobo: 40000 }), 50000), false);
  assert.equal(qualifies(dataOrder({ type: "airtime" }), 50000), false);
  assert.equal(qualifies(dataOrder({ status: "pending" }), 50000), false);
  assert.equal(qualifies(dataOrder({ paymentProvider: "owner" }), 50000), false);
  assert.equal(qualifies(dataOrder({ paymentAmountKobo: undefined, amount: 500 }), 50000), true);
});

test("a box opens once a day and shows its prize", () =>
  withEnv({}, async () => {
    const { gifts } = setup();
    const before = await gifts.status("u1", { mode: "test" });
    assert.equal(before.opened, false);
    assert.equal(before.minPurchase, 500);
    const first = await gifts.open("u1", { mode: "test" });
    assert.equal(first.outcome, "opened");
    assert.equal(first.box.prize, 5);
    assert.equal(first.box.status, "opened");
    const again = await gifts.open("u1", { mode: "test" });
    assert.equal(again.outcome, "already_opened");
    assert.equal(again.box.prize, 5);
  }));

test("a qualifying data order pays the cashback into the wallet exactly once", () =>
  withEnv({}, async () => {
    const { gifts, User, WalletEntry } = setup({ balance: 1000 });
    await gifts.open("u1", { mode: "test" });
    const tx = dataOrder();
    const results = await Promise.all([gifts.onOrderDelivered(tx), gifts.onOrderDelivered(tx), gifts.onOrderDelivered(dataOrder({ transactionId: "ESCP-2" }))]);
    assert.equal(results.filter((r) => r.outcome === "credited").length, 1);
    assert.equal(User.docs[0].walletBalances.test, 1500);
    assert.equal(WalletEntry.docs.length, 1);
    assert.equal(WalletEntry.docs[0].kind, "gift");
    assert.equal(WalletEntry.docs[0].status, "successful");
    assert.equal(WalletEntry.docs[0].balanceAfterKobo, 1500);
    const status = await gifts.status("u1", { mode: "test" });
    assert.equal(status.status, "credited");
  }));

test("small orders, other users and unopened boxes get nothing", () =>
  withEnv({}, async () => {
    const { gifts, User } = setup();
    assert.equal((await gifts.onOrderDelivered(dataOrder())).outcome, "no_open_box");
    await gifts.open("u1", { mode: "test" });
    assert.equal((await gifts.onOrderDelivered(dataOrder({ paymentAmountKobo: 20000 }))).outcome, "not_qualifying");
    assert.equal((await gifts.onOrderDelivered(dataOrder({ user: "u2" }))).outcome, "no_open_box");
    assert.equal((await gifts.onOrderDelivered(dataOrder({ mode: "live" }))).outcome, "no_open_box");
    assert.equal(User.docs[0].walletBalances.test, 0);
  }));

test("data bought earlier today counts when the box is opened later", () =>
  withEnv({}, async () => {
    const { gifts, User } = setup({ transactions: [dataOrder()] });
    const opened = await gifts.open("u1", { mode: "test" });
    assert.equal(opened.box.status, "credited");
    assert.equal(User.docs[0].walletBalances.test, 500);
  }));

test("the daily budget is never passed", () =>
  withEnv({ GIFT_BOX_DAILY_BUDGET_NAIRA: "8", GIFT_BOX_PRIZES: "5:1" }, async () => {
    const { gifts, User, GiftBudget } = setup();
    await gifts.open("u1", { mode: "test" });
    await gifts.open("u2", { mode: "test" });
    const a = await gifts.onOrderDelivered(dataOrder());
    const b = await gifts.onOrderDelivered(dataOrder({ user: "u2", transactionId: "ESCP-9" }));
    assert.equal(a.outcome, "credited");
    assert.equal(b.outcome, "budget_out");
    assert.equal(User.docs[0].walletBalances.test + User.docs[1].walletBalances.test, 500);
    assert.equal(GiftBudget.docs[0].spentKobo, 500);
    assert.equal((await gifts.status("u2", { mode: "test" })).status, "budget_out");
  }));

test("GIFT_BOX_ENABLED=false switches everything off", () =>
  withEnv({ GIFT_BOX_ENABLED: "false" }, async () => {
    const { gifts } = setup();
    assert.equal(rules().enabled, false);
    assert.equal((await gifts.status("u1", { mode: "test" })).enabled, false);
    assert.equal((await gifts.open("u1", { mode: "test" })).outcome, "disabled");
    assert.equal((await gifts.onOrderDelivered(dataOrder())).outcome, "not_qualifying");
  }));

// ---- push ----

const fakeFetch = (status = 200, body = { id: "n1" }) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return { ok: status < 300, status, json: async () => body };
  };
  return { calls, fetchImpl };
};

test("push is skipped quietly until OneSignal keys are set", async () => {
  const { calls, fetchImpl } = fakeFetch();
  const push = createPushService({ fetchImpl, env: {} });
  assert.equal(push.enabled(), false);
  assert.deepEqual(await push.toEveryone({ heading: "h", text: "t" }), { skipped: "not_configured" });
  assert.equal(calls.length, 0);
});

test("push sends to the subscriber segment, or to users by External ID in batches", async () => {
  const { calls, fetchImpl } = fakeFetch();
  const push = createPushService({ fetchImpl, env: { ONESIGNAL_APP_ID: "app-1", ONESIGNAL_REST_API_KEY: "os_v2_app_secret" } });
  await push.toEveryone({ heading: "Hi", text: "There", url: "https://x/dashboard", topic: "gift-box" });
  assert.equal(calls[0].url, "https://api.onesignal.com/notifications");
  assert.equal(calls[0].init.headers.Authorization, "Key os_v2_app_secret");
  assert.equal(calls[0].body.app_id, "app-1");
  assert.deepEqual(calls[0].body.included_segments, ["Total Subscriptions"]);
  assert.deepEqual(calls[0].body.headings, { en: "Hi" });
  assert.equal(calls[0].body.web_push_topic, "gift-box");

  const ids = Array.from({ length: 2500 }, (_, i) => `user${i}`);
  const result = await push.toUsers([...ids, "user1"], { heading: "a", text: "b" });
  assert.equal(result.users, 2500);
  assert.equal(result.batches, 2);
  assert.equal(calls[1].body.include_aliases.external_id.length, 2000);
  assert.equal(calls[2].body.include_aliases.external_id.length, 500);
});

test("a OneSignal error is raised (so the cron can retry), legacy keys use Basic", async () => {
  const { fetchImpl, calls } = fakeFetch(400, { errors: ["bad"] });
  const push = createPushService({ fetchImpl, env: { ONESIGNAL_APP_ID: "a", ONESIGNAL_REST_API_KEY: "legacy" } });
  await assert.rejects(push.toEveryone({ heading: "h", text: "t" }), /400/);
  assert.equal(calls[0].init.headers.Authorization, "Basic legacy");
});

test("daily pushes: morning = buy data, evening = invite friends; once a day; a failure frees the slot", () =>
  withEnv({}, async () => {
    const AlertState = createFakeModel({ unique: ["key"] });
    AlertState.deleteOne = async (filter) => {
      const i = AlertState.docs.findIndex((d) => d.key === filter.key);
      if (i >= 0) AlertState.docs.splice(i, 1);
    };
    const sent = [];
    let fail = false;
    const push = {
      enabled: () => true,
      toEveryone: async (m) => {
        if (fail) throw Object.assign(new Error("down"), { status: 500 });
        sent.push(m);
        return { sent: true };
      },
    };
    const runner = createGiftPush({ push, AlertState, appUrl: "https://escriptpay.com/" });
    const now = new Date("2026-11-26T07:00:00Z");

    fail = true;
    await assert.rejects(runner.run({ slot: "morning", mode: "live", now }));
    fail = false;
    assert.equal((await runner.run({ slot: "morning", mode: "live", now })).outcome, "sent");
    assert.equal((await runner.run({ slot: "morning", mode: "live", now })).outcome, "already_sent");
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, "https://escriptpay.com/dashboard?gift=1");
    assert.ok(/data/i.test(sent[0].heading + sent[0].text));
    assert.ok(!/\{\w+\}/.test(sent[0].text));

    assert.equal((await runner.run({ slot: "evening", mode: "live", now })).outcome, "sent");
    assert.equal(sent[1].url, "https://escriptpay.com/refer");
    assert.ok(/₦100/.test(sent[1].heading + sent[1].text));
    assert.ok(!/\{\w+\}/.test(sent[1].heading + sent[1].text));
    assert.equal((await runner.run({ slot: "noon", mode: "live", now })).outcome, "bad_slot");
  }));

test("with the gift box off, the morning push is a plain buy-data reminder", () =>
  withEnv({ GIFT_BOX_ENABLED: "false" }, async () => {
    const sent = [];
    const AlertState = createFakeModel({ unique: ["key"] });
    const runner = createGiftPush({ push: { enabled: () => true, toEveryone: async (m) => sent.push(m) }, AlertState, appUrl: "https://x" });
    await runner.run({ slot: "morning", mode: "live", now: new Date("2026-11-27T07:00:00Z") });
    assert.ok(!/gift/i.test(sent[0].heading + sent[0].text));
    assert.equal(sent[0].url, "https://x/buy-data");
  }));

test("referral alerts: inviter is told when a friend joins and when the ₦ reward lands", async () => {
  const { createReferralService } = require("../../src/services/referrals");
  const pushes = [];
  const User = createFakeModel({ docs: [
    { _id: "inviter", walletBalances: { test: 0, live: 0 } },
    { _id: "friend", name: "Tunde Okafor", referredBy: "inviter", walletBalances: { test: 0, live: 0 } },
  ] });
  User.findById = ((orig) => (id) => {
    const p = orig(id);
    p.lean = () => p;
    return p;
  })(User.findById.bind(User));
  const realFOU = User.findOneAndUpdate.bind(User);
  User.findOneAndUpdate = (...args) => {
    const p = realFOU(...args);
    p.lean = () => p;
    return p;
  };
  const WalletEntry = createFakeModel({ unique: ["reference"] });
  const refs = createReferralService({ User, WalletEntry, notify: async (ids, m) => pushes.push({ ids, m }) });

  refs.notifySignup({ inviterId: "inviter", friendName: "Tunde Okafor" });
  await refs.rewardForTopup({ userId: "friend", amountKobo: 50000, mode: "test" });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(pushes.length, 2);
  assert.deepEqual(pushes[0].ids, ["inviter"]);
  assert.match(pushes[0].m.text, /Tunde O\. signed up/);
  assert.match(pushes[1].m.heading, /₦100 added/);
  assert.equal(pushes[1].m.url, "/refer");
});

test("message templates fill in amounts", () => {
  assert.equal(fill("Up to ₦{max}, buy ₦{min}+", { max: 50, min: 500 }), "Up to ₦50, buy ₦500+");
});
