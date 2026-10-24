// Gives an existing account access to the admin page.
//   npm run make:admin -- --email you@example.com --db atlas
//   npm run make:admin -- --email you@example.com --db local
// Changes only that user's role. Asks you to confirm first.
const { option, ask } = require("./lib/privateEnv");
const { connect } = require("./lib/db");

const run = async () => {
  const email = (option("email") || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Give the account email: --email you@example.com");
  const mongoose = await connect(option("db"));
  const User = require("../src/models/User");
  const user = await User.findOne({ email }).select("name email role");
  if (!user) throw new Error(`No account with email ${email} in database "${mongoose.connection.name}".`);
  if (user.role === "admin") {
    console.log(`${user.name} <${user.email}> is already an admin.`);
  } else if ((await ask(`Make ${user.name} <${user.email}> an admin in "${mongoose.connection.name}"? Type YES: `)).trim() === "YES") {
    await User.updateOne({ _id: user._id }, { $set: { role: "admin" } });
    console.log("Done. Log out and back in, then open /admin.");
  } else {
    console.log("Cancelled. Nothing was changed.");
  }
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(`Stopped: ${error.message}`);
  await require("mongoose").disconnect().catch(() => {});
  process.exit(1);
});
