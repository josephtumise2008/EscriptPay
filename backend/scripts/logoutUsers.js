// Signs out every account except the one you keep. Their next page load asks
// them to log in again. Nothing is deleted; wallets and orders are untouched.
//   npm run logout:users -- --keep you@example.com --db atlas
//   npm run logout:users -- --keep you@example.com --db local
const { option, ask } = require("./lib/privateEnv");
const { connect } = require("./lib/db");

const run = async () => {
  const keep = (option("keep") || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(keep)) throw new Error("Give the account to keep signed in: --keep you@example.com");
  const mongoose = await connect(option("db"));
  const User = require("../src/models/User");
  const kept = await User.findOne({ email: keep }).select("name email");
  if (!kept) throw new Error(`No account with email ${keep} in database "${mongoose.connection.name}".`);
  const others = await User.find({ email: { $ne: keep } }).select("email").lean();
  if (others.length === 0) {
    console.log("There are no other accounts. Nothing to do.");
  } else {
    console.log(`\nThese ${others.length} account(s) will be signed out:`);
    others.forEach((u) => console.log(`  - ${u.email}`));
    console.log(`Staying signed in: ${kept.email}\n`);
    if ((await ask(`Sign them out in "${mongoose.connection.name}"? Type YES: `)).trim() === "YES") {
      const result = await User.updateMany({ email: { $ne: keep } }, { $set: { sessionsValidAfter: new Date() } });
      console.log(`Done. ${result.modifiedCount} account(s) signed out.`);
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
