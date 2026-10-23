"use client";

import { useState, useEffect } from "react";
import { getNetworks } from "@/lib/api";
import { Wifi, RefreshCw } from "lucide-react";

const NETWORK_META = {
  MTN: { color: "text-yellow-600", ring: "ring-yellow-200", bg: "bg-yellow-50", dot: "bg-yellow-500" },
  Airtel: { color: "text-red-500", ring: "ring-red-200", bg: "bg-red-50", dot: "bg-red-500" },
  Glo: { color: "text-emerald-600", ring: "ring-emerald-200", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  "9mobile": { color: "text-lime-600", ring: "ring-lime-200", bg: "bg-lime-50", dot: "bg-lime-500" },
};

export default function NetworkSelector({ selected, onSelect }) {
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getNetworks();
      setNetworks(data);
    } catch {
      setError("Unable to load networks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-400">
        <Wifi size={16} className="animate-pulse-soft" />
        Loading networks...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/50 px-4 py-8 text-center">
        <p className="text-sm font-medium text-ink-600">{error}</p>
        <button
          type="button"
          onClick={load}
          className="focus-ring inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-cyan-700 shadow-sm ring-1 ring-cyan-200 hover:bg-cyan-50"
        >
          <RefreshCw size={15} />
          Retry
        </button>
      </div>
    );
  }

  const choose = (name) => onSelect(name);

  // Radio-group keyboard support: arrow keys move the selection.
  const onKeyDown = (e) => {
    const names = networks.map((n) => n.name);
    const i = names.indexOf(selected);
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = names[(i + 1) % names.length];
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = names[(i - 1 + names.length) % names.length];
    if (next) {
      e.preventDefault();
      choose(next);
      document.getElementById(`network-${next}`)?.focus();
    }
  };

  return (
    <div role="radiogroup" aria-label="Network" onKeyDown={onKeyDown} className="grid grid-cols-4 gap-2 sm:gap-3">
      {networks.map((n) => {
        const active = selected === n.name;
        const meta = NETWORK_META[n.name] || NETWORK_META.MTN;
        return (
          <button
            key={n.code}
            id={`network-${n.name}`}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (!selected && n === networks[0]) ? 0 : -1}
            onClick={() => choose(n.name)}
            className={`focus-ring press relative flex min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-2xl border bg-white px-1 py-3 text-center sm:flex-row sm:justify-start sm:gap-3 sm:p-4 sm:text-left ${
              active
                ? "border-cyan-400 bg-cyan-50 shadow-[0_0_0_1px_var(--color-cyan-400)]"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${meta.bg}`}>
              <span className={`h-3.5 w-3.5 rounded-full ${meta.dot}`} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[13px] font-bold text-ink-900 sm:text-sm">{n.name}</span>
              <span className={`hidden text-xs sm:block ${active ? "font-medium text-cyan-700" : "text-ink-500"}`}>
                {active ? "Selected" : "Tap to select"}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full transition-opacity duration-150 ${
                active ? "bg-cyan-500 opacity-100" : "opacity-0"
              }`}
            >
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 brand-contrast" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2.5 6.2 5 8.5l4.5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        );
      })}
    </div>
  );
}
