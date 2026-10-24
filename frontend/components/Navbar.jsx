"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Menu,
  X,
  LayoutDashboard,
  ChevronRight,
  LogOut,
  Home,
  ListChecks,
  ShieldCheck,
  HelpCircle,
  MessageCircle,
  ArrowRight,
  Wallet,
} from "lucide-react";
import { BalanceAmount } from "./WalletBalance";
import { initials } from "@/lib/format";
import Logo from "./Logo";
import InstallApp from "./InstallApp";
import UserMenu from "./UserMenu";
import ThemeToggle from "./ThemeToggle";
import { useLogout, LogoutErrorToast } from "@/hooks/useLogout";
import { useAuth } from "@/lib/auth-context";
import { useScrollLock, releaseScrollLock } from "@/hooks/useScrollLock";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/#how-it-works", label: "How it works", icon: ListChecks },
  { href: "/#why-escriptpay", label: "Why EscriptPay", icon: ShieldCheck },
  { href: "/#faq", label: "FAQ", icon: HelpCircle },
  { href: "/#contact", label: "Contact", icon: MessageCircle },
];

export default function Navbar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { logout, error: logoutError } = useLogout();
  const toggleRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // While the menu is open the page behind it must not scroll. Only <html>
  // is locked: putting overflow:hidden on <body> turns it into its own scroll
  // container, which un-sticks this sticky header (it scrolled off-screen
  // with the page, taking the close button with it). The dimmed backdrop also
  // blocks touch scrolling, and the panel contains its own overscroll.
  useScrollLock(mobileOpen);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        toggleRef.current?.focus();
      }
    };
    // Close if the screen grows to desktop width while open.
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onDesktop = (e) => e.matches && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onDesktop);
    return () => {
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onDesktop);
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  // Highlight the section currently in view (homepage only).
  const [activeSection, setActiveSection] = useState("");
  useEffect(() => {
    if (pathname !== "/") return undefined;
    const ids = NAV_LINKS.map((l) => l.href.split("#")[1]).filter(Boolean);
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!sections.length || !("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((el) => observer.observe(el));
    const onTop = () => {
      if (window.scrollY < 200) setActiveSection("");
    };
    window.addEventListener("scroll", onTop, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onTop);
    };
  }, [pathname]);

  // On the homepage, "Home" and the section links scroll smoothly in place
  // (a Next.js link to the page you're already on would do nothing). The
  // mobile menu's scroll lock is released first so the scroll isn't blocked.
  const onNavClick = (e, href) => {
    closeMobile();
    if (pathname !== "/") return; // let the router load the homepage + hash
    e.preventDefault();
    releaseScrollLock();
    const id = href.split("#")[1];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior = reduce ? "auto" : "smooth";
    requestAnimationFrame(() => {
      if (id) {
        document.getElementById(id)?.scrollIntoView({ behavior, block: "start" });
        window.history.pushState(null, "", `/#${id}`);
      } else {
        window.scrollTo({ top: 0, behavior });
        window.history.pushState(null, "", "/");
      }
    });
  };

  const isCurrent = (href) => {
    if (pathname !== "/") return false;
    const id = href.split("#")[1];
    return id ? activeSection === id : activeSection === "";
  };

  return (
    <header
      className={`sticky top-[env(safe-area-inset-top)] z-50 border-b transition-[background-color,border-color,box-shadow] duration-200 ${
        mobileOpen
          ? "border-slate-200 bg-white"
          : scrolled
            ? "border-slate-200/70 bg-white shadow-[0_8px_24px_-20px_rgb(15_23_42/0.35)] lg:bg-white/85 lg:backdrop-blur-xl"
            : "border-transparent bg-transparent"
      }`}
    >
      <nav aria-label="Main navigation" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" onClick={(e) => onNavClick(e, "/")} className="focus-ring rounded-lg" aria-label="EscriptPay home">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-0.5 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={(e) => onNavClick(e, link.href)}
                aria-current={isCurrent(link.href) ? "true" : undefined}
                className={`focus-ring relative rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 hover:text-ink-900 ${
                  isCurrent(link.href) ? "text-ink-900" : "text-ink-600"
                }`}
              >
                {link.label}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-cyan-500 transition-[opacity,transform] duration-300 ${
                    isCurrent(link.href) ? "scale-x-100 opacity-100" : "scale-x-50 opacity-0"
                  }`}
                />
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          {user ? (
            <>
              <Link href="/dashboard" className="focus-ring btn-secondary py-2.5">
                <LayoutDashboard size={16} aria-hidden="true" />
                Dashboard
              </Link>
              <UserMenu onLogoutRequest={logout} />
            </>
          ) : (
            <>
              <Link href="/login" className="focus-ring rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-700 hover:bg-slate-100 hover:text-ink-900">
                Log in
              </Link>
              <Link href="/signup" className="gradient-btn focus-ring rounded-xl px-5 py-2.5 text-sm font-semibold brand-contrast">
                Create account
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="focus-ring icon-btn text-ink-700"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {/* Tap anywhere outside the panel to close it. */}
      <div
        aria-hidden="true"
        onClick={closeMobile}
        className={`fixed inset-x-0 bottom-0 top-[calc(4rem+env(safe-area-inset-top))] z-40 touch-none bg-slate-950/45 transition-opacity duration-200 lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        id="mobile-menu"
        data-state={mobileOpen ? "open" : "closed"}
        inert={!mobileOpen}
        className="popover fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-50 max-h-[calc(100dvh-4rem-env(safe-area-inset-top))] overflow-y-auto overscroll-contain rounded-b-[1.75rem] border-b border-slate-200/80 bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_30px_60px_-24px_rgb(15_23_42/0.55)] lg:hidden"
        style={{ transformOrigin: "top center" }}
      >
        {user && (
          <div className="wallet-gradient relative mb-3 overflow-hidden rounded-2xl p-4 brand-contrast">
            <div aria-hidden="true" className="wallet-sheen pointer-events-none absolute inset-0" />
            <div className="relative flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ffffff]/20 text-sm font-bold ring-2 ring-[#ffffff]/30">
                {initials(user.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold">{user.name}</p>
                <p className="truncate text-xs text-[#ffffff]/75">{user.email}</p>
              </div>
              <div className="text-right">
                <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#ffffff]/70">
                  <Wallet size={11} aria-hidden="true" />
                  Balance
                </p>
                <BalanceAmount className="block font-display text-base font-extrabold" skeletonClass="mt-1 h-4 w-14 bg-[#ffffff]/30" />
              </div>
            </div>
          </div>
        )}

        <ul className="space-y-1">
          {NAV_LINKS.map((link) => {
            const current = isCurrent(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={(e) => onNavClick(e, link.href)}
                  aria-current={current ? "true" : undefined}
                  className={`focus-ring group flex items-center gap-3 rounded-2xl px-2 py-2 ${
                    current ? "bg-cyan-50" : "hover:bg-slate-50 active:bg-slate-100"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      current ? "wallet-gradient brand-contrast" : "bg-slate-100 text-ink-600 group-hover:text-cyan-700"
                    }`}
                  >
                    <link.icon size={18} aria-hidden="true" />
                  </span>
                  <span className={`flex-1 text-[15px] font-semibold ${current ? "text-cyan-800" : "text-ink-800"}`}>
                    {link.label}
                  </span>
                  <ChevronRight
                    size={17}
                    aria-hidden="true"
                    className={`transition-transform group-hover:translate-x-0.5 ${current ? "text-cyan-600" : "text-ink-300"}`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 space-y-2.5">
          {user ? (
            <>
              <Link
                href="/dashboard"
                onClick={closeMobile}
                className="focus-ring gradient-btn press flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold brand-contrast shadow-[0_16px_32px_-16px_rgb(124_58_237/0.8)]"
              >
                <LayoutDashboard size={18} aria-hidden="true" />
                Go to dashboard
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={() => {
                  closeMobile();
                  logout();
                }}
                className="focus-ring press flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 text-[15px] font-semibold text-red-600 hover:border-red-200 hover:bg-red-50"
              >
                <LogOut size={18} aria-hidden="true" />
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/signup"
                onClick={closeMobile}
                className="focus-ring gradient-btn press flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold brand-contrast shadow-[0_16px_32px_-16px_rgb(124_58_237/0.8)]"
              >
                Create free account
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link
                href="/login"
                onClick={closeMobile}
                className="focus-ring press flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-[15px] font-semibold text-ink-800 hover:bg-slate-50"
              >
                Log in
              </Link>
            </>
          )}
          <InstallApp variant="block" onDone={closeMobile} />
        </div>
      </div>

      <LogoutErrorToast message={logoutError} />
    </header>
  );
}
