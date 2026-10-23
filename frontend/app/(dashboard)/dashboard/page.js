"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import SummaryCard from "@/components/SummaryCard";
import QuickActions from "@/components/QuickActions";
import TransactionChart from "@/components/TransactionChart";
import TransactionCard from "@/components/TransactionCard";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/lib/auth-context";
import { getTransactions, errorMessage } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { computeStats, buildRangeSeries } from "@/lib/transactions";

const RANGES = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("7d");

  const firstName = (user?.name || "").split(" ")[0] || "there";
  const [lagos, setLagos] = useState(null);

  useEffect(() => {
    try {
      const time = new Intl.DateTimeFormat("en-GB", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Africa/Lagos",
      }).format(new Date());

      const hour = Number(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          hour12: false,
          timeZone: "Africa/Lagos",
        }).format(new Date())
      );

      const period =
        hour < 12
          ? "Good morning"
          : hour < 17
            ? "Good afternoon"
            : "Good evening";

      setLagos({ time, period });
    } catch {
      setLagos(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { transactions: rows } = await getTransactions();
        if (active) setTransactions(rows);
      } catch (err) {
        if (active) setError(errorMessage(err, "Unable to load your transactions."));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => computeStats(transactions), [transactions]);
  const chartSeries = useMemo(() => buildRangeSeries(transactions, range), [transactions, range]);
  const recent = transactions.slice(0, 5);

  return (
    <div className="space-y-6 sm:space-y-8">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              Welcome back,{" "}
              <span className="gradient-text">{firstName}</span>
            </h1>
            <p className="mt-1.5 text-sm text-ink-500 sm:text-base">
              {lagos
                ? `${lagos.period} — it's ${lagos.time} WAT in ${user?.state || "Lagos"}.`
                : "Manage your EscriptPay account and test transactions."}
            </p>
          </div>
        </div>
      </header>

      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="sr-only">
          Quick actions
        </h2>
        <QuickActions />
      </section>

      <section aria-label="Account summary">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <SummaryCard
            icon="total"
            title="Total Transactions"
            value={stats.total}
            sub={loading ? "Loading…" : "All purchases"}
            index={1}
          />
          <SummaryCard
            icon="purchased"
            title="Data Purchased"
            value={stats.dataPurchased}
            sub={loading ? "Loading…" : "Successful data orders"}
            index={2}
          />
          <SummaryCard
            icon="airtime"
            title="Airtime Purchased"
            value={stats.airtimePurchased}
            sub={loading ? "Loading…" : "Successful airtime orders"}
            index={3}
          />
          <SummaryCard
            icon="successful"
            title="Successful Transactions"
            value={`${stats.successful}/${stats.total}`}
            sub={loading ? "Loading…" : "Completed in test mode"}
            index={4}
          />
        </div>
      </section>


      <section aria-labelledby="weekly-heading" className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="weekly-heading" className="font-display text-lg font-bold text-ink-800">
              Spending Chart
            </h2>
            <div className="flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Chart range">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRange(r.value)}
                  aria-pressed={range === r.value}
                  className={`focus-ring rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    range === r.value
                      ? "bg-white text-cyan-700 shadow-sm"
                      : "text-ink-500 hover:text-ink-700"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <TransactionChart data={chartSeries} loading={loading} period={range} />
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 id="recent-heading" className="font-display text-lg font-bold text-ink-800">
              Recent Transactions
            </h2>
            <Link
              href="/history"
              className="focus-ring inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-cyan-600 transition-colors hover:text-cyan-700"
            >
              View All →
            </Link>
          </div>

          {loading ? (
            <LoadingSpinner size={32} label="Loading transactions..." />
          ) : error ? (
            <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </p>
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag size={24} />}
              title="No transactions yet"
              description="Your completed purchases will appear here."
              action={
                <Link
                  href="/buy-data"
                  className="gradient-btn focus-ring inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold brand-contrast"
                >
                  <ShoppingBag size={16} />
                  Buy Data
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {recent.map((t) => (
                <TransactionCard key={t._id} transaction={t} />
              ))}
            </div>
          )}
        </div>
      </section>

      <p className="text-xs text-ink-400">
        {stats.weekly > 0
          ? `You completed ${stats.weekly} test ${stats.weekly === 1 ? "purchase" : "purchases"} this week (${formatNaira(stats.weeklyAmount)}).`
          : "No successful test purchases this week yet."}
      </p>
    </div>
  );
}