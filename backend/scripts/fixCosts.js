// Corrects the recorded cost of past orders where the supplier's status
// query reported the face value instead of the discounted amount taken.
// For each delivered order whose cost came from the supplier, the cost is
// recomputed from the plan's cost (data) or the airtime discount, and the
// LOWER figure is kept. Shows the changes and asks before writing.
//   npm run fix:costs -- --db atlas
const { option, ask } = require("./lib/privateEnv");
const { connect } = require("./lib/db");

const run = async () => {
  const mongoose = await connect(option("db"));
  const Transaction = require("../src/models/Transaction");
  const Plan = require("../src/models/Plan");
  const config = require("../src/config/payments").getConfig();

  const txs = await Transaction.find({ status: "successful", costSource: "supplier" }).lean();
  const changes = [];
  for (const tx of txs) {
    let expected = null;
    let source = null;
    if (tx.type === "data" && tx.planId) {
      const plan = await Plan.findById(tx.planId).select("costPrice").lean();
      if (plan && Number.isFinite(plan.costPrice) && plan.costPrice > 0) {
        expected = Math.round(plan.costPrice * 100);
        source = "plan";
      }
    } else if (tx.type === "airtime") {
      const pct = (config.airtimeDiscountPercent || {})[tx.network];
      if (Number.isFinite(pct)) {
        expected = Math.round(tx.amount * 100 * (1 - pct / 100));
        source = "estimate";
      }
    }
    if (expected !== null && expected < tx.costKobo) changes.push({ tx, expected, source });
  }

  if (!changes.length) {
    console.log(`Checked ${txs.length} order(s). Nothing to correct.`);
  } else {
    console.log(`\n${changes.length} order(s) to correct in "${mongoose.connection.name}":`);
    for (const { tx, expected } of changes) {
      console.log(`  ${tx.transactionId}  ${tx.network} ${tx.plan}  cost ₦${(tx.costKobo / 100).toFixed(2)} -> ₦${(expected / 100).toFixed(2)}`);
    }
    if ((await ask("\nType YES to apply: ")).trim() === "YES") {
      for (const { tx, expected, source } of changes) {
        await Transaction.updateOne({ _id: tx._id }, { $set: { costKobo: expected, costSource: source } });
      }
      console.log("Done.");
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
