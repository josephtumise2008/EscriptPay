"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getPlans } from "@/lib/api";
import { readCache, writeCache } from "@/lib/cache";
import { formatNaira } from "@/lib/format";

// Today's prices, set like the price list a data vendor pins to their
// WhatsApp status: network tabs, then plan ……… price. Live from the real
// catalogue, never hard-coded.
const NETWORKS = [
  { name: "MTN", swatch: "#ffcc00" },
  { name: "Airtel", swatch: "#e40000" },
  { name: "Glo", swatch: "#1aa04a" },
  { name: "9mobile", swatch: "#8dc63f" },
];

const size = (name) => String(name || "").split(" - ")[0].trim();
const kind = (name) => {
  const m = /\(([^)]+)\)/.exec(String(name || ""));
  return m ? m[1] : "";
};

export default function PriceBoard({ rows = 6 }) {
  const [plans, setPlans] = useState(null);
  const [failed, setFailed] = useState(false);
  const [network, setNetwork] = useState("MTN");

  useEffect(() => {
    let active = true;
    const cached = readCache("plans", { persist: true, maxAgeMs: 7 * 864e5 });
    if (cached && cached.length) setPlans(cached);
    getPlans()
      .then((all) => {
        if (!active) return;
        setPlans(all || []);
        writeCache("plans", all || [], { persist: true });
      })
      .catch(() => active && !cached && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  const list = useMemo(
    () => (plans || []).filter((p) => p.network === network).sort((a, b) => a.price - b.price).slice(0, rows),
    [plans, network, rows]
  );

  return (
    <div className="price-board">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5 sm:px-6">
        <h2 className="font-display text-lg font-bold text-ink-900">Today&apos;s data prices</h2>
        <span className="text-xs text-ink-500">Updated live</span>
      </div>

      <div role="tablist" aria-label="Network" className="mx-5 mt-4 grid grid-cols-4 rounded-xl bg-slate-100 p-1 sm:mx-6">
        {NETWORKS.map((n) => {
          const on = n.name === network;
          return (
            <button
              key={n.name}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setNetwork(n.name)}
              className={`focus-ring flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-semibold transition-colors ${
                on ? "bg-white text-ink-900 shadow-[0_1px_2px_rgb(15_23_42/0.08)]" : "text-ink-500 hover:text-ink-800"
              }`}
            >
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: n.swatch }} />
              {n.name}
            </button>
          );
        })}
      </div>

      <div className="min-h-[19rem] px-5 pb-2 pt-3 sm:px-6">
        {failed ? (
          <p className="pt-16 text-center text-sm text-ink-500">Prices can&apos;t load right now. Check your connection and refresh.</p>
        ) : !plans ? (
          <ul aria-label="Loading prices">
            {Array.from({ length: rows }).map((_, i) => (
              <li key={i} className="my-3 h-6 animate-pulse rounded bg-slate-100" />
            ))}
          </ul>
        ) : list.length === 0 ? (
          <p className="pt-16 text-center text-sm text-ink-500">No {network} plans yet.</p>
        ) : (
          <ul key={network} className="price-rows">
            {list.map((p) => (
              <li key={p._id}>
                <Link href={`/buy-data?network=${encodeURIComponent(p.network)}&plan=${p._id}`} className="price-row focus-ring">
                  <span className="price-size">{size(p.name)}</span>
                  <span className="price-meta">
                    {p.validity}
                    {kind(p.name) ? `, ${kind(p.name)}` : ""}
                  </span>
                  <span aria-hidden="true" className="price-leader" />
                  <span className="price-amount">{formatNaira(p.price)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-dashed border-slate-200 px-5 py-4 sm:px-6">
        <p className="text-xs text-ink-500">Tap a plan to buy it. No fee from your wallet.</p>
        <Link href={`/buy-data?network=${encodeURIComponent(network)}`} className="focus-ring shrink-0 rounded-md text-sm font-semibold text-cyan-700 hover:text-cyan-800">
          All {network} plans
        </Link>
      </div>
    </div>
  );
}
