// Checks your ClubKonnect wallet balance. Read-only: spends nothing.
//   npm run vtu:balance
const { loadClubkonnect } = require("./lib/privateEnv");

loadClubkonnect();
const ck = require("../src/services/vtu/clubkonnectVtuService");

ck.getBalance()
  .then(({ balance }) => {
    console.log(`ClubKonnect connection OK. Wallet balance: ₦${balance.toLocaleString("en-NG")}`);
  })
  .catch((error) => {
    console.error(`Could not check the balance: ${error.message}`);
    if (/INVALID_CREDENTIALS/.test(error.message)) console.error("Your User ID and API key don't match. Check them on clubkonnect.com → API.");
    process.exit(1);
  });
