// Sends ONE real airtime order through ClubKonnect, to check the connection
// end to end. This SPENDS REAL MONEY from your ClubKonnect wallet.
//
//   npm run vtu:test-order -- --network MTN --amount 50 --phone 08012345678
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
  const amount = Number(option("amount"));
  const phoneCheck = validateNigerianPhone(option("phone") || "");
  if (!["MTN", "Airtel", "Glo", "9mobile"].includes(network)) throw new Error("--network must be MTN, Airtel, Glo or 9mobile.");
  if (!Number.isInteger(amount) || amount < 50 || amount > 1000) throw new Error("--amount must be a whole number from 50 to 1000 for a test.");
  if (!phoneCheck.valid) throw new Error(phoneCheck.message);
  if (!process.stdin.isTTY) throw new Error("Run this in a terminal so you can confirm.");

  const { balance } = await ck.getBalance();
  console.log(`ClubKonnect balance: ₦${balance.toLocaleString("en-NG")}`);
  console.log(`About to send REAL airtime: ${network} ₦${amount} to ${ck.toLocalMsisdn(phoneCheck.normalized)}.`);
  if ((await ask("Type YES to send it: ")).trim() !== "YES") {
    console.log("Cancelled. Nothing was sent.");
    return;
  }

  const requestId = `ESCTEST-${Date.now()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  let result;
  try {
    result = await ck.purchase({ type: "airtime", network, phone: phoneCheck.normalized, amount, requestId });
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
