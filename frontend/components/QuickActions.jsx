import { Wifi, Phone, History } from "lucide-react";
import Link from "next/link";

const ACTIONS = [
  {
    href: "/buy-data",
    label: "Buy Data",
    description: "Data plans for every network",
    icon: Wifi,
    accent: "from-cyan-500 to-sky-500",
  },
  {
    href: "/buy-airtime",
    label: "Buy Airtime",
    description: "Top up any number",
    icon: Phone,
    accent: "from-sky-500 to-indigo-500",
  },
  {
    href: "/history",
    label: "View Transactions",
    description: "See your purchase history",
    icon: History,
    accent: "from-purple-lite-400 to-purple-lite-600",
  },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {ACTIONS.map((a, i) => (
        <div
          key={a.label}
          className="card card-hover animate-fade-up p-5"
          style={{ animationDelay: `${i * 90}ms` }}
        >
          {a.soon ? (
            <div className="flex h-full flex-col cursor-not-allowed opacity-70" title="Coming soon">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr ${a.accent} brand-contrast`}>
                <a.icon size={21} aria-hidden="true" />
              </div>
              <p className="mt-4 font-display text-base font-bold text-ink-800">{a.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">{a.description}</p>
              <span className="mt-3 inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-400">
                Coming soon
              </span>
            </div>
          ) : (
            <Link href={a.href} className="focus-ring group block rounded-xl">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr ${a.accent} brand-contrast transition-transform duration-200 group-hover:scale-105`}>
                <a.icon size={21} aria-hidden="true" />
              </div>
              <p className="mt-4 font-display text-base font-bold text-ink-800 transition-colors group-hover:text-cyan-700">
                {a.label}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">{a.description}</p>
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}