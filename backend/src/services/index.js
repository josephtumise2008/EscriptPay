// Service registry.
//
// The purchase controller depends only on this module. Swapping the
// active payment or VTU provider is a configuration change (env), not a
// code change — the controller always calls the same interface.
//
//   payment.processPayment({ user, transaction, amount })
//   vtu.purchaseData({ network, phone, plan, transaction })

const PAYMENT_SERVICE = process.env.PAYMENT_SERVICE || "test";
const VTU_SERVICE = process.env.VTU_SERVICE || "test";

const payment = PAYMENT_SERVICE === "test"
  ? require("./payment/testPaymentService")
  : require(`./payment/${PAYMENT_SERVICE}PaymentService`);

const vtu = VTU_SERVICE === "test"
  ? require(`./vtu/${VTU_SERVICE}VtuService`)
  : require(`./vtu/${VTU_SERVICE}VtuService`);

module.exports = { payment, vtu };