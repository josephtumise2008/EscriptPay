"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, LayoutDashboard, ChevronRight, LogOut } from "lucide-react";
import Logo from "./Logo";
import UserMenu from "./UserMenu";
import ThemeToggle from "./ThemeToggle";
import { useLogout, LogoutErrorToast } from "@/hooks/useLogout";
import { useAuth } from "@/lib/auth-context";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#why-escriptpay", label: "Why EscriptPay" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#contact", label: "Contact" },
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

  // While the menu is open the page behind it must not scroll. Locking both
  // <html> and <body> works on iOS Safari too (body alone does not).
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const previous = { html: html.style.overflow, body: body.style.overflow };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
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
      html.style.overflow = previous.html;
      body.style.overflow = previous.body;
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
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
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
      className={`sticky top-0 z-50 border-b pt-[env(safe-area-inset-top)] transition-[background-color,border-color,box-shadow] duration-200 ${
        mobileOpen
          ? "border-slate-200 bg-white"
          : scrolled
            ? "border-slate-200/70 bg-white/85 shadow-[0_8px_24px_-20px_rgb(15_23_42/0.35)] backdrop-blur-xl"
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
        className="popover fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top)+0.5rem)] z-50 max-h-[calc(100dvh-5.5rem-env(safe-area-inset-top))] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_24px_60px_-20px_rgb(15_23_42/0.5)] lg:hidden"
        style={{ transformOrigin: "top center" }}
      >
        <ul>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={(e) => onNavClick(e, link.href)}
                aria-current={isCurrent(link.href) ? "true" : undefined}
                className={`focus-ring flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-semibold hover:bg-slate-50 ${
                  isCurrent(link.href) ? "bg-cyan-50 text-cyan-800" : "text-ink-800"
                }`}
              >
                {link.label}
                <ChevronRight size={17} className="text-ink-400" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-1 border-t border-slate-100 px-1 pb-1 pt-3">
          {user ? (
            <div className="space-y-2">
              <p className="px-2 text-xs text-ink-500">
                Signed in as <span className="font-semibold text-ink-800">{user.name}</span>
              </p>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Link
                  href="/dashboard"
                  onClick={closeMobile}
                  className="focus-ring gradient-btn flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold brand-contrast"
                >
                  <LayoutDashboard size={16} aria-hidden="true" />
                  Go to dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    closeMobile();
                    logout();
                  }}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <LogOut size={15} aria-hidden="true" />
                  Log out
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link href="/login" onClick={closeMobile} className="focus-ring btn-secondary w-full py-3 text-sm">
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={closeMobile}
                className="gradient-btn focus-ring flex w-full items-center justify-center rounded-xl px-3 py-3 text-sm font-semibold brand-contrast"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      </div>

      <LogoutErrorToast message={logoutError} />
    </header>
  );
}
