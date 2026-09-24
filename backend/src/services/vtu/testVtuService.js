// Test VTU service.
//
// TEST MODE: simulates a successful VTU/airtime top-up. No data is really
// delivered and no provider is contacted. When a real VTU provider
// (e.g. GSubz) is integrated, create
//   services/vtu/gsubzVtuService.js
// and switch VTU_SERVICE=gsubz in the environment.
//
// Future interface (kept stable for the controller):
//   purchaseData({ network, phone, plan, transaction }) ->
//     { providerStatus, reference, delivered }

const crypto = require("crypto");

const purchaseData = async ({ network, phone, plan, transaction }) => {
  // Simulate provider round-trip latency.
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const reference = `VTU-TEST-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  return {
    providerStatus: "successful",
    reference,
    delivered: false,
    message: "Test mode: VTU delivery simulated.",
  };
};

module.exports = { purchaseData };