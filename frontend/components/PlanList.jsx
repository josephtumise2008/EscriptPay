"use client";

import { useEffect, useState } from "react";
import { getPlans } from "@/lib/api";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import { formatNaira } from "@/lib/format";
import { CalendarDays, WifiOff, RefreshCw, Check } from "lucide-react";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "share", label: "Share" },
  { id: "regular", label: "Regular" },
];

// Derive filter categories from the plan's own data (name + validity).
const categorize = (name = "", validity = "") => {
  const n = name.toLowerCase();
  const v = validity.toLowerCase();
  const tags = new Set();

  if (/(1|2|3)\s*day/i.test(n) || /^\s*(1|2|3|6)\s*day/i.test(v)) tags.add("daily");
  if (/weekly/i.test(n) || /week/i.test(v) || /(7)\s*days?/i.test(v)) tags.add("weekly");
  if (/monthly/i.test(n) || /month/i.test(v) || /(24\s*-\s*30|30)\s*days?/i.test(v))
    tags.add("monthly");
  if (/share/i.test(n)) tags.add("share");
  if (!/share/i.test(n)) tags.add("regular");

  return tags;
};

const matches = (plan, filter, tags) => {
  if (filter === "all") return true;
  return tags.has(filter);
};

export default function PlanList({ network, selectedPlan, onSelect }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getPlans();
      setPlans(data);
    } catch {
      setError("Unable to load plans.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const networkPlans = plans.filter(
    (p) => p.network?.toLowerCase() === network?.toLowerCase()
  );

  const filtered = networkPlans.filter((p) =>
    matches(p, filter, categorize(p.name, p.validity))
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter plans">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`focus-ring rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
              filter === f.id
                ? "gradient-btn brand-contrast shadow-sm"
                : "bg-white text-ink-600 ring-1 ring-slate-200 hover:ring-cyan-300 hover:text-cyan-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner label="Loading plans..." />}

      {!loading && error && !plans.length && (
        <EmptyState
          icon={<WifiOff size={24} />}
          title="Unable to load plans"
          description="Please check your connection and try again."
          action={
            <button
              type="button"
              onClick={load}
              className="focus-ring inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-cyan-700 ring-1 ring-cyan-200 hover:bg-cyan-50"
            >
              <RefreshCw size={15} />
              Retry
            </button>
          }
        />
      )}

      {!loading && !error && !networkPlans.length && (
        <EmptyState
          icon={<WifiOff size={24} />}
          title={`No plans yet for ${network}`}
          description="We are still adding bundles for this network."
        />
      )}

      {!loading && !error && networkPlans.length > 0 && !filtered.length && (
        <EmptyState
          icon={<WifiOff size={24} />}
          title="No plans in this category"
          description="Try another filter to see more bundles."
        />
      )}

      {!loading && filtered.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((plan) => {
            const active = selectedPlan?._id === plan._id;
            return (
              <li key={plan._id} className="animate-fade-up" style={{ animationDelay: "0ms" }}>
                <button
                  type="button"
                  onClick={() => onSelect(plan)}
                  aria-pressed={active}
                  className={`focus-ring relative h-full w-full rounded-2xl border p-4 text-left transition-all duration-200 ${
                    active
                      ? "border-cyan-400 bg-gradient-to-br from-cyan-50 via-sky-50 to-purple-lite-100 shadow-[0_10px_28px_-12px_rgb(6_182_212/0.4)]"
                      : "card border-slate-100 hover:border-cyan-200 hover:shadow-[var(--shadow-card)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-700 ring-1 ring-cyan-100">
                        {plan.network}
                      </span>
                      <p className="mt-2 font-display text-[15px] font-bold leading-snug text-ink-800">
                        {plan.name}
                      </p>
                    </div>
                    {active && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-purple-lite-500 brand-contrast">
                        <Check size={12} aria-hidden="true" />
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-end justify-between">
                    <p className="font-display text-lg font-extrabold tracking-tight gradient-text">
                      {formatNaira(plan.price)}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                      <CalendarDays size={13} className="text-cyan-500" />
                      {plan.validity}
                    </span>
                  </div>

                  <span
                    className={`mt-3 inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-200 ${
                      active
                        ? "bg-gradient-to-r from-cyan-500 to-purple-lite-500 brand-contrast"
                        : "bg-slate-50 text-ink-600 ring-1 ring-slate-200 hover:bg-cyan-50 hover:text-cyan-700 hover:ring-cyan-200"
                    }`}
                  >
                    {active ? "Selected" : "Select"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}