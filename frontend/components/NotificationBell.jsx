"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getTransactions } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import {
  listFromTransactions,
  getReadIds,
  markRead,
  markAllRead,
  unreadCount,
} from "@/lib/notifications";

const TONE = {
  successful: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  pending: "bg-amber-50 text-amber-600 ring-amber-100",
  failed: "bg-red-50 text-red-500 ring-red-100",
};

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [readIds, setReadIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);

  const userId = user?.id || "";

  // Local-first feed: derived from the transactions API (see lib/notifications).
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { transactions } = await getTransactions();
      setItems(listFromTransactions(transactions));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setReadIds(getReadIds(userId));
  }, [userId, items]);

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

  const unread = useMemo(() => unreadCount(userId, items), [userId, items]);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) load();
  };

  const handleClickItem = (item) => {
    if (userId) markRead(userId, item.id);
    setReadIds(getReadIds(userId));
    setOpen(false);
    router.push(`/history/${item.id}`);
  };

  const handleMarkAll = () => {
    if (userId) markAllRead(userId, items.map((i) => i.id));
    setReadIds(getReadIds(userId));
  };

  const readSet = useMemo(() => new Set(readIds), [readIds]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className="focus-ring relative rounded-lg p-1.5 text-ink-500 transition-colors hover:text-cyan-600"
      >
        <Bell size={20} />
        <span
          className={`absolute right-0.5 top-0.5 h-2 w-2 rounded-full ${
            unread > 0
              ? "bg-gradient-to-r from-cyan-500 to-purple-lite-500 ring-2 ring-white"
              : "bg-slate-300"
          }`}
        />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-purple-lite-500 px-1 text-[9px] font-bold brand-contrast ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="animate-fade-down absolute right-0 z-50 mt-2 w-[min(21rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_20px_50px_-20px_rgb(15_23_42/0.25)]"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-display text-sm font-bold text-ink-800">Notifications</p>
            {items.length > 0 && unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="focus-ring inline-flex items-center gap-1 rounded-md text-xs font-semibold text-cyan-600 transition-colors hover:text-cyan-700"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <p className="px-4 py-8 text-center text-sm text-ink-400">Loading notifications...</p>
            )}

            {!loading && items.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-ink-400">
                  <Inbox size={20} aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-ink-600">You're all caught up</p>
                <p className="text-xs text-ink-400">
                  Purchase updates for your test orders appear here.
                </p>
              </div>
            )}

            {!loading &&
              items.length > 0 &&
              items.map((item) => {
                const isRead = readSet.has(item.id);
                const tone = TONE[item.kind] || TONE.pending;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleClickItem(item)}
                    className={`focus-ring flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                      isRead ? "bg-white" : "bg-cyan-50/40"
                    } hover:bg-slate-50`}
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase ring-1 ${tone}`}
                    >
                      {item.kind.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink-800">{item.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-500">{item.message}</span>
                      <span className="mt-1 block font-mono text-[10px] text-ink-400">
                        {item.transactionId} · {formatDateTime(item.time)}
                      </span>
                    </span>
                    {!isRead && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-500" aria-label="Unread" />
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}