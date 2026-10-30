// EscriptPay selling prices for ClubKonnect data plans (owner's decisions).
//
// Every ClubKonnect plan on every network is put on sale with a profit:
//
// 1. fixedProfit — exact profit per plan, set by the owner (MTN SME list).
// 2. Network bundles (Awoof / Direct Data): ClubKonnect's plan code carries
//    the network's own price (e.g. "800.01" = ₦800 bundle, cost ₦752.72).
//    We always sell BELOW the network's price: the customer gets
//    CUSTOMER_SHARE of the gap between the network price and our cost, we
//    keep the rest (e.g. ₦800 bundle, cost ₦752.72 -> ₦781, we keep ₦28).
//    If cost + standard profit is cheaper still, that price is used.
// 3. Everything else (SME, Night, …): cost + standard profit.
//
// Standard profit = max(7.5% of cost, ₦35); for small plans (cost < ₦300)
// max(15% of cost, ₦10) so cheap bundles stay cheap.
// Floor: never below cost + 3% (covers card fees). Prices are whole Naira.

const FIXED_PROFIT = {
  MTN: { "500": 35, "1000": 40, "1000.00": 45, "2000.00": 83, "5000.00": 189 },
};

// Share of the bundle discount passed on to the customer (0–1).
const CUSTOMER_SHARE = 0.4;

const standardProfit = (cost) => (cost < 300 ? Math.max(cost * 0.15, 10) : Math.max(cost * 0.075, 35));

// ClubKonnect plan code -> the network's own price, when the code encodes it
// (bundle codes sit 3–20% above our cost; SME codes don't follow this).
const networkPriceOf = (plan) => {
  const face = Math.round(Number(plan.providerPlanId));
  if (!Number.isFinite(face) || face <= 0) return null;
  const ratio = face / plan.cost;
  return ratio > 1.03 && ratio <= 1.2 ? face : null;
};

const price = (plan) => {
  const { cost } = plan;
  const fixed = (FIXED_PROFIT[plan.network] || {})[plan.providerPlanId];
  let value;
  if (fixed !== undefined) {
    value = Math.ceil(cost + fixed);
  } else {
    value = Math.ceil(cost + standardProfit(cost));
    const networkPrice = networkPriceOf(plan);
    if (networkPrice !== null) {
      const belowNetwork = Math.floor(networkPrice - (networkPrice - cost) * CUSTOMER_SHARE);
      value = Math.min(value, belowNetwork);
    }
  }
  return Math.max(value, Math.ceil(cost * 1.03));
};

module.exports = { price, networkPriceOf, FIXED_PROFIT, CUSTOMER_SHARE };
