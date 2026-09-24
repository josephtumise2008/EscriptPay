// Test payment service.
//
// TEST MODE: no real money moves and no payment gateway is contacted.
// When a real provider (e.g. Paystack) is added, create
//   services/payment/paystackPaymentService.js
// and switch PAYMENT_SERVICE=paystack in the environment. The purchase
// controller calls this module through services/index.js and is unaware
// of which provider is active.
//
// Future interface (kept stable for the controller):
//   processPayment({ user, transaction, amount }) ->
//     { paymentStatus, reference, simulated }

const processPayment = async ({ user, transaction }) => {
  await new Promise((resolve) => setTimeout(resolve, 400));

  return {
    paymentStatus: "not_required",
    reference: null,
    simulated: true,
    message: "Test mode: no payment required.",
  };
};

module.exports = { processPayment };