"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, FilterX, ShoppingBag, Inbox } from "lucide-react";
import TransactionCard from "@/components/TransactionCard";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import TestModeBadge from "@/components/TestModeBadge";
import { getTransactions, errorMessage } from "@/lib/api";
import { formatDateTime, formatNaira } from "@/lib/format";
import { statusLabel, statusBadge } from "@/lib/transactions";

const STATUS_OPTIONS = ["all", "successful", "pending", "failed"];

export default function HistoryPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [cutoffTimestamp, setCutoffTimestamp] = useState(null);

  const handleDateFilter = (value) => {
    setDateFilter(value);
    setCutoffTimestamp(
      value === "all" ? null : Date.now() - (value === "7d" ? 7 : 30) * 86400000
    );
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { transactions: rows } = await getTransactions();
        if (active) setTransactions(rows);
      } catch (err) {
        if (active) setError(errorMessage(err, "Unable to load transactions."));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    let rows = transactions;

    if (status !== "all") rows = rows.filter((t) => t.status === status);

    if (cutoffTimestamp) {
      rows = rows.filter((t) => new Date(t.createdAt).getTime() >= cutoffTimestamp);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (t) =>
          t.network.toLowerCase().includes(q) ||
          t.plan.toLowerCase().includes(q) ||
          t.phone.includes(q) ||
          t.transactionId.toLowerCase().includes(q)
      );
    }

    return rows;
  }, [transactions, search, status, cutoffTimestamp]);

  const noFilters = !search.trim() && status === "all" && dateFilter === "all";

  const emptyState = (
    <EmptyState
      icon={<FilterX size={24} />}
      title={noFilters ? "No transactions yet" : "No matching transactions"}
      description={
        noFilters
          ? "Your completed test data and airtime purchases will appear here."
          : "Try adjusting your search or filters."
      }
      action={
        noFilters ? (
          <Link
            href="/buy-data"
            className="gradient-btn focus-ring inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold brand-contrast"
          >
            <ShoppingBag size={16} />
            Buy Data
          </Link>
        ) : null
      }
    />
  );

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              Transaction History
            </h1>
            <p className="mt-1.5 text-sm text-ink-500 sm:text-base">
              All your test purchases in one place.
            </p>
          </div>
          <TestModeBadge />
        </div>
      </header>

      <div className="card animate-fade-up p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
              <Search size={17} aria-hidden="true" />
            </span>
            <label htmlFor="tx-search" className="sr-only">
              Search transactions
            </label>
            <input
              id="tx-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by network, plan, phone or ID..."
              className="input-base pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <div>
              <label htmlFor="tx-date" className="sr-only">
                Filter by date
              </label>
              <select
                id="tx-date"
                value={dateFilter}
                onChange={(e) => handleDateFilter(e.target.value)}
                className="input-base w-auto cursor-pointer"
              >
                <option value="all">All dates</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>
            <div>
              <label htmlFor="tx-status" className="sr-only">
                Filter by status
              </label>
              <select
                id="tx-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input-base w-auto cursor-pointer"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "All statuses" : statusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="card animate-fade-up p-6">
          <LoadingSpinner size={32} label="Loading transactions..." />
        </div>
      )}

      {!loading && error && (
        <div className="card animate-fade-up p-6">
          <p className="flex items-center gap-2 text-sm font-medium text-red-600">
            <Inbox size={18} />
            {error}
          </p>
        </div>
      )}

      {!loading && !error && transactions.length === 0 && (
        <div className="animate-fade-up">{emptyState}</div>
      )}

      {!loading && !error && transactions.length > 0 && filtered.length === 0 && (
        <div className="animate-fade-up">{emptyState}</div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block">
            <table className="w-full border-separate border-spacing-y-2">
              <caption className="sr-only">Test transactions</caption>
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-ink-500">
                  <th scope="col" className="px-4 py-2">ID</th>
                  <th scope="col" className="px-4 py-2">Network</th>
                  <th scope="col" className="px-4 py-2">Plan</th>
                  <th scope="col" className="px-4 py-2">Phone</th>
                  <th scope="col" className="px-4 py-2">Amount</th>
                  <th scope="col" className="px-4 py-2">Date</th>
                  <th scope="col" className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t._id}
                    className="card animate-fade-up transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]"
                  >
                    <td className="rounded-l-2xl px-4 py-3.5 font-mono text-xs text-ink-500">
                      {t.transactionId}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-bold text-ink-800">{t.network}</td>
                    <td className="px-4 py-3.5 text-sm text-ink-600">{t.plan}</td>
                    <td className="px-4 py-3.5 text-sm text-ink-600">{t.phone}</td>
                    <td className="px-4 py-3.5 text-sm font-bold text-ink-800">
                      {formatNaira(t.amount)}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-ink-500">{formatDateTime(t.createdAt)}</td>
                    <td className="rounded-r-2xl px-4 py-3.5">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusBadge(t.status)}`}>
                        {statusLabel(t.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet cards */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((t) => (
              <TransactionCard key={t._id} transaction={t} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}