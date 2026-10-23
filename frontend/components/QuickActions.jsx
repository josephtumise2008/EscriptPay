import { Wifi, Phone, History } from "lucide-react";
import Link from "next/link";

const ACTIONS = [
  { href: "/buy-data", label: "Buy data", description: "Bundles for every network", icon: Wifi, tone: "bg-cyan-500" },
  { href: "/buy-airtime", label: "Buy airtime", description: "Top up any number", icon: Phone, tone: "bg-sky-500" },
  { href: "/history", label: "Transactions", description: "Receipts and status", icon: History, tone: "bg-indigo-500" },
];

// The main things people come to do — first on the dashboard, compact on phones.
export default function QuickActions() {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
      {ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="card focus-ring press group flex flex-col items-center gap-2.5 p-3.5 text-center hover:border-slate-300 hover:shadow-[var(--shadow-card-hover)] sm:flex-row sm:gap-4 sm:p-5 sm:text-left"
        >
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl brand-contrast sm:h-12 sm:w-12 ${a.tone}`}>
            <a.icon size={21} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[13px] font-bold text-ink-900 sm:text-base">{a.label}</span>
            <span className="mt-0.5 hidden text-xs text-ink-500 sm:block">{a.description}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
