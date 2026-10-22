// Dev helper: promote a user to admin so the protected plan-management
// endpoints (POST/PUT/DELETE /api/plans) can be exercised end-to-end.
//
//   node scripts/setAdmin.js <user-email>
//
// In staging the admin UI is not built yet; changing the role in MongoDB is
// the real authorization boundary the API enforces.

require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../src/models/User");

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/setAdmin.js <user-email>");
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOneAndUpdate(
    { email: email.trim().toLowerCase() },
    { $set: { role: "admin" } },
    { returnDocument: "after" }
  );
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }
  console.log(`Promoted ${user.email} to role: ${user.role}`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});