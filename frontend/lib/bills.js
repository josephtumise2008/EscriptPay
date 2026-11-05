// Shared helpers for cable TV, electricity and exam PIN orders.
import { Tv, Zap, GraduationCap, Wifi, Phone } from "lucide-react";

export const BILL_TYPES = ["cable", "electricity", "exam"];
export const isBill = (tx) => BILL_TYPES.includes(tx?.type);

export const TYPE_META = {
  data: { label: "Data purchase", short: "Data", icon: Wifi, what: "data" },
  airtime: { label: "Airtime top-up", short: "Airtime", icon: Phone, what: "airtime" },
  cable: { label: "Cable TV subscription", short: "Cable TV", icon: Tv, what: "subscription" },
  electricity: { label: "Electricity", short: "Electricity", icon: Zap, what: "electricity token" },
  exam: { label: "Exam PIN", short: "Exam PIN", icon: GraduationCap, what: "PIN" },
};
export const typeMeta = (type) => TYPE_META[type] || TYPE_META.data;

// Mirrors the server: the smallest total C (whole naira) such that
// C - Paystack's fee on C covers the price. Only shown as a preview; the
// server computes the real charge.
const providerFee = (k, f) => Math.min(Math.ceil((k * f.percent) / 100) + (k >= f.flatThresholdKobo ? f.flatKobo : 0), f.capKobo);
export const cardTotal = (amountNaira, schedule) => {
  if (!schedule || !Number.isFinite(amountNaira) || amountNaira <= 0) return null;
  const amount = Math.round(amountNaira * 100);
  let charge = amount;
  for (let i = 0; i < 20; i += 1) {
    const next = amount + providerFee(charge, schedule);
    if (next === charge) break;
    charge = next;
  }
  while (charge - providerFee(charge, schedule) < amount) charge += 1;
  charge = Math.ceil(charge / 100) * 100;
  return { total: charge / 100, fee: (charge - amount) / 100 };
};

// "Prepaid" / "Postpaid" for the receipt.
export const meterTypeLabel = (code) => (code === "02" ? "Postpaid" : "Prepaid");
