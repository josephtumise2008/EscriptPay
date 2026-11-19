import { Wallet, ReceiptText, Wifi, CheckCircle2, Phone } from "lucide-react";

const ICONS = {
  balance: Wallet,
  total: ReceiptText,
  purchased: Wifi,
  airtime: Phone,
  successful: CheckCircle2,
};

const ACCENTS = {
  balance: "from-cyan-100 to-sky-50 text-cyan-600",
  total: "from-sky-100 to-indigo-50 text-sky-600",
  purchased: "from-purple-lite-100 to-cyan-50 text-purple-lite-600",
  airtime: "from-cyan-100 to-purple-lite-50 text-cyan-600",
  successful: "from-emerald-50 to-cyan-50 text-emerald-600",
};

export default function SummaryCard({ icon, title, value, sub, index = 0, bare = false }) {
  const Icon = ICONS[icon] || Wallet;
  const accent = ACCENTS[icon] || ACCENTS.balance;
  if (bare) {
    // One cell of a shared stats panel: number first, label under it.
    return (
      <div className="bg-white px-4 py-4 sm:px-5 sm:py-5" data-index={index}>
        <p className="font-display text-2xl font-extrabold tracking-tight text-ink-900 tabular-nums sm:text-[1.75rem]">{value}</p>
        <p className="mt-1 text-xs font-medium text-ink-500 sm:text-sm">{title}</p>
      </div>
    );
  }
  return (
    <div className="card p-4 sm:p-5" data-index={index}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-500 sm:text-sm">{title}</p>
          <p className="mt-1.5 font-display text-xl font-extrabold tracking-tight text-ink-900 sm:mt-2 sm:text-2xl">
            {value}
          </p>
          {sub && <p className="mt-1 hidden text-xs text-ink-400 sm:block">{sub}</p>}
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr sm:h-11 sm:w-11 ${accent}`}>
          <Icon size={19} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}