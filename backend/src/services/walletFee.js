// Card-fee pass-through for wallet top-ups.
//
// Given the amount the customer wants in their wallet (A, kobo), find the
// smallest total charge C such that C minus the payment provider's fee on C is
// at least A. The provider fee schedule comes from config.walletFee.
const providerFee = (chargeKobo, fee) => {
  const percent = Math.ceil((chargeKobo * fee.percent) / 100);
  const flat = chargeKobo >= fee.flatThresholdKobo ? fee.flatKobo : 0;
  return Math.min(percent + flat, fee.capKobo);
};

const quoteFunding = (amountKobo, fee) => {
  if (!fee || !fee.enabled) return { amountKobo, feeKobo: 0, chargeKobo: amountKobo };
  let charge = amountKobo;
  for (let i = 0; i < 20; i += 1) {
    const next = amountKobo + providerFee(charge, fee);
    if (next === charge) break;
    charge = next;
  }
  // Safety: never under-charge (fixed point can land one step short at a
  // tier boundary).
  while (charge - providerFee(charge, fee) < amountKobo) charge += 1;
  // Round the total up to a whole naira so customers see clean numbers.
  charge = Math.ceil(charge / 100) * 100;
  return { amountKobo, feeKobo: charge - amountKobo, chargeKobo: charge };
};

module.exports = { quoteFunding, providerFee };
