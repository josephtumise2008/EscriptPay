// Sends ONE real airtime or data order through ClubKonnect, to check the
// connection end to end. This SPENDS REAL MONEY from your ClubKonnect wallet.
//
//   npm run vtu:test-order -- --network MTN --amount 50 --phone 08012345678
//   npm run vtu:test-order -- --network MTN --plan 1000.0 --phone 08012345678
//     (--plan is the ClubKonnect plan ID; see npm run vtu:plans -- --network MTN)
//
// You must type YES to send it. The order is not recorded in EscriptPay.
const crypto = require("crypto");
const { loadClubkonnect, ask, option } = require("./lib/privateEnv");
const { validateNigerianPhone } = require("../src/utils/validators");

loadClubkonnect();
const ck = require("../src/services/vtu/clubkonnectVtuService");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  const network = option("network");
  const planId = (option("plan") || "").trim();
  const type = planId ? "data" : "airtime";
  const amount = Number(option("amount"));
  const phoneCheck = validateNigerianPhone(option("phone") || "");
  if (!["MTN", "Airtel", "Glo", "9mobile"].includes(network)) throw new Error("--network must be MTN, Airtel, Glo or 9mobile.");
  if (type === "airtime" && (!Number.isInteger(amount) || amount < 50 || amount > 1000)) throw new Error("--amount must be a whole number from 50 to 1000 for a test.");
  if (!phoneCheck.valid) throw new Error(phoneCheck.message);
  if (!process.stdin.isTTY) throw new Error("Run this in a terminal so you can confirm.");

  let plan = null;
  if (type === "data") {
    const plans = await ck.getDataPlans();
    plan = plans.find((p) => p.network === network && p.providerPlanId === planId);
    if (!plan) throw new Error(`No ${network} plan with ID ${planId}. List them with: npm run vtu:plans -- --network ${network}`);
    if (plan.cost > 1000) throw new Error(`That plan costs ₦${plan.cost}; tests are limited to ₦1,000.`);
  }

  const { balance } = await ck.getBalance();
  console.log(`ClubKonnect balance: ₦${balance.toLocaleString("en-NG")}`);
  console.log(
    type === "data"
      ? `About to send REAL data: ${network} ${plan.name} (costs you ₦${plan.cost}) to ${ck.toLocalMsisdn(phoneCheck.normalized)}.`
      : `About to send REAL airtime: ${network} ₦${amount} to ${ck.toLocalMsisdn(phoneCheck.normalized)}.`
  );
  if ((await ask("Type YES to send it: ")).trim() !== "YES") {
    console.log("Cancelled. Nothing was sent.");
    return;
  }

  const requestId = `ESCTEST-${Date.now()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  let result;
  try {
    result = await ck.purchase({ type, network, phone: phoneCheck.normalized, amount, plan, requestId });
  } catch (error) {
    console.log(`No clear answer from ClubKonnect (${error.code}). It MAY have been sent — checking by request ID…`);
    result = { outcome: "unknown" };
  }
  console.log(`First response: ${result.outcome}${result.statusCode ? ` (code ${result.statusCode} ${result.status})` : ""}`);

  for (let i = 0; i < 12 && !["delivered", "failed"].includes(result.outcome); i += 1) {
    await sleep(10000);
    result = await ck.queryStatus({ transaction: { providerReference: result.reference, transactionId: requestId } }).catch(() => result);
    console.log(`  status: ${result.outcome}${result.statusCode ? ` (code ${result.statusCode} ${result.status})` : ""}`);
  }
  console.log(`\nRequest ID: ${requestId}${result.reference ? `   ClubKonnect order: ${result.reference}` : ""}`);
  console.log(
    result.outcome === "delivered"
      ? "Delivered. The ClubKonnect connection works end to end."
      : result.outcome === "failed"
        ? "ClubKonnect reports the order failed (you should not have been charged — check your ClubKonnect history)."
        : "Not final yet. Check this order on clubkonnect.com before trying again."
  );
};

run().catch((error) => {
  console.error(`Stopped: ${error.message}`);
  process.exit(1);
});
