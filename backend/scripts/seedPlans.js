const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

require("dotenv").config();

const mongoose = require("mongoose");
const Plan = require("../src/models/Plan");

const { ALL_PLANS } = require("./planCatalog");

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    const existing = await Plan.countDocuments();
    console.log(`Plans before seed: ${existing}`);

    const result = await Plan.deleteMany({});
    console.log(`Deleted ${result.deletedCount} existing plans`);

    const created = await Plan.insertMany(ALL_PLANS);
    console.log(`Inserted ${created.length} plans across all networks`);
    console.log("Seed complete. Catalog:");
    created.forEach((p) => console.log(`  [${p.network}] ${p.name} — ₦${p.price} — ${p.validity}`));
  } catch (error) {
    console.error("Seed failed:", error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seed();