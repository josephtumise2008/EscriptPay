import { Wallet, ReceiptText, Wifi, CheckCircle2 } from "lucide-react";

const ICONS = {
  balance: Wallet,
  total: ReceiptText,
  purchased: Wifi,
  successful: CheckCircle2,
};

const ACCENTS = {
  balance: "from-cyan-100 to-sky-50 text-cyan-600",
  total: "from-sky-100 to-indigo-50 text-sky-600",
  purchased: "from-purple-lite-100 to-cyan-50 text-purple-lite-600",
  successful: "from-emerald-50 to-cyan-50 text-emerald-600",
};

export default function SummaryCard({ icon, title, value, sub, index = 0 }) {
  const Icon = ICONS[icon] || Wallet;
  const accent = ACCENTS[icon] || ACCENTS.balance;
  return (
    <div
      className="card card-hover animate-fade-up p-5"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-500">{title}</p>
          <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink-900">
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-ink-400">{sub}</p>}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${accent}`}>
          <Icon size={21} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}