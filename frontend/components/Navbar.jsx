"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";
import UserMenu from "./UserMenu";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/lib/auth-context";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/#why-escriptpay", label: "Why EscriptPay" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#contact", label: "Contact" },
];

export default function Navbar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-all duration-300 ${
        scrolled
          ? "glass border-slate-200/70 shadow-[0_4px_20px_-12px_rgb(6_182_212/0.25)]"
          : "border-transparent bg-transparent"
      }`}
    >
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
      >
        <Link href="/" className="focus-ring rounded-lg" aria-label="EscriptPay home">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="focus-ring rounded-lg px-3.5 py-2 text-sm font-medium text-ink-600 transition-colors duration-200 hover:text-cyan-700"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          {user ? (
            <UserMenu />
          ) : (
            <>
              <Link
                href="/login"
                className="focus-ring rounded-lg px-3.5 py-2 text-sm font-semibold text-ink-700 transition-colors hover:text-cyan-700"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="gradient-btn focus-ring rounded-xl px-5 py-2.5 text-sm font-semibold brand-contrast"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="focus-ring inline-flex items-center justify-center rounded-lg p-2 text-ink-700"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        className={`overflow-hidden md:hidden ${
          mobileOpen ? "animate-fade-down border-t border-slate-200/60" : "hidden"
        }`}
      >
        <div className="glass mx-4 mb-4 mt-2 space-y-1 rounded-2xl border border-slate-100 p-3 shadow-[var(--shadow-card)]">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="focus-ring block rounded-lg px-4 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-cyan-50 hover:text-cyan-700"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-3">
            {user ? (
              <UserMenu mobile onClose={() => setMobileOpen(false)} />
            ) : (
              <>
                <Link
                  href="/login"
                  className="focus-ring block rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-ink-700"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="gradient-btn focus-ring block rounded-lg px-4 py-2.5 text-center text-sm font-semibold brand-contrast"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}