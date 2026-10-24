"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBag, Plus, Wallet, ChevronRight } from "lucide-react";
import { HideBalanceButton, BalanceAmount } from "@/components/WalletBalance";
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
import InstallApp from "@/components/InstallApp";

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
      <h1 className="sr-only">Dashboard</h1>
      <section
        aria-label="Wallet"
        className="wallet-gradient relative overflow-hidden rounded-3xl p-5 brand-contrast shadow-[0_30px_60px_-34px_rgb(91_79_240/0.8)] sm:p-6"
      >
        <div aria-hidden="true" className="wallet-sheen pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full border border-[#ffffff]/15" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#ffffff]/80">
              {lagos ? `${lagos.period}, ${firstName}` : `Hello, ${firstName}`}
            </p>
            <p className="mt-0.5 text-xs text-[#ffffff]/65">
              {lagos ? `${lagos.time} WAT · ${user?.state || "Lagos"}` : "Your EscriptPay wallet"}
            </p>
          </div>
          <HideBalanceButton className="h-9 w-9 shrink-0 text-[#ffffff]/85 hover:bg-[#ffffff]/15 hover:text-[#ffffff]" size={18} />
        </div>

        <div className="relative mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#ffffff]/70">
              <Wallet size={14} aria-hidden="true" />
              Wallet balance
            </p>
            <div className="mt-1.5">
              <BalanceAmount
                className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl"
                skeletonClass="mt-1 h-9 w-36 bg-[#ffffff]/25"
              />
            </div>
          </div>
          <div className="flex w-full gap-2.5 sm:w-auto">
            <Link
              href="/wallet?fund=1"
              className="focus-ring press inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#ffffff] px-5 text-sm font-bold text-[#5b21b6] shadow-[0_10px_24px_-12px_rgb(15_23_42/0.6)] hover:bg-[#f5f3ff] sm:flex-none"
            >
              <Plus size={17} aria-hidden="true" />
              Fund wallet
            </Link>
            <Link
              href="/wallet"
              className="focus-ring press inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-[#ffffff]/15 px-4 text-sm font-semibold text-[#ffffff] hover:bg-[#ffffff]/25 sm:flex-none"
            >
              View wallet
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <InstallApp variant="banner" />

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