const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

require("dotenv").config();

const mongoose = require("mongoose");
const Plan = require("../src/models/Plan");

const MTN_PLANS = [
  { network: "MTN", name: "200MB (Share) Monthly", price: 350, validity: "24 - 30 days" },
  { network: "MTN", name: "500MB (Share) Weekly", price: 400, validity: "4 - 7 days" },
  { network: "MTN", name: "1GB (Share) Weekly", price: 500, validity: "4 - 7 days" },
  { network: "MTN", name: "1GB (1 DAY)", price: 500, validity: "1 day" },
  { network: "MTN", name: "1GB (Share) Monthly", price: 550, validity: "24 - 30 days" },
  { network: "MTN", name: "1.5GB (2 DAYS)", price: 600, validity: "2 days" },
  { network: "MTN", name: "2.5GB (2 DAYS)", price: 900, validity: "2 days" },
  { network: "MTN", name: "2GB (Share) Weekly", price: 1000, validity: "4 - 7 days" },
  { network: "MTN", name: "2GB (Share) Monthly", price: 1100, validity: "24 - 30 days" },
  { network: "MTN", name: "3GB (Share) Weekly", price: 1450, validity: "7 days" },
  { network: "MTN", name: "2GB", price: 1500, validity: "30 days" },
  { network: "MTN", name: "3GB (Share) Monthly", price: 1600, validity: "24 - 30 days" },
  { network: "MTN", name: "5GB (Share) Weekly", price: 1950, validity: "7 days" },
  { network: "MTN", name: "2.7GB", price: 2000, validity: "30 days" },
  { network: "MTN", name: "5GB (Share) Monthly", price: 2300, validity: "24 - 30 days" },
  { network: "MTN", name: "6GB (7 DAYS)", price: 2490, validity: "7 days" },
  { network: "MTN", name: "10GB", price: 4485, validity: "30 days" },
  { network: "MTN", name: "12.5GB", price: 5485, validity: "30 days" },
];

// Approximate current-market seed prices for TEST/STAGING. Review and
// update before any live rollout — the DB is the source of truth.
const AIRTEL_PLANS = [
  { network: "Airtel", name: "100MB (2 DAYS)", price: 100, validity: "2 days" },
  { network: "Airtel", name: "200MB (3 DAYS)", price: 200, validity: "3 days" },
  { network: "Airtel", name: "500MB (3 DAYS)", price: 300, validity: "3 days" },
  { network: "Airtel", name: "1GB (7 DAYS)", price: 450, validity: "7 days" },
  { network: "Airtel", name: "750MB (14 DAYS)", price: 500, validity: "14 days" },
  { network: "Airtel", name: "1.5GB (30 DAYS)", price: 1000, validity: "30 days" },
  { network: "Airtel", name: "2GB (30 DAYS)", price: 1200, validity: "30 days" },
  { network: "Airtel", name: "3GB (30 DAYS)", price: 1500, validity: "30 days" },
  { network: "Airtel", name: "4.5GB (30 DAYS)", price: 2000, validity: "30 days" },
  { network: "Airtel", name: "6GB (30 DAYS)", price: 2500, validity: "30 days" },
  { network: "Airtel", name: "8GB (30 DAYS)", price: 3000, validity: "30 days" },
  { network: "Airtel", name: "10GB (30 DAYS)", price: 4000, validity: "30 days" },
];

const GLO_PLANS = [
  { network: "Glo", name: "250MB (7 DAYS)", price: 250, validity: "7 days" },
  { network: "Glo", name: "500MB (7 DAYS)", price: 350, validity: "7 days" },
  { network: "Glo", name: "1GB (30 DAYS)", price: 500, validity: "30 days" },
  { network: "Glo", name: "1.5GB (30 DAYS)", price: 700, validity: "30 days" },
  { network: "Glo", name: "2GB (30 DAYS)", price: 1000, validity: "30 days" },
  { network: "Glo", name: "3GB (30 DAYS)", price: 1300, validity: "30 days" },
  { network: "Glo", name: "4.5GB (30 DAYS)", price: 1500, validity: "30 days" },
  { network: "Glo", name: "5GB (30 DAYS)", price: 1900, validity: "30 days" },
  { network: "Glo", name: "7GB (30 DAYS)", price: 2500, validity: "30 days" },
  { network: "Glo", name: "8GB (30 DAYS)", price: 3000, validity: "30 days" },
  { network: "Glo", name: "10GB (30 DAYS)", price: 3800, validity: "30 days" },
  { network: "Glo", name: "12GB (30 DAYS)", price: 5000, validity: "30 days" },
];

const NINEMOBILE_PLANS = [
  { network: "9mobile", name: "100MB (7 DAYS)", price: 150, validity: "7 days" },
  { network: "9mobile", name: "250MB (7 DAYS)", price: 250, validity: "7 days" },
  { network: "9mobile", name: "500MB (30 DAYS)", price: 500, validity: "30 days" },
  { network: "9mobile", name: "1GB (30 DAYS)", price: 1000, validity: "30 days" },
  { network: "9mobile", name: "1.5GB (30 DAYS)", price: 1500, validity: "30 days" },
  { network: "9mobile", name: "2GB (30 DAYS)", price: 2000, validity: "30 days" },
  { network: "9mobile", name: "2.5GB (30 DAYS)", price: 2200, validity: "30 days" },
  { network: "9mobile", name: "3GB (30 DAYS)", price: 2500, validity: "30 days" },
  { network: "9mobile", name: "4GB (30 DAYS)", price: 3000, validity: "30 days" },
  { network: "9mobile", name: "5GB (30 DAYS)", price: 3500, validity: "30 days" },
  { network: "9mobile", name: "7GB (30 DAYS)", price: 4500, validity: "30 days" },
  { network: "9mobile", name: "10GB (30 DAYS)", price: 6000, validity: "30 days" },
];

const ALL_PLANS = [...MTN_PLANS, ...AIRTEL_PLANS, ...GLO_PLANS, ...NINEMOBILE_PLANS];

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