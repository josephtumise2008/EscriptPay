// Naira <-> kobo conversion. Paystack amounts are sent and verified in the
// currency subunit (kobo for NGN). Prices in the database are whole Naira.
const toKobo = (naira) => {
  const n = Number(naira);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Amount must be a positive number.");
  }
  return Math.round(n * 100);
};

const fromKobo = (kobo) => Number(kobo) / 100;

module.exports = { toKobo, fromKobo };
