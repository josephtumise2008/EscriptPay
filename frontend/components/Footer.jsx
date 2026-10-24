import Link from "next/link";
import { Lock } from "lucide-react";
import Logo from "./Logo";

const GROUPS = [
  {
    title: "Product",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#why-escriptpay", label: "Why EscriptPay" },
      { href: "/buy-data", label: "Buy data" },
      { href: "/buy-airtime", label: "Buy airtime" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/signup", label: "Create account" },
      { href: "/login", label: "Log in" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/forgot-password", label: "Reset password" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/#faq", label: "FAQ" },
      { href: "/#contact", label: "Contact" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200/70 bg-white/60">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.3fr_2fr]">
          <div className="max-w-sm">
            <Link href="/" className="focus-ring inline-block rounded-lg" aria-label="EscriptPay home">
              <Logo />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-ink-500">
              Airtime and data for MTN, Airtel, Glo and 9mobile, with clear prices and a receipt for every order.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <p className="text-sm font-semibold text-ink-900">{g.title}</p>
                <ul className="mt-3 space-y-2">
                  {g.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="focus-ring rounded text-sm text-ink-500 hover:text-ink-900">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-slate-200/70 pt-6 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} EscriptPay. All rights reserved.</p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1.5">
              <Lock size={12} className="text-emerald-500" aria-hidden="true" />
              Payments secured by Paystack
            </span>
            <span className="inline-flex items-center gap-1.5" aria-label="Supported networks: MTN, Airtel, Glo, 9mobile">
              <span aria-hidden="true" className="flex -space-x-0.5">
                <span className="h-2 w-2 rounded-full bg-yellow-400 ring-2 ring-white" />
                <span className="h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                <span className="h-2 w-2 rounded-full bg-lime-500 ring-2 ring-white" />
              </span>
              All Nigerian networks
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
