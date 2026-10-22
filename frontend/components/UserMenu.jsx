"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  History,
  UserRound,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { initials } from "@/lib/format";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/history", label: "Transaction History", icon: History },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export default function UserMenu({ mobile = false, onClose, onLogoutRequest }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleLogout = () => {
    onLogoutRequest?.();
    setOpen(false);
    onClose?.();
  };

  if (!user) return null;

  if (mobile) {
    return (
      <div className="space-y-1">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className="focus-ring flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-cyan-50 hover:text-cyan-700"
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={handleLogout}
          className="focus-ring flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="focus-ring flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 transition-all duration-200 hover:border-cyan-300 hover:shadow-[var(--shadow-card)]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 via-sky-500 to-indigo-500 text-xs font-bold brand-contrast">
          {initials(user.name)}
        </span>
        <span className="hidden max-w-[9rem] truncate text-sm font-semibold text-ink-800 lg:block">
          {user.name?.split(" ")[0]}
        </span>
        <ChevronDown
          size={16}
          className={`text-ink-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-fade-down absolute right-0 mt-2 w-60 origin-top-right rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_20px_50px_-20px_rgb(15_23_42/0.25)]"
        >
          <div className="border-b border-slate-100 px-3 pb-2 pt-1.5">
            <p className="truncate text-sm font-bold text-ink-800">{user.name}</p>
            <p className="truncate text-xs text-ink-500">{user.email}</p>
          </div>
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-cyan-50 hover:text-cyan-700"
            >
              <item.icon size={17} className="text-ink-400" />
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={17} className="text-ink-400" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}