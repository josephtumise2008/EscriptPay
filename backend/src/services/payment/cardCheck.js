// Card-country guard.
//
// EscriptPay serves Nigerian customers. Foreign cards paying for Nigerian
// airtime/data are almost always stolen cards (the airtime is resold before
// the real owner notices, and the chargeback lands on us). A verified card
// payment from a country outside config.allowedCardCountries is never
// credited or delivered: it is flagged and refunded.
//
// Bank transfer / USSD payments have no card country and are not affected.
// A card payment that reports no country is allowed (fail open) so a missing
// field from the provider never blocks genuine customers.
const isForeignCard = (verified, config) => {
  const allowed = config && config.allowedCardCountries;
  if (!Array.isArray(allowed) || allowed.length === 0) return false;
  if (!verified || verified.channel !== "card") return false;
  const country = String(verified.cardCountry || "").toUpperCase();
  return Boolean(country) && !allowed.includes(country);
};

// Asks the provider to refund the payment. Returns "requested" | "failed" |
// "not_supported" and never throws.
const refundBlockedPayment = async (payment, reference) => {
  if (!payment || typeof payment.refundPayment !== "function") return "not_supported";
  try {
    await payment.refundPayment(reference);
    return "requested";
  } catch {
    return "failed";
  }
};

module.exports = { isForeignCard, refundBlockedPayment };
