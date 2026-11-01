"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  ShoppingBag,
  Truck,
  CreditCard,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  XCircle,
  Mail,
  RefreshCw,
  Server,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/lib/auth-context";
import { getAdminOverview, resolveAdminTransaction, updateAdminMessage, errorMessage } from "@/lib/api";
import { formatNaira, formatDateTime } from "@/lib/format";

const RANGES = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const LOW_SUPPLIER_BALANCE = 5000;

function Kpi({ icon: Icon, label, value, sub, highlight = false }) {
  return (
    <div className={`rounded-2xl p-4 sm:p-5 ${highlight ? "wallet-gradient brand-contrast shadow-[0_24px_50px_-28px_rgb(91_79_240/0.9)]" : "card"}`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold uppercase tracking-wider ${highlight ? "text-[#ffffff]/80" : "text-ink-500"}`}>{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${highlight ? "bg-[#ffffff]/20" : "bg-slate-100 text-ink-600"}`}>
          <Icon size={16} aria-hidden="true" />
        </span>
      </div>
      <p className={`mt-2 font-display text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl ${highlight ? "" : "text-ink-900"}`}>{value}</p>
      {sub && <p className={`mt-1 text-xs ${highlight ? "text-[#ffffff]/75" : "text-ink-500"}`}>{sub}</p>}
    </div>
  );
}

function ProfitBars({ series }) {
  const max = Math.max(1, ...series.map((d) => Math.abs(d.profit)));
  const short = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
  return (
    <div className="card p-4 sm:p-5">
      <h2 className="font-display text-base font-bold text-ink-900">Profit per day</h2>
      <div className="mt-4 flex h-40 items-end gap-1" role="img" aria-label="Daily profit chart">
        {series.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end">
            <div
              className={`w-full rounded-t-md ${d.profit >= 0 ? "wallet-gradient" : "bg-red-400"}`}
              style={{ height: `${Math.max(d.profit ? 4 : 1, (Math.abs(d.profit) / max) * 100)}%`, opacity: d.profit ? 1 : 0.25 }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-[11px] font-semibold text-white group-hover:block">
              {short(d.date)}: {formatNaira(d.profit)} · {d.orders} orders
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink-400">
        <span>{series[0] && short(series[0].date)}</span>
        <span>{series.length > 1 && short(series[series.length - 1].date)}</span>
      </div>
    </div>
  );
}

const REFUND_LABEL = {
  requested: "refund sent automatically",
  failed: "automatic refund FAILED: refund in Paystack",
  not_supported: "refund in Paystack",
};

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getAdminOverview(days));
    } catch (err) {
      if (err?.response?.status === 403) router.replace("/dashboard");
      setError(errorMessage(err, "Could not load the overview."));
    } finally {
      setLoading(false);
    }
  }, [days, router]);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.replace("/dashboard");
      return;
    }
    load();
  }, [user, load, router]);

  const resolve = async (tx, action) => {
    const prompts = {
      refunded: "Only mark as refunded after you've refunded the customer (e.g. in your Paystack dashboard → Transactions → Refund). Continue?",
      delivered: "Mark as delivered? Only do this after confirming delivery with ClubKonnect.",
      dismissed: "Dismiss this order from the list?",
    };
    if (!window.confirm(prompts[action])) return;
    setBusyId(tx.id);
    try {
      await resolveAdminTransaction(tx.id, action);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not update the order."));
    } finally {
      setBusyId("");
    }
  };

  const markRead = async (m) => {
    setBusyId(m.id);
    try {
      await updateAdminMessage(m.id, "read");
      await load();
    } finally {
      setBusyId("");
    }
  };

  if (!user || user.role !== "admin") return null;

  const t = data?.totals;
  const supplierLow =
    data?.supplier?.balance !== null && data?.supplier?.balance !== undefined && (data.supplier.balance < LOW_SUPPLIER_BALANCE || data.supplier.balance < data.walletLiability);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">Business</h1>
          <p className="mt-1 text-sm text-ink-500">
            Sales and profit from delivered orders{data ? ` · ${data.mode === "live" ? "live" : "test"} mode` : ""}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setDays(r.days)}
                aria-pressed={days === r.days}
                className={`focus-ring rounded-lg px-3 py-1.5 text-xs font-bold ${days === r.days ? "bg-white text-cyan-700 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={load} aria-label="Refresh" className="focus-ring icon-btn text-ink-600">
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} aria-hidden="true" />
          </button>
        </div>
      </header>

      {error && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}

      {!data && loading ? (
        <LoadingSpinner label="Loading your business overview…" />
      ) : data ? (
        <>
          <section aria-label="Totals" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <div className="col-span-2 lg:col-span-1">
              <Kpi icon={TrendingUp} label="Profit" value={formatNaira(t.profit)} sub="After supplier cost and card fees" highlight />
            </div>
            <Kpi icon={ShoppingBag} label="Sales" value={formatNaira(t.sales)} sub={`${t.orders} delivered orders`} />
            <Kpi icon={Truck} label="Supplier cost" value={formatNaira(t.cost)} sub="Paid to ClubKonnect" />
            <Kpi icon={CreditCard} label="Card fees" value={formatNaira(t.fees)} sub="Paystack fees you paid" />
            <Kpi icon={ShoppingBag} label="Mix" value={`${t.data} / ${t.airtime}`} sub="Data / airtime orders" />
          </section>
          {t.unknownCost > 0 && (
            <p className="text-xs text-amber-700">
              {t.unknownCost} order(s) have no recorded cost yet (bought before costs were tracked), so they count as ₦0 profit.
            </p>
          )}

          <section aria-label="Money position" className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <div className={`card p-4 sm:p-5 ${supplierLow ? "border-red-200 bg-red-50/40" : ""}`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-700">
                <Server size={16} aria-hidden="true" />
                ClubKonnect balance
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold text-ink-900">
                {data.supplier.simulated ? "Simulated" : data.supplier.balance === null ? "—" : formatNaira(data.supplier.balance)}
              </p>
              {data.supplier.error && <p className="mt-1 text-xs text-red-600">{data.supplier.error}</p>}
              {supplierLow && (
                <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-red-600">
                  <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
                  Top up ClubKonnect — orders will fail if it runs out.
                </p>
              )}
              {data.supplier.simulated && <p className="mt-1 text-xs text-ink-500">Delivery is in test mode; ClubKonnect isn&apos;t used yet.</p>}
            </div>
            <div className="card p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-700">
                <Wallet size={16} aria-hidden="true" />
                Customer wallets (money you owe)
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold text-ink-900">{formatNaira(data.walletLiability)}</p>
              <p className="mt-1 text-xs text-ink-500">Prepaid by customers — keep at least this much in ClubKonnect. It isn&apos;t profit.</p>
            </div>
          </section>

          <ProfitBars series={data.series} />

          <section aria-labelledby="review-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="review-heading" className="font-display text-lg font-bold text-ink-800">
                Needs your attention <span className="text-ink-400">({data.needsReview.length})</span>
              </h2>
              <span className="text-xs text-ink-500">{data.counts.pending} pending · {data.counts.failed} failed in range</span>
            </div>
            {data.needsReview.length === 0 ? (
              <div className="card flex items-center gap-3 p-5 text-sm text-ink-600">
                <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
                Nothing needs attention. Failed wallet orders are refunded automatically.
              </div>
            ) : (
              <ul className="space-y-3">
                {data.needsReview.map((tx) => (
                  <li key={tx.id} className="card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-ink-500">{tx.transactionId}</p>
                        <p className="mt-0.5 font-semibold text-ink-900">
                          {tx.network} · {tx.type === "airtime" ? "Airtime" : tx.plan} · {formatNaira(tx.amount)}
                        </p>
                        <p className="text-xs text-ink-500">
                          {tx.phone} · {tx.customer ? `${tx.customer.name} <${tx.customer.email}>` : "unknown customer"} · {formatDateTime(tx.createdAt)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-amber-700">
                          Paid via {tx.paymentProvider} ({tx.paymentStatus}) · delivery {tx.providerStatus}
                          {tx.providerStatusCode ? ` (code ${tx.providerStatusCode})` : ""}
                          {tx.failureReason ? ` · ${tx.failureReason.replace(/_/g, " ")}` : ""}
                          {tx.cardCountry ? ` · card from ${tx.cardCountry}` : ""}
                          {tx.refundStatus ? ` · ${REFUND_LABEL[tx.refundStatus] || tx.refundStatus}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={busyId === tx.id} onClick={() => resolve(tx, "refunded")} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50 disabled:opacity-50">
                          <RotateCcw size={13} aria-hidden="true" /> Refunded
                        </button>
                        <button type="button" disabled={busyId === tx.id} onClick={() => resolve(tx, "delivered")} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                          <CheckCircle2 size={13} aria-hidden="true" /> Delivered
                        </button>
                        <button type="button" disabled={busyId === tx.id} onClick={() => resolve(tx, "dismissed")} className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-500 hover:bg-slate-100 disabled:opacity-50">
                          <XCircle size={13} aria-hidden="true" /> Dismiss
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.blockedFundings?.length > 0 && (
            <section aria-labelledby="blocked-heading">
              <h2 id="blocked-heading" className="mb-3 font-display text-lg font-bold text-ink-800">
                Blocked top-ups <span className="text-ink-400">({data.blockedFundings.length})</span>
              </h2>
              <p className="mb-3 text-xs text-ink-500">
                Paid but not added to the wallet (e.g. a foreign card). Blacklist the customer in Paystack, and refund there if the automatic refund failed.
              </p>
              <ul className="space-y-3">
                {data.blockedFundings.map((e) => (
                  <li key={e.id} className="card p-4">
                    <p className="font-mono text-xs text-ink-500">{e.reference}</p>
                    <p className="mt-0.5 font-semibold text-ink-900">Wallet top-up · {formatNaira(e.amount)}</p>
                    <p className="text-xs text-ink-500">
                      {e.customer ? `${e.customer.name} <${e.customer.email}>` : "unknown customer"} · {formatDateTime(e.createdAt)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-amber-700">
                      {e.failureReason ? e.failureReason.replace(/_/g, " ") : "flagged"}
                      {e.cardCountry ? ` · card from ${e.cardCountry}` : ""}
                      {e.refundStatus ? ` · ${REFUND_LABEL[e.refundStatus] || e.refundStatus}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="messages-heading">
            <h2 id="messages-heading" className="mb-3 font-display text-lg font-bold text-ink-800">
              New messages <span className="text-ink-400">({data.messages.length})</span>
            </h2>
            {data.messages.length === 0 ? (
              <div className="card p-5 text-sm text-ink-600">No new contact messages.</div>
            ) : (
              <ul className="space-y-3">
                {data.messages.map((m) => (
                  <li key={m.id} className="card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink-900">{m.name}</p>
                        <p className="text-xs text-ink-500">{m.email} · {formatDateTime(m.createdAt)}</p>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to EscriptPay")}`}
                          className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100"
                        >
                          <Mail size={13} aria-hidden="true" /> Reply
                        </a>
                        <button type="button" disabled={busyId === m.id} onClick={() => markRead(m)} className="focus-ring rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-500 hover:bg-slate-100 disabled:opacity-50">
                          Mark read
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{m.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
