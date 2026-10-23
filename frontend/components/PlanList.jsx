"use client";

import { useEffect, useState } from "react";
import { getPlans } from "@/lib/api";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import { formatNaira } from "@/lib/format";
import { CalendarDays, WifiOff, RefreshCw, Check } from "lucide-react";

// Plan names come from the supplier, e.g. "1 GB - Weekly (SME)",
// "2.5GB - Weekend Plan - [Sat & Sun] (Awoof Data)". Split them into a short
// title (data size), a detail line and a type badge.
const TYPE_STYLES = {
  SME: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Direct: "bg-sky-50 text-sky-700 ring-sky-100",
  Night: "bg-indigo-50 text-indigo-700 ring-indigo-100",
};

export const describePlan = (plan = {}) => {
  const raw = String(plan.name || "");
  const typeMatch = raw.match(/\(([^)]*)\)\s*$/);
  const typeText = typeMatch ? typeMatch[1].toLowerCase() : "";
  const base = raw.replace(/\(([^)]*)\)\s*$/, "").trim();
  const i = base.indexOf(" - ");
  const title = (i >= 0 ? base.slice(0, i) : base).trim();
  const detail = plan.validity && plan.validity !== "See plan" ? plan.validity : i >= 0 ? base.slice(i + 3).replace(/[[\]]/g, "") : "";
  let type = null;
  if (/night/i.test(raw)) type = "Night";
  else if (typeText.includes("sme")) type = "SME";
  // Awoof bundles show no badge.
  else if (typeText.includes("direct")) type = "Direct";
  return { title, detail, type };
};

// Duration bucket from the plan's own text.
const durationOf = (plan) => {
  const text = `${plan.name} ${plan.validity}`.toLowerCase();
  if (/weekend/.test(text)) return "weekly";
  if (/daily/.test(text)) return "daily";
  if (/weekly/.test(text)) return "weekly";
  if (/monthly/.test(text)) return "monthly";
  const m = text.match(/(\d+)\s*days?/);
  if (m) {
    const days = Number(m[1]);
    if (days <= 3) return "daily";
    if (days <= 14) return "weekly";
    if (days <= 31) return "monthly";
    return "long";
  }
  return "monthly";
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "sme", label: "Cheapest (SME)", test: (p) => describePlan(p).type === "SME" },
  { id: "daily", label: "Daily", test: (p) => durationOf(p) === "daily" },
  { id: "weekly", label: "Weekly", test: (p) => durationOf(p) === "weekly" },
  { id: "monthly", label: "Monthly", test: (p) => durationOf(p) === "monthly" },
  { id: "long", label: "2+ months", test: (p) => durationOf(p) === "long" },
];

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

  const networkPlans = plans
    .filter((p) => p.network?.toLowerCase() === network?.toLowerCase())
    .sort((a, b) => a.price - b.price);

  // Only show filters that have plans for this network.
  const filters = FILTERS.filter((f) => !f.test || networkPlans.some(f.test));
  const active = filters.find((f) => f.id === filter) || filters[0];
  const filtered = active && active.test ? networkPlans.filter(active.test) : networkPlans;

  return (
    <div>
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter plans">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={active?.id === f.id}
            className={`focus-ring shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${
              active?.id === f.id
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
            const isSelected = selectedPlan?._id === plan._id;
            const info = describePlan(plan);
            return (
              <li key={plan._id}>
                <button
                  type="button"
                  onClick={() => onSelect(plan)}
                  aria-pressed={isSelected}
                  aria-label={`${plan.network} ${info.title}, ${info.detail}, ${formatNaira(plan.price)}`}
                  className={`focus-ring press relative flex h-full w-full flex-col rounded-2xl border bg-white p-3 text-left sm:p-4 ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-50 shadow-[0_0_0_1px_var(--color-cyan-400)]"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-[var(--shadow-card)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {info.type ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${TYPE_STYLES[info.type]}`}>
                        {info.type}
                      </span>
                    ) : (
                      <span />
                    )}
                    {isSelected && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500 brand-contrast">
                        <Check size={12} aria-hidden="true" />
                      </span>
                    )}
                  </div>

                  <p className="mt-2 font-display text-[17px] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-lg">
                    {info.title}
                  </p>
                  {info.detail && (
                    <p className="mt-1 flex items-start gap-1 text-xs leading-snug text-ink-500">
                      <CalendarDays size={13} className="mt-px shrink-0 text-cyan-500" aria-hidden="true" />
                      <span className="line-clamp-2">{info.detail}</span>
                    </p>
                  )}

                  <p className="mt-auto pt-3 font-display text-base font-extrabold tracking-tight text-cyan-700 sm:text-lg">
                    {formatNaira(plan.price)}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}