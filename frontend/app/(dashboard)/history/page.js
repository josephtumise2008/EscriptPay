"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  FilterX,
  ShoppingBag,
  Inbox,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import TransactionCard from "@/components/TransactionCard";
import EmptyState from "@/components/EmptyState";
import Select from "@/components/ui/Select";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getTransactions, getNetworks, errorMessage } from "@/lib/api";
import { formatDateTime, formatNaira } from "@/lib/format";
import { statusLabel, statusBadge } from "@/lib/transactions";

const STATUS_OPTIONS = ["all", "successful", "pending", "failed"];
const TYPE_OPTIONS = ["all", "data", "airtime"];
const PAGE_SIZES = [10, 25, 50];

const toDateInput = (ts) => {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

export default function HistoryPage() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [networks, setNetworks] = useState([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [network, setNetwork] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(toDateInput(Date.now()));
  }, []);

  useEffect(() => {
    getNetworks()
      .then(setNetworks)
      .catch(() => {});
  }, []);

  const fromDate = today
    ? dateFilter === "7d"
      ? toDateInput(new Date(today).getTime() - 7 * 86400000)
      : dateFilter === "30d"
        ? toDateInput(new Date(today).getTime() - 30 * 86400000)
        : ""
    : "";

  const load = useCallback(async () => {
    try {
      const params = {
        q: search.trim() || undefined,
        status: status === "all" ? undefined : status,
        type: type === "all" ? undefined : type,
        network: network === "all" ? undefined : network,
        from: fromDate || undefined,
        page,
        limit: pageSize,
      };
      const data = await getTransactions(params);
      setRows(data.transactions || []);
      setPagination(data.pagination || { page: 1, limit: pageSize, total: 0, pages: 1 });
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Unable to load transactions."));
    } finally {
      setLoading(false);
    }
  }, [search, status, type, network, fromDate, page, pageSize]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const resetPage = () => setPage(1);
  useEffect(() => {
    resetPage();
  }, [status, type, network, dateFilter, pageSize]);

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setType("all");
    setNetwork("all");
    setDateFilter("all");
    setPage(1);
  };

  const noFilters =
    !search.trim() && status === "all" && type === "all" && network === "all" && dateFilter === "all";

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (status !== "all" ? 1 : 0) +
    (type !== "all" ? 1 : 0) +
    (network !== "all" ? 1 : 0) +
    (dateFilter !== "all" ? 1 : 0);

  const exportCSV = () => {
    const header = [
      "Transaction ID", "Type", "Network", "Plan", "Phone", "Amount (NGN)",
      "Status", "Created At",
    ];
    const lines = [header.join(",")];
    for (const t of rows) {
      lines.push(
        [
          t.transactionId,
          t.type,
          `"${t.network}"`,
          `"${(t.plan || "").replace(/"/g, '""')}"`,
          t.phone,
          t.amount,
          t.status,
          new Date(t.createdAt).toISOString(),
        ].join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `escriptpay-transactions-${toDateInput(Date.now())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

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
        ) : (
          <button
            type="button"
            onClick={clearFilters}
            className="focus-ring inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-cyan-700 ring-1 ring-cyan-200 hover:bg-cyan-50"
          >
            <FilterX size={16} />
            Clear filters
          </button>
        )
      }
    />
  );

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              Transaction History
            </h1>
            <p className="mt-1.5 text-sm text-ink-500 sm:text-base">
              All your purchases in one place{pagination.total > 0 ? ` — ${pagination.total} total.` : "."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {rows.length > 0 && (
              <button
                type="button"
                onClick={exportCSV}
                className="focus-ring btn-secondary px-3.5 py-2"
              >
                <Download size={15} aria-hidden="true" />
                Export CSV
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="card p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400">
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
                className="input-base pl-11 text-base sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:flex lg:gap-3 [&>div]:lg:w-44">
              <div>
                <Select
                  id="tx-date"
                  label="Filter by date"
                  value={dateFilter}
                  onChange={setDateFilter}
                  options={[
                    { value: "all", label: "All dates" },
                    { value: "7d", label: "Last 7 days" },
                    { value: "30d", label: "Last 30 days" },
                  ]}
                />
              </div>
              <div>
                <Select
                  id="tx-type"
                  label="Filter by type"
                  value={type}
                  onChange={setType}
                  align="right"
                  options={TYPE_OPTIONS.map((t) => ({ value: t, label: t === "all" ? "All types" : t === "data" ? "Data" : "Airtime" }))}
                />
              </div>
              <div>
                <Select
                  id="tx-network"
                  label="Filter by network"
                  value={network}
                  onChange={setNetwork}
                  options={[{ value: "all", label: "All networks" }, ...networks.map((n) => ({ value: n.name, label: n.name }))]}
                />
              </div>
              <div>
                <Select
                  id="tx-status"
                  label="Filter by status"
                  value={status}
                  onChange={setStatus}
                  align="right"
                  options={STATUS_OPTIONS.map((st) => ({ value: st, label: st === "all" ? "All statuses" : statusLabel(st) }))}
                />
              </div>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <span>{activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}</span>
              <button
                type="button"
                onClick={clearFilters}
                className="focus-ring inline-flex items-center gap-1 rounded-md font-semibold text-cyan-600 hover:text-cyan-700"
              >
                <FilterX size={13} />
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="card p-6">
          <LoadingSpinner size={32} label="Loading transactions..." />
        </div>
      )}

      {!loading && error && (
        <div className="card p-6">
          <p className="flex items-center gap-2 text-sm font-medium text-red-600">
            <Inbox size={18} />
            {error}
          </p>
        </div>
      )}

      {!loading && !error && pagination.total === 0 && (
        <div>{emptyState}</div>
      )}

      {!loading && !error && pagination.total > 0 && rows.length === 0 && (
        <div>{emptyState}</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block">
            <table className="w-full border-separate border-spacing-y-2">
              <caption className="sr-only">Test transactions</caption>
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-ink-500">
                  <th scope="col" className="px-4 py-2">ID</th>
                  <th scope="col" className="px-4 py-2">Type</th>
                  <th scope="col" className="px-4 py-2">Network</th>
                  <th scope="col" className="px-4 py-2">Plan</th>
                  <th scope="col" className="px-4 py-2">Phone</th>
                  <th scope="col" className="px-4 py-2">Amount</th>
                  <th scope="col" className="px-4 py-2">Date</th>
                  <th scope="col" className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr
                    key={t._id}
                    className="card transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]"
                  >
                    <td className="rounded-l-2xl px-4 py-3.5">
                      <Link
                        href={`/history/${t._id}`}
                        className="focus-ring rounded font-mono text-xs text-cyan-600 hover:underline"
                      >
                        {t.transactionId}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-semibold capitalize text-ink-500">
                      {t.type}
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
            {rows.map((t) => (
              <TransactionCard key={t._id} transaction={t} />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <Select
                id="page-size"
                label="Results per page"
                size="sm"
                className="w-36"
                value={pageSize}
                onChange={(v) => setPageSize(Number(v))}
                options={PAGE_SIZES.map((n) => ({ value: n, label: `${n} per page` }))}
              />
              <span>
                Page {pagination.page} of {pagination.pages} ({pagination.total} result
                {pagination.total === 1 ? "" : "s"})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1 || loading}
                className="focus-ring inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink-600 transition-colors hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={15} />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={pagination.page >= pagination.pages || loading}
                className="focus-ring inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink-600 transition-colors hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}