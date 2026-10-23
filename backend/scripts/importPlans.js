// SAFE plan import for a new (e.g. MongoDB Atlas) database.
//
//   npm run import:plans        (asks for the connection string, hidden)
//   MONGO_URI="<connection string>" npm run import:plans
//
// Unlike seedPlans.js (local development only — it DELETES all plans first),
// this script never deletes or overwrites anything: it refuses to run if the
// target database already contains any plans. The connection string is read
// from the environment and is never printed.

const mongoose = require("mongoose");
const Plan = require("../src/models/Plan");
const { ALL_PLANS } = require("./planCatalog");

// Asks for the connection string without echoing it to the screen.
const askHidden = (question) =>
  new Promise((resolve) => {
    const readline = require("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(question);
    rl._writeToOutput = () => {}; // hide what is typed/pasted
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });

const run = async () => {
  let uri = (process.env.MONGO_URI || "").trim();
  if (!uri && process.stdin.isTTY) {
    uri = (await askHidden("Paste your MongoDB Atlas connection string (it won't show), then press Enter: ")).trim();
  }
  if (!uri) {
    console.error("No connection string was given. Nothing was changed.");
    process.exit(1);
  }
  if (!/^mongodb(\+srv)?:\/\//.test(uri) || /[<>]/.test(uri)) {
    console.error("That doesn't look like a finished connection string (it should start with mongodb+srv:// and contain no < or >). Nothing was changed.");
    process.exit(1);
  }
  console.log("Connecting to MongoDB Atlas…");

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const dbName = mongoose.connection.name;
  const existing = await Plan.countDocuments();

  if (existing > 0) {
    console.error(`Database "${dbName}" already has ${existing} plan(s). Nothing was changed.`);
    console.error("Manage existing plans through the admin API instead of re-importing.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const created = await Plan.insertMany(ALL_PLANS);
  console.log(`Imported ${created.length} plans into database "${dbName}".`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Import failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
