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

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {networks.map((n) => {
        const active = selected === n.name;
        const meta = NETWORK_META[n.name] || NETWORK_META.MTN;
        return (
          <button
            key={n.code}
            type="button"
            onClick={() => onSelect(n.name)}
            aria-pressed={active}
            className={`focus-ring group relative flex items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-300 ${active
                ? "border-cyan-300 bg-gradient-to-br from-cyan-50 to-purple-lite-100 shadow-[0_8px_24px_-12px_rgb(6_182_212/0.35)]"
                : "card border-slate-100 hover:border-cyan-200 hover:shadow-[var(--shadow-card)]"
              }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-100">
              <span className={`h-3.5 w-3.5 rounded-full ${meta.dot}`} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className={`block truncate font-display text-sm font-bold ${meta.color}`}>
                {n.name}
              </span>
              <span className="block text-xs text-ink-400">
                {active ? "Selected" : "Select"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}