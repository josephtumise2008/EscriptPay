// Cable TV, electricity and exam PIN catalog + pricing.
//
// Pricing (paying from the wallet, no fee):
//   Cable: the network price minus part of our supplier discount, so the
//          customer pays a little less than OPay & co. (who sell at the
//          network price). CABLE_DISCOUNT_SHARE of our discount goes to them.
//   Electricity: exactly the amount the customer asks for (our ~0.5% supplier
//          discount is our margin).
//   WAEC: WAEC_PIN_PRICE (default ₦5,450). JAMB: supplier price + ₦100.
// Paying by card/bank adds only Paystack's fee on top (cardTotalKobo), so a
// card order can never lose money.
const { vtu, config } = require("./index");
const { quoteFunding } = require("./walletFee");
const { parsePins } = require("./billsText");

const CABLE_PROVIDERS = [
  { id: "dstv", name: "DStv" },
  { id: "gotv", name: "GOtv" },
  { id: "startimes", name: "StarTimes" },
];
const CABLE_DISCOUNT_SHARE = Number(process.env.CABLE_DISCOUNT_SHARE ?? 0.5);

// ClubKonnect's electricity companies (codes from its API docs).
const DISCOS = [
  ["01", "Eko Electric", "EKEDC"],
  ["02", "Ikeja Electric", "IKEDC"],
  ["03", "Abuja Electric", "AEDC"],
  ["04", "Kano Electric", "KEDCO"],
  ["05", "Port Harcourt Electric", "PHEDC"],
  ["06", "Jos Electric", "JEDC"],
  ["07", "Ibadan Electric", "IBEDC"],
  ["08", "Kaduna Electric", "KAEDCO"],
  ["09", "Enugu Electric", "EEDC"],
  ["10", "Benin Electric", "BEDC"],
  ["11", "Yola Electric", "YEDC"],
  ["12", "Aba Power", "APLE"],
].map(([code, name, short]) => ({ code, name, short }));
const ELECTRICITY_COST_FACTOR = Number(process.env.ELECTRICITY_COST_FACTOR || 0.995);
const ELECTRICITY_MIN = 1000;
const ELECTRICITY_MAX = 200000;

const EXAMS = [
  { id: "waec", name: "WAEC" },
  { id: "jamb", name: "JAMB" },
];
const WAEC_PIN_PRICE = Number(process.env.WAEC_PIN_PRICE || 5450);
const JAMB_MARGIN = Number(process.env.JAMB_PIN_MARGIN || 100);

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();
const cached = async (key, load) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
};
const __resetBillsCache = () => cache.clear();

const cablePrice = ({ amount, cost }) => {
  const share = Math.min(Math.max(CABLE_DISCOUNT_SHARE, 0), 1);
  const price = Math.floor(amount - (amount - cost) * share);
  // Never sell below our cost.
  return Math.max(price, Math.ceil(cost));
};

const examPrice = (exam, amount) =>
  exam === "waec" ? Math.max(WAEC_PIN_PRICE, Math.ceil(amount) + 50) : Math.ceil(amount) + JAMB_MARGIN;

const cableCatalog = () =>
  cached("cable", async () => {
    const packages = typeof vtu.getCablePackages === "function" ? await vtu.getCablePackages() : [];
    return CABLE_PROVIDERS.map((p) => ({
      ...p,
      packages: packages
        .filter((x) => x.provider === p.id)
        .map((x) => ({ code: x.code, name: x.name, networkPrice: x.amount, price: cablePrice(x), cost: x.cost }))
        .sort((a, b) => a.price - b.price),
    }));
  });

const examCatalog = () =>
  cached("exam", async () =>
    Promise.all(
      EXAMS.map(async (e) => {
        let packages = [];
        try {
          packages = typeof vtu.getExamPackages === "function" ? await vtu.getExamPackages(e.id) : [];
        } catch {
          packages = [];
        }
        return { ...e, packages: packages.map((p) => ({ code: p.code, name: p.name, price: examPrice(e.id, p.amount), cost: p.amount })) };
      })
    )
  );

// Public view (no costs).
const publicCatalog = async () => {
  const [cable, exam] = await Promise.all([cableCatalog().catch(() => null), examCatalog().catch(() => null)]);
  const strip = (list) =>
    list && list.map((g) => ({ ...g, packages: g.packages.map(({ cost, ...rest }) => rest) }));
  return {
    cable: strip(cable),
    electricity: { companies: DISCOS, min: ELECTRICITY_MIN, max: ELECTRICITY_MAX },
    exam: strip(exam),
    cardFee: feeSchedule(),
  };
};

const feeSchedule = () => {
  const f = config.walletFee || {};
  return { percent: f.percent ?? 1.5, flatKobo: f.flatKobo ?? 10000, flatThresholdKobo: f.flatThresholdKobo ?? 250000, capKobo: f.capKobo ?? 200000 };
};

// What a card/bank payment costs the customer so that Paystack's fee is
// covered. -> { feeKobo, chargeKobo }
const cardTotalKobo = (amountKobo) => {
  const q = quoteFunding(amountKobo, { ...feeSchedule(), enabled: true });
  return { feeKobo: q.feeKobo, chargeKobo: q.chargeKobo };
};

module.exports = {
  CABLE_PROVIDERS,
  DISCOS,
  EXAMS,
  ELECTRICITY_MIN,
  ELECTRICITY_MAX,
  ELECTRICITY_COST_FACTOR,
  cableCatalog,
  examCatalog,
  publicCatalog,
  cablePrice,
  examPrice,
  cardTotalKobo,
  parsePins,
  __resetBillsCache,
};
