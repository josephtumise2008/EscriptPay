// EscriptPay selling prices for ClubKonnect data plans (owner's decisions).
//
// Every ClubKonnect plan on every network is put on sale with a profit:
//
// 1. fixedProfit — exact profit per plan, set by the owner (MTN SME list).
// 2. Network bundles (Awoof / Direct Data): ClubKonnect sells these at the
//    network's own price minus a small discount (MTN/Airtel 3%, Glo 4.5%,
//    9mobile 7% as of Oct 2026). We sell BELOW the network's price: the
//    customer gets CUSTOMER_SHARE of that discount, but we always keep at
//    least MIN_BUNDLE_KEEP of the network price (covers card fees + profit).
//    So on 3% networks the saving is small (₦800 bundle -> ₦796); on 7%
//    networks it is bigger (₦1,000 9mobile bundle -> ₦972).
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
// Smallest margin we keep on a network bundle, as a share of its price.
const MIN_BUNDLE_KEEP = 0.025;

const standardProfit = (cost) => (cost < 300 ? Math.max(cost * 0.15, 10) : Math.max(cost * 0.075, 35));

// ClubKonnect plan code -> the network's own price, when the code encodes it
// (bundle codes sit 3–20% above our cost; SME codes don't follow this).
// The network's own price for a bundle. PlansV3 gives it directly
// (plan.networkPrice); for older data, the plan code carries it.
const networkPriceOf = (plan) => {
  if (plan.networkPrice) return plan.networkPrice;
  if (plan.dataType && plan.dataType !== "DIRECT") return null;
  const face = Math.round(Number(plan.providerPlanId));
  if (!Number.isFinite(face) || face <= 0) return null;
  const ratio = face / plan.cost;
  return ratio > 1.03 && ratio <= 1.2 ? face : null;
};

const price = (plan) => {
  const { cost } = plan;
  const fixed = (FIXED_PROFIT[plan.network] || {})[plan.providerPlanId];
  if (fixed !== undefined) return Math.max(Math.ceil(cost + fixed), Math.ceil(cost * 1.03));

  const networkPrice = networkPriceOf(plan);
  if (networkPrice !== null) {
    const shared = Math.floor(networkPrice - (networkPrice - cost) * CUSTOMER_SHARE);
    const minimum = Math.ceil(cost + networkPrice * MIN_BUNDLE_KEEP);
    return Math.min(networkPrice, Math.max(shared, minimum));
  }
  return Math.max(Math.ceil(cost + standardProfit(cost)), Math.ceil(cost * 1.03));
};

module.exports = { price, networkPriceOf, FIXED_PROFIT, CUSTOMER_SHARE, MIN_BUNDLE_KEEP };
