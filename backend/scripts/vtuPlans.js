// ClubKonnect data plans -> EscriptPay plans.
//
//   npm run vtu:plans                         list plans and YOUR cost (read-only)
//   npm run vtu:plans -- --network MTN        one network only
//   npm run vtu:plans -- --apply --markup 30  write to the database (asks first):
//        - new plans are added for sale at cost (rounded up) + ₦30
//        - plans already linked to ClubKonnect get their name/validity/cost
//          refreshed; their selling price is NOT changed (add --reprice to
//          reset it to cost + markup)
//   --only "1000,2000.00"   limit to these ClubKonnect plan codes
//   --deactivate-unmapped   hide old plans that have no ClubKonnect code
//                           (only for the networks being applied)
//
//   npm run vtu:plans -- --network MTN --pricing                 preview owner pricing (scripts/pricing.js)
//   npm run vtu:plans -- --network MTN --pricing --apply --db local --deactivate-unmapped
//   --db local  = the MONGO_URI in backend/.env (your computer)
//   --db atlas  = MONGO_URI from the environment / backend/.env.atlas / hidden prompt
//
// Never deletes anything. The database comes from MONGO_URI, backend/.env.atlas
// or a hidden prompt; it is never printed.
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { loadClubkonnect, readPrivate, ask, askHidden, flag, option } = require("./lib/privateEnv");
const pricing = require("./pricing");

loadClubkonnect();
const ck = require("../src/services/vtu/clubkonnectVtuService");

const NETWORKS = ["MTN", "Airtel", "Glo", "9mobile"];

// "1 GB - Weekly (SME)" -> "Weekly"; "1GB … - 1 day (Awoof Data)" -> "1 day";
// "2.5GB - Weekend Plan - [Sat & Sun] (Awoof Data)" -> "Weekend Plan · Sat & Sun"
// Customer-facing name: the supplier's name without the "Awoof" label.
const displayName = (name) => name.replace(/\s*\(Awo+f Data\)\s*$/i, "").trim();

const validityOf = (name) => {
  const i = name.indexOf(" - ");
  const tail = i >= 0 ? name.slice(i + 3) : "";
  const v = tail
    .replace(/\([^)]*\)/g, "")
    .replace(/[[\]]/g, "")
    .split(" - ")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
  return v || "See plan";
};

const run = async () => {
  const network = option("network");
  if (network && !NETWORKS.includes(network)) {
    console.error(`--network must be one of ${NETWORKS.join(", ")}.`);
    process.exit(1);
  }
  const only = (option("only") || "").split(",").map((s) => s.trim()).filter(Boolean);

  let plans = await ck.getDataPlans();
  if (network) plans = plans.filter((p) => p.network === network);
  if (only.length) plans = plans.filter((p) => only.includes(p.providerPlanId));

  const usePricing = flag("pricing");
  if (usePricing) {
    plans = plans
      .map((p) => ({ ...p, sellPrice: pricing.price(p) }))
      .filter((p) => p.sellPrice !== null);
  }

  for (const n of NETWORKS) {
    const list = plans.filter((p) => p.network === n);
    if (!list.length) continue;
    console.log(`\n${n} (${list.length} plans)`);
    for (const p of list) {
      const sale = usePricing
        ? `  sell ₦${String(p.sellPrice).padStart(6)}  profit ₦${(p.sellPrice - p.cost).toFixed(2).padStart(8)}`
        : "";
      console.log(`  ${p.providerPlanId.padEnd(10)} cost ₦${String(p.cost).padStart(9)}${sale}   ${p.name}`);
    }
  }
  console.log(`\n${plans.length} plan(s). "cost" is what ClubKonnect charges your account.`);

  if (!flag("apply")) {
    console.log("Read-only: nothing was changed.");
    return;
  }

  const markupRaw = option("markup");
  const markup = Number(markupRaw);
  if (!usePricing && (markupRaw === null || !Number.isInteger(markup) || markup < 0)) {
    console.error("--apply needs --pricing (scripts/pricing.js) or --markup <whole naira ≥ 0>.");
    process.exit(1);
  }
  if (!process.stdin.isTTY) {
    console.error("--apply must be run in a terminal so you can confirm. Nothing was changed.");
    process.exit(1);
  }

  const db = option("db");
  let uri = "";
  if (db === "local") {
    const envFile = path.join(__dirname, "..", ".env");
    const line = fs.existsSync(envFile)
      ? fs.readFileSync(envFile, "utf8").split(/\r?\n/).find((l) => l.trim().startsWith("MONGO_URI="))
      : null;
    uri = line ? line.trim().slice("MONGO_URI=".length).trim().replace(/^["']|["']$/g, "") : "";
    if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) {
      console.error("--db local expects backend/.env MONGO_URI to point at this computer (127.0.0.1/localhost). Nothing was changed.");
      process.exit(1);
    }
  } else if (db === "atlas") {
    uri = readPrivate("MONGO_URI");
    if (!uri) uri = (await askHidden("Paste the MongoDB Atlas connection string (it won't show): ")).trim();
  } else {
    console.error("--apply needs --db local or --db atlas, so you always know which database is changed.");
    process.exit(1);
  }
  if (!/^mongodb(\+srv)?:\/\//.test(uri) || /[<>]/.test(uri)) {
    console.error("That isn't a valid connection string. Nothing was changed.");
    process.exit(1);
  }

  const Plan = require("../src/models/Plan");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const dbName = mongoose.connection.name;

  const existing = await Plan.find({ provider: "clubkonnect" });
  const key = (p) => `${p.network}|${p.providerPlanId}`;
  const byKey = new Map(existing.map((p) => [key(p), p]));
  const toCreate = plans.filter((p) => !byKey.has(key(p)));
  const toUpdate = plans.filter((p) => byKey.has(key(p)));
  const networksApplied = [...new Set(plans.map((p) => p.network))];
  const unmappedFilter = {
    network: { $in: networksApplied },
    $or: [{ provider: { $exists: false } }, { provider: { $ne: "clubkonnect" } }],
  };
  const unmappedCount = await Plan.countDocuments({ ...unmappedFilter, active: { $ne: false } });

  const rule = usePricing ? "your pricing (scripts/pricing.js)" : `cost + ₦${markup}`;
  console.log(`\nDatabase "${dbName}" (${db === "local" ? "this computer" : "MongoDB Atlas"}):`);
  console.log(`  add ${toCreate.length} new plan(s) at ${rule}`);
  console.log(`  refresh ${toUpdate.length} linked plan(s)${usePricing || flag("reprice") ? ` and set their price to ${rule}` : " (selling prices unchanged)"}`);
  if (flag("deactivate-unmapped")) console.log(`  hide ${unmappedCount} old ${networksApplied.join("/")} plan(s) without a ClubKonnect code (not deleted)`);
  const answer = (await ask('Type YES to apply: ')).trim();
  if (answer !== "YES") {
    console.log("Cancelled. Nothing was changed.");
    await mongoose.disconnect();
    return;
  }

  const sellOf = (p) => (usePricing ? p.sellPrice : Math.ceil(p.cost) + markup);
  for (const p of toCreate) {
    await Plan.create({
      network: p.network,
      name: displayName(p.name),
      validity: validityOf(p.name),
      price: sellOf(p),
      costPrice: p.cost,
      provider: "clubkonnect",
      providerPlanId: p.providerPlanId,
      active: true,
    });
  }
  for (const p of toUpdate) {
    const set = { name: displayName(p.name), validity: validityOf(p.name), costPrice: p.cost };
    if (usePricing || flag("reprice")) set.price = sellOf(p);
    set.active = true;
    await Plan.updateOne({ _id: byKey.get(key(p))._id }, { $set: set });
  }
  if (flag("deactivate-unmapped")) {
    await Plan.updateMany(unmappedFilter, { $set: { active: false } });
  }
  const belowCost = await Plan.countDocuments({ provider: "clubkonnect", active: { $ne: false }, $expr: { $lt: ["$price", "$costPrice"] } });
  console.log(`Done. Added ${toCreate.length}, refreshed ${toUpdate.length}.`);
  if (belowCost) console.log(`Warning: ${belowCost} plan(s) are priced below cost; checkout refuses them until repriced.`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(`Failed: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
