// SAFE plan import for a new (e.g. MongoDB Atlas) database.
//
//   MONGO_URI="<your Atlas connection string>" node scripts/importPlans.js
//
// Unlike seedPlans.js (local development only — it DELETES all plans first),
// this script never deletes or overwrites anything: it refuses to run if the
// target database already contains any plans. The connection string is read
// from the environment and is never printed.

const mongoose = require("mongoose");
const Plan = require("../src/models/Plan");
const { ALL_PLANS } = require("./planCatalog");

const run = async () => {
  const uri = (process.env.MONGO_URI || "").trim();
  if (!uri) {
    console.error('MONGO_URI is not set. Run: MONGO_URI="<connection string>" npm run import:plans');
    process.exit(1);
  }

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
