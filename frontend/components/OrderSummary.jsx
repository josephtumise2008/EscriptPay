import { formatNaira } from "@/lib/format";
import { Wifi, Package, CalendarDays, Smartphone, Banknote, Wallet, CreditCard } from "lucide-react";

const ROWS = (plan, phone, payWith) => [
  { label: "Network", value: plan.network, icon: Wifi },
  { label: "Plan", value: plan.name, icon: Package },
  { label: "Validity", value: plan.validity, icon: CalendarDays },
  { label: "Phone", value: phone || "—", icon: Smartphone },
  payWith === "wallet"
    ? { label: "Pay with", value: "Wallet balance", icon: Wallet }
    : { label: "Pay with", value: "Card / bank", icon: CreditCard },
  { label: "Amount", value: formatNaira(plan.price), icon: Banknote, emphasize: true },
];

export default function OrderSummary({ plan, phone, onBuyNow, processing = false, payWith = "card" }) {
  return (
    <div className="card card-hover overflow-hidden">
      <div className="gradient-btn px-5 py-4">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider brand-contrast">
          Order Summary
        </h2>
      </div>

      <div className="p-5">
        <ul className="space-y-3">
          {ROWS(plan, phone, payWith).map((row) => (
            <li key={row.label} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-50 to-purple-lite-100 text-cyan-600">
                <row.icon size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-400">{row.label}</p>
                <p
                  className={`truncate text-sm ${
                    row.emphasize ? "font-display text-lg font-extrabold gradient-text" : "font-semibold text-ink-800"
                  }`}
                >
                  {row.value}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onBuyNow}
          disabled={processing}
          className="gradient-btn focus-ring mt-6 w-full rounded-xl px-5 py-3.5 text-sm font-bold brand-contrast disabled:cursor-not-allowed disabled:opacity-60"
        >
          {processing ? "Processing payment..." : payWith === "wallet" ? `Pay ${formatNaira(plan.price)} from wallet` : "BUY NOW"}
        </button>
      </div>
    </div>
  );
}