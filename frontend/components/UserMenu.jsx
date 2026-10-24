"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, UserRound, Settings, LogOut, ChevronDown, Home, LayoutDashboard, Sun, Moon, Monitor, Wallet, Plus, BarChart3 } from "lucide-react";
import { BalanceAmount, HideBalanceButton } from "@/components/WalletBalance";
import { useAuth } from "@/lib/auth-context";
import { initials } from "@/lib/format";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useDismiss, handleMenuKeyDown } from "@/hooks/useDismiss";
import { useTheme, THEME_OPTIONS } from "@/components/ThemeProvider";

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor };

const rowClass =
  "focus-ring flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[15px] font-medium text-ink-800 outline-none hover:bg-slate-100 focus-visible:bg-slate-100 sm:text-sm";
const iconBox = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-ink-600";

function Avatar({ name, size = "h-9 w-9 text-xs" }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 via-sky-500 to-indigo-500 font-bold brand-contrast ${size}`}>
      {initials(name)}
    </span>
  );
}

export default function UserMenu({ mobile = false, onClose, onLogoutRequest }) {
  const { user } = useAuth();
  const { preference, setPreference } = useTheme();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);
  useDismiss({ open, onClose: close, containerRef, triggerRef });
  // Phones show this menu as a sheet over the page: keep the page still.
  useScrollLock(open, "(max-width: 639px)");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) menuRef.current?.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [open]);

  const requestLogout = () => {
    setOpen(false);
    onClose?.();
    onLogoutRequest?.();
  };

  if (!user) return null;

  const inDashboard = !["/", "/login", "/signup"].includes(pathname);
  const items = [
    inDashboard
      ? { href: "/", label: "Back to website", icon: Home }
      : { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/wallet", label: "Wallet", icon: Wallet },
    { href: "/profile", label: "Profile", icon: UserRound },
    { href: "/history", label: "Transactions", icon: History },
    { href: "/settings", label: "Settings", icon: Settings },
    ...(user.role === "admin" ? [{ href: "/admin", label: "Business (admin)", icon: BarChart3 }] : []),
  ];

  // Inline list used inside the public site's mobile menu.
  if (mobile) {
    return (
      <div className="space-y-0.5">
        {items.map((item) => (
          <Link key={item.href} href={item.href} onClick={onClose} className={rowClass}>
            <span className={iconBox}><item.icon size={17} aria-hidden="true" /></span>
            {item.label}
          </Link>
        ))}
        {onLogoutRequest && (
          <button
            type="button"
            onClick={requestLogout}
            className={`${rowClass} mt-1 border border-red-200/70 bg-red-50/60 font-semibold text-red-600 hover:bg-red-50`}
          >
            <span className={`${iconBox} logout-icon`}><LogOut size={17} aria-hidden="true" /></span>
            Log out
          </button>
        )}
      </div>
    );
  }

  const firstName = user.name?.split(" ")[0] || "Account";

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu"
        aria-label={`Account menu for ${user.name}`}
        className="focus-ring press flex items-center gap-2 rounded-full lg:h-10 lg:border lg:border-slate-200 lg:bg-white lg:py-1 lg:pl-1 lg:pr-2.5 lg:hover:bg-slate-50"
      >
        <Avatar name={user.name} size={`h-9 w-9 text-xs lg:h-8 lg:w-8 ${open ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-white lg:ring-0" : ""}`} />
        <span className="hidden max-w-[8rem] truncate text-sm font-semibold text-ink-800 lg:block">{firstName}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`hidden text-ink-400 transition-transform duration-200 lg:block ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Phones: dim the page behind the menu. */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-40 touch-none bg-slate-950/40 transition-opacity duration-200 sm:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        id="user-menu"
        ref={menuRef}
        role="menu"
        aria-label="Account"
        data-state={open ? "open" : "closed"}
        inert={!open}
        onKeyDown={(e) => handleMenuKeyDown(e, menuRef.current)}
        className="popover fixed inset-x-3 top-[calc(3.5rem+env(safe-area-inset-top)+0.5rem)] z-50 max-h-[calc(100dvh-4.75rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain rounded-2xl sm:max-h-none sm:overflow-visible border border-slate-200/80 bg-white p-2 shadow-[0_24px_60px_-20px_rgb(15_23_42/0.45)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72"
      >
        <div className="flex items-center gap-3 px-2.5 pb-3 pt-2">
          <Avatar name={user.name} size="h-11 w-11 text-sm" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-ink-900">{user.name}</p>
            <p className="truncate text-xs text-ink-500">{user.email}</p>
          </div>
        </div>

        {/* Wallet balance card */}
        <div className="relative mx-0.5 mb-2 overflow-hidden rounded-xl wallet-gradient p-3.5 brand-contrast">
          <span aria-hidden="true" className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-[#ffffff]/15 blur-sm" />
          <span aria-hidden="true" className="pointer-events-none absolute -bottom-10 right-10 h-20 w-20 rounded-full bg-[#ffffff]/10" />
          <div className="relative flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#ffffff]/80">
              <Wallet size={14} aria-hidden="true" />
              Wallet balance
            </span>
            <HideBalanceButton className="h-7 w-7 text-[#ffffff]/80 hover:bg-[#ffffff]/15 hover:text-[#ffffff]" size={15} />
          </div>
          <div className="relative mt-1 flex items-end justify-between gap-3">
            <BalanceAmount className="font-display text-2xl font-extrabold tracking-tight" skeletonClass="h-7 w-24 bg-[#ffffff]/30" />
            <Link
              href="/wallet?fund=1"
              role="menuitem"
              tabIndex={-1}
              onClick={close}
              className="focus-ring press inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-[#ffffff] px-3 text-xs font-bold text-[#6d28d9] shadow-sm hover:bg-[#f5f3ff]"
            >
              <Plus size={14} aria-hidden="true" />
              Fund
            </Link>
          </div>
        </div>

        <div className="h-px bg-slate-100" role="separator" />

        <div className="py-1.5">
          {items.map((item) => (
            <Link key={item.href} href={item.href} role="menuitem" tabIndex={-1} onClick={close} className={rowClass}>
              <span className={iconBox}><item.icon size={17} aria-hidden="true" /></span>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="h-px bg-slate-100" role="separator" />

        <div className="flex items-center justify-between gap-3 px-2.5 py-3">
          <span className="text-sm font-medium text-ink-700">Theme</span>
          <div role="radiogroup" aria-label="Theme" className="flex rounded-lg bg-slate-100 p-0.5">
            {THEME_OPTIONS.map((option) => {
              const Icon = THEME_ICONS[option];
              const selected = preference === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.charAt(0).toUpperCase() + option.slice(1)}
                  title={option.charAt(0).toUpperCase() + option.slice(1)}
                  onClick={() => setPreference(option)}
                  className={`focus-ring flex h-8 w-9 items-center justify-center rounded-md ${
                    selected ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"
                  }`}
                >
                  <Icon size={15} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>

        {onLogoutRequest && (
          <>
            <div className="h-px bg-slate-100" role="separator" />
            <div className="pt-1.5">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={requestLogout}
                className={`${rowClass} border border-red-200/70 bg-red-50/60 font-semibold text-red-600 hover:bg-red-50 focus-visible:bg-red-50`}
              >
                <span className={`${iconBox} logout-icon`}><LogOut size={17} aria-hidden="true" /></span>
                Log out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
