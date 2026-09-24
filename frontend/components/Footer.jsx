import Link from "next/link";
import Logo from "./Logo";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/login", label: "Login" },
  { href: "/signup", label: "Sign Up" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200/70 bg-white/60">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
          <div className="max-w-sm">
            <Link href="/" className="focus-ring inline-block rounded-lg">
              <Logo />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-ink-500">
              Fast, simple and reliable data and airtime purchases in Nigeria.
              Buy data. Stay connected.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <div>
              <p className="text-sm font-bold text-ink-800">Platform</p>
              <ul className="mt-3 space-y-2.5">
                {LINKS.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-ink-500 transition-colors hover:text-cyan-700"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-bold text-ink-800">Networks</p>
              <ul className="mt-3 space-y-2.5 text-sm text-ink-500">
                <li>MTN</li>
                <li>Airtel</li>
                <li>Glo</li>
                <li>9mobile</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-bold text-ink-800">Support</p>
              <ul className="mt-3 space-y-2.5 text-sm text-ink-500">
                <li>support@escriptpay.com (placeholder)</li>
                <li>Mon – Sat, 9am – 6pm WAT</li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-200/70 pt-6 text-xs text-ink-400 sm:flex-row">
          <p>© {new Date().getFullYear()} EscriptPay. All rights reserved.</p>
          <p>Made in Nigeria 🇳🇬</p>
        </div>
      </div>
    </footer>
  );
}