"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Wifi,
  Phone,
  History,
  UserRound,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
} from "lucide-react";
import Logo from "@/components/Logo";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import BackgroundGradient from "@/components/BackgroundGradient";
import LoadingSpinner from "@/components/LoadingSpinner";
import TestModeBadge from "@/components/TestModeBadge";
import { useAuth } from "@/lib/auth-context";
import { initials } from "@/lib/format";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/buy-data", label: "Buy Data", icon: Wifi },
  { href: "/buy-airtime", label: "Buy Airtime", icon: Phone },
  { href: "/history", label: "Transactions", icon: History },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function DashboardShell({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <BackgroundGradient />
        <LoadingSpinner label="Loading your dashboard..." />
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="flex min-h-screen">
      <BackgroundGradient />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/70 bg-white/80 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center border-b border-slate-100 px-5">
          <Logo size={30} />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Dashboard">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === pathname ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return item.soon ? (
              <div
                key={item.href}
                className="group relative flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-400"
                title="Coming soon"
              >
                <item.icon size={19} className="transition-colors" />
                {item.label}
                <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-400">
                  Soon
                </span>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`focus-ring group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-cyan-50 to-purple-lite-100 text-cyan-800 shadow-[inset_0_0_0_1px_rgb(6_182_212/0.15)]"
                    : "text-ink-600 hover:bg-slate-50 hover:text-cyan-700"
                }`}
              >
                <item.icon
                  size={19}
                  className={`transition-colors ${active ? "text-purple-lite-500" : "text-ink-400 group-hover:text-cyan-500"}`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl bg-gradient-to-r from-cyan-50 to-purple-lite-100 px-3 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-purple-lite-500 text-xs font-bold brand-contrast">
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-800">
                {user.name}
              </p>
              <p className="truncate text-xs text-ink-500">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={19} className="text-ink-400" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white transition-transform duration-300 ease-out lg:hidden ${
          drawerOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <Logo size={30} />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="focus-ring rounded-lg p-1.5 text-ink-500"
              aria-label="Close menu"
            >
              <X size={22} />
            </button>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Dashboard">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === pathname ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return item.soon ? (
              <div
                key={item.href}
                className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-400"
                title="Coming soon"
              >
                <item.icon size={19} />
                {item.label}
                <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-ink-400">
                  Soon
                </span>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-cyan-50 to-purple-lite-100 text-cyan-800"
                    : "text-ink-600 hover:bg-slate-50 hover:text-cyan-700"
                }`}
              >
                <item.icon size={19} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={19} />
            Logout
          </button>
        </div>
      </div>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/70 bg-white/75 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="focus-ring rounded-lg p-1.5 text-ink-600 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu size={24} />
            </button>
            <div className="lg:hidden">
              <Logo size={28} />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <TestModeBadge className="hidden sm:inline-flex" />
            <button
              type="button"
              className="focus-ring relative rounded-lg p-1.5 text-ink-500 transition-colors hover:text-cyan-600"
              aria-label="Notifications"
            >
              <Bell size={20} />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gradient-to-r from-cyan-500 to-purple-lite-500" />
            </button>
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}