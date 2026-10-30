// Look at one order, ask ClubKonnect about it, and (if it never went through)
// put the money back in the customer's wallet.
//   npm run order:check -- --id ESCP-20261030-29D41D --db atlas
// Read-only unless you type YES at the end.
const { option, ask, loadClubkonnect } = require("./lib/privateEnv");
const { connect } = require("./lib/db");

loadClubkonnect();
const ck = require("../src/services/vtu/clubkonnectVtuService");

const run = async () => {
  const id = (option("id") || "").trim().toUpperCase();
  if (!id) throw new Error("Give the order ID: --id ESCP-...");
  const mongoose = await connect(option("db"));
  const Transaction = require("../src/models/Transaction");
  const User = require("../src/models/User");
  const WalletEntry = require("../src/models/WalletEntry");

  const tx = await Transaction.findOne({ transactionId: id });
  if (!tx) throw new Error(`No order ${id} in "${mongoose.connection.name}".`);
  const user = await User.findById(tx.user).select("name email walletBalances").lean();

  console.log(`\nOrder ${tx.transactionId}  (${tx.mode})`);
  console.log(`  customer:        ${user ? `${user.name} <${user.email}>` : tx.user}`);
  console.log(`  ${tx.type} ${tx.network} · ${tx.plan} · ${tx.phone} · ₦${tx.amount} · paid with ${tx.paymentProvider}`);
  console.log(`  status:          ${tx.status}   payment: ${tx.paymentStatus}   delivery: ${tx.providerStatus}`);
  console.log(`  supplier code:   ${tx.providerStatusCode || "-"}   supplier order: ${tx.providerReference || "-"}`);
  console.log(`  failure reason:  ${tx.failureReason || "-"}   needs review: ${tx.needsReview ? "yes" : "no"}`);
  console.log(`  created ${tx.createdAt.toISOString()}  started ${tx.fulfillmentStartedAt ? tx.fulfillmentStartedAt.toISOString() : "-"}  attempts ${tx.fulfillmentAttempts || 0}`);
  if (user) console.log(`  customer wallet: ₦${((user.walletBalances || {})[tx.mode] || 0) / 100}`);
  const refund = await WalletEntry.findOne({ reference: `RF-${tx.transactionId}` }).lean();
  if (refund) console.log(`  refund already made: ₦${refund.amountKobo / 100} (${refund.status})`);

  let q = null;
  try {
    q = await ck.queryStatus({ transaction: { providerReference: tx.providerReference, transactionId: tx.transactionId } });
    console.log(`\nClubKonnect says: ${q.outcome}  (${[q.statusCode, q.status, q.remark].filter(Boolean).join(" · ") || "no details"})`);
  } catch (error) {
    console.log(`\nClubKonnect query failed: ${error.message}`);
  }

  if (tx.status === "successful" || q?.outcome === "delivered") {
    console.log("\nThis order was delivered. Nothing to refund.");
  } else if (refund) {
    console.log("\nAlready refunded. Nothing to do.");
  } else if (tx.paymentProvider !== "wallet") {
    console.log("\nPaid by card: refund it from your Paystack dashboard, then mark it resolved on the Business page.");
  } else if (q && ["accepted"].includes(q.outcome)) {
    console.log("\nClubKonnect still has this order in progress. Don't refund yet; check again later.");
  } else {
    console.log("\nClubKonnect has no delivered record of this order.");
    if ((await ask(`Mark it failed and put ₦${tx.amount} back in the customer's wallet? Type YES: `)).trim() === "YES") {
      await Transaction.updateOne(
        { _id: tx._id, status: { $ne: "successful" } },
        { $set: { providerStatus: "failed", status: "failed", failureReason: "delivery_failed", needsReview: false } }
      );
      // Credit the wallet for the order's own mode (live/test), with a unique
      // refund reference so it can never be applied twice.
      const entry = await WalletEntry.create({
        user: tx.user,
        reference: `RF-${tx.transactionId}`,
        kind: "refund",
        direction: "credit",
        amountKobo: tx.paymentAmountKobo,
        status: "crediting",
        mode: tx.mode,
        currency: tx.currency || "NGN",
        paymentProvider: "wallet",
        orderTransactionId: tx.transactionId,
        description: "Refund for failed order",
      });
      const field = `walletBalances.${tx.mode}`;
      const after = await User.findOneAndUpdate({ _id: tx.user }, { $inc: { [field]: entry.amountKobo } }, { returnDocument: "after" }).lean();
      const balanceKobo = (after.walletBalances || {})[tx.mode] || 0;
      await WalletEntry.updateOne({ _id: entry._id }, { $set: { status: "successful", balanceAfterKobo: balanceKobo } });
      await Transaction.updateOne({ _id: tx._id }, { $set: { failureReason: "delivery_failed_refunded" } });
      console.log(`Done. ₦${entry.amountKobo / 100} refunded. Customer wallet is now ₦${balanceKobo / 100}.`);
    } else {
      console.log("Cancelled. Nothing was changed.");
    }
  }
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(`Stopped: ${error.message}`);
  await require("mongoose").disconnect().catch(() => {});
  process.exit(1);
});
