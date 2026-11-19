import { Wifi, Phone, History, Wallet, Tv, Zap, GraduationCap, LifeBuoy } from "lucide-react";
import Link from "next/link";

const ACTIONS = [
  { href: "/buy-data", label: "Buy data", shortLabel: "Data", description: "Bundles for every network", icon: Wifi, tone: "bg-cyan-500" },
  { href: "/buy-airtime", label: "Buy airtime", shortLabel: "Airtime", description: "Top up any number", icon: Phone, tone: "bg-sky-500" },
  { href: "/cable-tv", label: "Cable TV", shortLabel: "TV", description: "DStv, GOtv, StarTimes", icon: Tv, tone: "bg-violet-500" },
  { href: "/electricity", label: "Electricity", shortLabel: "Power", description: "Tokens & postpaid bills", icon: Zap, tone: "bg-amber-500" },
  { href: "/exam-pins", label: "Exam PINs", shortLabel: "Exams", description: "WAEC & JAMB", icon: GraduationCap, tone: "bg-rose-500" },
  { href: "/wallet?fund=1", label: "Fund wallet", shortLabel: "Fund", description: "Add money in seconds", icon: Wallet, tone: "bg-[#10b981]" },
  {
    href: "/history",
    label: "Transactions",
    shortLabel: "History",
    description: "Receipts and status",
    icon: History,
    tone: "bg-indigo-500",
  },
  { href: "/#contact", label: "Get help", shortLabel: "Help", description: "Talk to us anytime", icon: LifeBuoy, tone: "bg-slate-500" },
];

// The main things people come to do — first on the dashboard, compact on phones.
export default function QuickActions() {
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-4 xl:grid-cols-4">
      {ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          aria-label={a.label}
          className="card focus-ring press group flex flex-col items-center gap-2.5 px-1 py-3.5 text-center hover:border-slate-300 hover:shadow-[var(--shadow-card-hover)] sm:gap-2.5 sm:p-4 lg:flex-row lg:gap-4 lg:p-5 lg:text-left"
        >
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl brand-contrast sm:h-12 sm:w-12 ${a.tone}`}>
            <a.icon size={21} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block whitespace-nowrap text-[12.5px] font-semibold tracking-[-0.01em] text-ink-700 sm:font-display sm:text-sm sm:font-bold sm:text-ink-900 lg:text-base">
              {a.shortLabel ? (
                <>
                  <span className="sm:hidden">{a.shortLabel}</span>
                  <span className="hidden sm:inline">{a.label}</span>
                </>
              ) : (
                a.label
              )}
            </span>
            <span className="mt-0.5 hidden text-xs text-ink-500 lg:block">{a.description}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
