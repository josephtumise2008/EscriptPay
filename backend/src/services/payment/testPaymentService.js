// Test payment service.
//
// TEST MODE: no real money moves and no payment gateway is contacted. Orders
// are marked paymentStatus "not_required". The order lifecycle only allows
// this to be followed by SIMULATED delivery — config/payments.js refuses to
// start if PAYMENT_SERVICE=test is combined with a real VTU supplier.
//
//   processPayment({ user, transaction, amount }) ->
//     { paymentStatus, reference, simulated }

const processPayment = async () => {
  const delay = Number(process.env.TEST_PAYMENT_DELAY_MS ?? 400);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

  return {
    paymentStatus: "not_required",
    reference: null,
    simulated: true,
    message: "Test mode: no payment required.",
  };
};

module.exports = { name: "test", requiresCheckout: false, simulated: true, processPayment };
