"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Wifi, Phone, History, UserRound, Settings, LogOut, Home, ChevronLeft } from "lucide-react";
import Logo from "@/components/Logo";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import BackgroundGradient from "@/components/BackgroundGradient";
import LoadingSpinner from "@/components/LoadingSpinner";
import NotificationBell from "@/components/NotificationBell";
import { useLogout, LogoutErrorToast } from "@/hooks/useLogout";
import { useAuth } from "@/lib/auth-context";
import { initials } from "@/lib/format";
import { recordVisit, labelFor, resetTrail } from "@/lib/navHistory";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/buy-data", label: "Buy Data", icon: Wifi },
  { href: "/buy-airtime", label: "Buy Airtime", icon: Phone },
  { href: "/history", label: "Transactions", icon: History },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Bottom tab bar on phones: the everyday destinations, one tap away.
const TAB_ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, match: ["/dashboard", "/success"] },
  { href: "/buy-data", label: "Data", icon: Wifi, match: ["/buy-data"] },
  { href: "/buy-airtime", label: "Airtime", icon: Phone, match: ["/buy-airtime"] },
  { href: "/history", label: "History", icon: History, match: ["/history"] },
  { href: "/profile", label: "Account", icon: UserRound, match: ["/profile", "/settings"] },
];

function MobileTabBar({ pathname }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {TAB_ITEMS.map((tab) => {
          const active = tab.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`focus-ring flex h-full flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-semibold ${
                  active ? "text-cyan-600" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200 ${
                    active ? "bg-cyan-50" : ""
                  }`}
                >
                  <tab.icon size={20} aria-hidden="true" />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Pages that get a "Back" control in the header. `fallback(search)` is used
// only when there is no in-app page to return to (opened from a link,
// bookmark or new tab).
const BACK_ROUTES = [
  { match: (p) => /^\/history\/.+/.test(p), fallback: () => "/history" },
  {
    match: (p) => p === "/success",
    fallback: (search) => {
      const from = new URLSearchParams(search).get("from");
      return from === "airtime" ? "/buy-airtime" : from === "data" ? "/buy-data" : "/dashboard";
    },
  },
  { match: (p) => p === "/settings", fallback: () => "/profile" },
];

function BackButton({ previous, fallbackUrl }) {
  const router = useRouter();
  const target = previous || fallbackUrl;
  // Navigate straight to the named page. (window.history.back() can drift
  // from what the label says — e.g. after re-opening the same page or a
  // query-only change adds browser entries the trail doesn't — and then
  // appears to "do nothing".) Arriving at the previous trail entry pops the
  // current page off the trail (see lib/navHistory.recordVisit).
  const goBack = () => router.push(target);
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={`Back to ${labelFor(target)}`}
      className="focus-ring press -ml-1.5 inline-flex h-10 items-center gap-0.5 rounded-xl pl-1 pr-3 text-sm font-semibold text-ink-700 hover:bg-slate-100"
    >
      <ChevronLeft size={20} aria-hidden="true" />
      <span className="sm:hidden">Back</span>
      <span className="hidden sm:inline">Back to {labelFor(target)}</span>
    </button>
  );
}

const isActive = (href, pathname) =>
  href === pathname || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

function NavList({ pathname, onNavigate }) {
  return (
    <ul className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`focus-ring group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                active ? "bg-cyan-50 text-cyan-800" : "text-ink-600 hover:bg-slate-100 hover:text-ink-900"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-2 left-0 w-[3px] rounded-full bg-cyan-500 transition-opacity duration-200 ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
              <item.icon
                size={19}
                aria-hidden="true"
                className={active ? "text-cyan-600" : "text-ink-400 group-hover:text-ink-600"}
              />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function DashboardShell({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { logout, busy: loggingOut, error: logoutError } = useLogout();

  // Signed-out visitors go to login — except while a deliberate logout is
  // navigating them to the homepage.
  useEffect(() => {
    if (!loading && !user && !loggingOut) router.replace("/login");
  }, [user, loading, loggingOut, router]);

  // Track the in-app trail so "Back" returns to the real previous page.
  // (Effects run in order: the reset happens once, before the first record.)
  useEffect(() => {
    resetTrail();
  }, []);
  const [previousUrl, setPreviousUrl] = useState(null);
  const [currentSearch, setCurrentSearch] = useState("");
  useEffect(() => {
    const url = window.location.pathname + window.location.search;
    setCurrentSearch(window.location.search);
    setPreviousUrl(recordVisit(url));
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <BackgroundGradient />
        <LoadingSpinner label="Loading your dashboard..." />
      </div>
    );
  }

  if (!user) return null;

  const back = BACK_ROUTES.find((r) => r.match(pathname));
  const openLogout = () => logout();

  return (
    <div className="flex min-h-screen">
      <BackgroundGradient />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/70 bg-white/85 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center border-b border-slate-100 px-5">
          <Link href="/dashboard" className="focus-ring rounded-lg" aria-label="EscriptPay dashboard">
            <Logo size={30} />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Dashboard">
          <NavList pathname={pathname} />
        </nav>

        <div className="space-y-1 border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 text-xs font-bold brand-contrast">
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-800">{user.name}</p>
              <p className="truncate text-xs text-ink-500">{user.email}</p>
            </div>
          </div>
          <Link
            href="/"
            className="focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-slate-100 hover:text-ink-900"
          >
            <Home size={19} className="text-ink-400" aria-hidden="true" />
            Back to website
          </Link>
          <button
            type="button"
            onClick={openLogout}
            disabled={loggingOut}
            className="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
          >
            <LogOut size={19} aria-hidden="true" />
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* No backdrop-filter on phones: it would become the containing block for
            the fixed-position menus and backdrops opened from this header. */}
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white pt-[env(safe-area-inset-top)] lg:bg-white/85 lg:backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:h-16 lg:px-8">
            <div className="flex min-w-0 items-center">
              {back ? (
                <BackButton previous={previousUrl} fallbackUrl={back.fallback(currentSearch)} />
              ) : (
                <Link href="/dashboard" className="focus-ring rounded-lg lg:hidden" aria-label="EscriptPay dashboard">
                  <Logo size={28} />
                </Link>
              )}
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5">
              <ThemeToggle className="hidden lg:inline-flex" />
              <NotificationBell />
              <span className="ml-1">
                <UserMenu onLogoutRequest={openLogout} />
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-8 lg:py-8">
          {/* Keyed by route: only the page content fades in on navigation —
              the sidebar and header stay put and never re-animate. */}
          <div key={pathname} className="mx-auto max-w-6xl animate-page-in">
            {children}
          </div>
        </main>
      </div>

      <MobileTabBar pathname={pathname} />

      <LogoutErrorToast message={logoutError} />
    </div>
  );
}
