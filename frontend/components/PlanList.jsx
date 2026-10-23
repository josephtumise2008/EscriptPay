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
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter plans">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`focus-ring shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${
              filter === f.id
                ? "bg-ink-900 text-white dark:bg-cyan-500 dark:text-[#ffffff]"
                : "bg-white text-ink-600 ring-1 ring-slate-200 hover:text-ink-900 hover:ring-slate-300"
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
        <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-3">
          {filtered.map((plan) => {
            const active = selectedPlan?._id === plan._id;
            return (
              <li key={plan._id}>
                <button
                  type="button"
                  onClick={() => onSelect(plan)}
                  aria-pressed={active}
                  className={`focus-ring press relative flex h-full w-full flex-col rounded-2xl border bg-white p-3 text-left sm:p-4 ${
                    active
                      ? "border-cyan-400 bg-cyan-50 shadow-[0_0_0_1px_var(--color-cyan-400)]"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-[var(--shadow-card)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="hidden items-center gap-1.5 rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-700 ring-1 ring-cyan-100 sm:inline-flex">
                        {plan.network}
                      </span>
                      <p className="font-display text-sm font-bold leading-snug text-ink-800 sm:mt-2 sm:text-[15px]">
                        {plan.name}
                      </p>
                    </div>
                    {active && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500 brand-contrast">
                        <Check size={12} aria-hidden="true" />
                      </span>
                    )}
                  </div>

                  <div className="mt-auto flex flex-col gap-0.5 pt-3 sm:flex-row sm:items-end sm:justify-between">
                    <p className="font-display text-base font-extrabold tracking-tight text-ink-900 sm:text-lg">
                      {formatNaira(plan.price)}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                      <CalendarDays size={13} className="text-cyan-500" />
                      {plan.validity}
                    </span>
                  </div>

                  <span
                    aria-hidden="true"
                    className={`mt-3 hidden w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold sm:inline-flex ${
                      active ? "bg-cyan-500 brand-contrast" : "bg-slate-100 text-ink-600"
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