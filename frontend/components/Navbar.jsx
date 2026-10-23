"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, LayoutDashboard, ChevronRight } from "lucide-react";
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

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
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
      className={`sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-200 ${
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

      <div
        id="mobile-menu"
        data-state={mobileOpen ? "open" : "closed"}
        inert={!mobileOpen}
        className="popover fixed inset-x-0 bottom-0 top-16 z-40 flex flex-col overflow-y-auto bg-white lg:hidden"
        style={{ transformOrigin: "top center" }}
      >
        <ul className="flex-1 px-4 py-4">
          {NAV_LINKS.map((link) => (
            <li key={link.href} className="border-b border-slate-100 last:border-b-0">
              <Link
                href={link.href}
                onClick={(e) => onNavClick(e, link.href)}
                className="focus-ring flex items-center justify-between rounded-lg px-2 py-4 font-display text-lg font-semibold text-ink-900 hover:text-cyan-700"
              >
                {link.label}
                <ChevronRight size={18} className="text-ink-400" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>

        <div className="border-t border-slate-100 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          {user ? (
            <>
              <Link
                href="/dashboard"
                onClick={closeMobile}
                className="focus-ring gradient-btn mb-2 flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-[15px] font-semibold brand-contrast"
              >
                <LayoutDashboard size={17} aria-hidden="true" />
                Go to dashboard
              </Link>
              <UserMenu mobile onClose={closeMobile} onLogoutRequest={logout} />
            </>
          ) : (
            <div className="space-y-2.5">
              <Link
                href="/signup"
                onClick={closeMobile}
                className="gradient-btn focus-ring flex w-full items-center justify-center rounded-xl px-4 py-3.5 text-[15px] font-semibold brand-contrast"
              >
                Create free account
              </Link>
              <Link href="/login" onClick={closeMobile} className="focus-ring btn-secondary w-full py-3.5 text-[15px]">
                Log in
              </Link>
            </div>
          )}
        </div>
      </div>

      <LogoutErrorToast message={logoutError} />
    </header>
  );
}
