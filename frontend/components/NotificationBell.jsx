"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Inbox, CheckCircle2, Clock, XCircle, RefreshCw, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getTransactions } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { listFromTransactions, getReadIds, markRead, markAllRead } from "@/lib/notifications";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useDismiss } from "@/hooks/useDismiss";

const KIND_META = {
  successful: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600" },
  pending: { icon: Clock, cls: "bg-amber-50 text-amber-600" },
  failed: { icon: XCircle, cls: "bg-red-50 text-red-500" },
};

// Purchase updates derived from the user's real transactions (see
// lib/notifications). Read state is kept per user in this browser.
export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [readIds, setReadIds] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const containerRef = useRef(null);
  const triggerRef = useRef(null);

  const userId = user?.id || "";

  const load = useCallback(async () => {
    if (!userId) return;
    setStatus((s) => (s === "ready" ? "ready" : "loading"));
    try {
      const { transactions } = await getTransactions();
      setItems(listFromTransactions(transactions));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setReadIds(getReadIds(userId));
  }, [userId, items]);

  const close = useCallback(() => setOpen(false), []);
  useDismiss({ open, onClose: close, containerRef, triggerRef });
  // Phones show this menu as a sheet over the page: keep the page still.
  useScrollLock(open, "(max-width: 639px)");

  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unread = useMemo(() => items.filter((i) => !readSet.has(i.id)).length, [items, readSet]);

  const toggle = () => {
    setOpen((v) => {
      if (!v) load();
      return !v;
    });
  };

  const openItem = (item) => {
    if (userId) markRead(userId, item.id);
    setReadIds(getReadIds(userId));
    setOpen(false);
    router.push(`/history/${item.id}`);
  };

  const markAll = () => {
    if (userId) markAllRead(userId, items.map((i) => i.id));
    setReadIds(getReadIds(userId));
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notifications-panel"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="focus-ring icon-btn"
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-bold leading-none brand-contrast ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Phones: dim the page behind the panel; tapping it closes the panel. */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-40 touch-none bg-slate-950/40 transition-opacity duration-200 sm:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        id="notifications-panel"
        role="dialog"
        aria-label="Notifications"
        data-state={open ? "open" : "closed"}
        inert={!open}
        className="popover fixed inset-x-3 top-[calc(3.5rem+env(safe-area-inset-top)+0.5rem)] z-50 flex max-h-[calc(100dvh-4.75rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-2xl sm:block sm:max-h-none border border-slate-200/80 bg-white shadow-[0_24px_60px_-24px_rgb(15_23_42/0.35)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="font-display text-sm font-bold text-ink-900">Notifications</p>
            <p className="text-xs text-ink-500">{unread > 0 ? `${unread} unread` : "Purchase updates"}</p>
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAll}
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
            >
              <CheckCheck size={14} aria-hidden="true" />
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain">
          {status === "loading" && (
            <ul aria-label="Loading notifications" className="space-y-1 p-2">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex animate-pulse gap-3 rounded-xl px-2 py-3">
                  <span className="h-8 w-8 shrink-0 rounded-full bg-slate-100" />
                  <span className="flex-1 space-y-2">
                    <span className="block h-3 w-2/3 rounded bg-slate-100" />
                    <span className="block h-3 w-1/2 rounded bg-slate-100" />
                  </span>
                </li>
              ))}
            </ul>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <p className="text-sm font-semibold text-ink-700">Couldn't load notifications</p>
              <button type="button" onClick={load} className="focus-ring btn-secondary px-3 py-1.5 text-xs">
                <RefreshCw size={13} aria-hidden="true" />
                Try again
              </button>
            </div>
          )}

          {status === "ready" && items.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-ink-400">
                <Inbox size={20} aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold text-ink-700">No notifications yet</p>
              <p className="text-xs text-ink-500">Updates about your purchases will appear here.</p>
            </div>
          )}

          {status === "ready" && items.length > 0 && (
            <ul className="p-1.5">
              {items.map((item) => {
                const isRead = readSet.has(item.id);
                const meta = KIND_META[item.kind] || KIND_META.pending;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={`focus-ring flex w-full items-start gap-3 rounded-xl px-2.5 py-3 text-left hover:bg-slate-50 ${
                        isRead ? "" : "bg-cyan-50/50"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.cls}`}>
                        <meta.icon size={16} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={`text-sm ${isRead ? "font-medium text-ink-700" : "font-semibold text-ink-900"}`}>
                            {item.title}
                          </span>
                          {!isRead && <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" aria-label="Unread" />}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ink-500">{item.message}</span>
                        <span className="mt-1 block text-[11px] text-ink-400">{formatDateTime(item.time)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-100 p-1.5">
          <Link
            href="/history"
            onClick={close}
            className="focus-ring flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-700 hover:bg-slate-50"
          >
            View all transactions
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
