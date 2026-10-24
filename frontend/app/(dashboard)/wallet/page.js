"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Wallet,
  Plus,
  Wifi,
  Phone,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { HideBalanceButton, MASKED } from "@/components/WalletBalance";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useWallet } from "@/lib/wallet-context";
import { getWallet, fundWallet, getFundingQuote, errorMessage } from "@/lib/api";
import { isTrustedCheckoutUrl } from "@/lib/checkout";
import { formatNaira, formatDateTime } from "@/lib/format";

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

const makeReference = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? `fund-${crypto.randomUUID()}`
    : `fund-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const ENTRY_STYLE = {
  funding: { icon: ArrowDownLeft, label: "Wallet top-up", tone: "bg-emerald-50 text-emerald-600" },
  refund: { icon: RotateCcw, label: "Refund", tone: "bg-sky-50 text-sky-600" },
  purchase: { icon: ArrowUpRight, label: "Purchase", tone: "bg-slate-100 text-ink-600" },
};

const STATUS_CHIP = {
  pending: { label: "Awaiting payment", className: "bg-amber-50 text-amber-700" },
  crediting: { label: "Processing", className: "bg-amber-50 text-amber-700" },
  failed: { label: "Failed", className: "bg-red-50 text-red-600" },
};

function WalletHero({ balance, hidden, onFund }) {
  return (
    <section
      aria-label="Wallet balance"
      className="wallet-gradient relative overflow-hidden rounded-3xl p-5 brand-contrast shadow-[0_30px_60px_-30px_rgb(91_79_240/0.75)] sm:p-7"
    >
      <div aria-hidden="true" className="wallet-sheen pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-[#ffffff]/15" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-4 -top-8 h-32 w-32 rounded-full border border-[#ffffff]/10" />

      <div className="relative flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#ffffff]/15 px-3 py-1 text-xs font-semibold text-[#ffffff]/90">
          <Wallet size={14} aria-hidden="true" />
          EscriptPay Wallet
        </span>
        <HideBalanceButton className="h-9 w-9 text-[#ffffff]/85 hover:bg-[#ffffff]/15 hover:text-[#ffffff]" size={18} />
      </div>

      <p className="relative mt-6 text-sm font-medium text-[#ffffff]/75">Available balance</p>
      <p className="relative mt-1 font-display text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">
        {balance === null ? (
          <span className="inline-block h-10 w-40 animate-pulse rounded-xl bg-[#ffffff]/25 align-middle" aria-label="Loading balance" />
        ) : hidden ? (
          MASKED
        ) : (
          formatNaira(balance)
        )}
      </p>

      <div className="relative mt-6 grid grid-cols-3 gap-2.5 sm:flex sm:flex-wrap sm:gap-3">
        <button
          type="button"
          onClick={onFund}
          className="focus-ring press col-span-3 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#ffffff] px-6 text-sm font-bold text-[#5b21b6] shadow-[0_10px_24px_-12px_rgb(15_23_42/0.6)] hover:bg-[#f5f3ff] sm:col-span-1"
        >
          <Plus size={18} aria-hidden="true" />
          Fund wallet
        </button>
        <Link
          href="/buy-data"
          className="focus-ring press col-span-1 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#ffffff]/15 px-4 text-sm font-semibold text-[#ffffff] hover:bg-[#ffffff]/25 sm:px-5"
        >
          <Wifi size={17} aria-hidden="true" />
          Data
        </Link>
        <Link
          href="/buy-airtime"
          className="focus-ring press col-span-1 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#ffffff]/15 px-4 text-sm font-semibold text-[#ffffff] hover:bg-[#ffffff]/25 sm:px-5"
        >
          <Phone size={17} aria-hidden="true" />
          Airtime
        </Link>
        <Link
          href="/history"
          className="focus-ring press col-span-1 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#ffffff]/15 px-4 text-sm font-semibold text-[#ffffff] hover:bg-[#ffffff]/25 sm:px-5"
        >
          <Clock size={17} aria-hidden="true" />
          History
        </Link>
      </div>
    </section>
  );
}

function FundPanel({ limits, mode, onClose, onFunded }) {
  const router = useRouter();
  const [amount, setAmount] = useState(5000);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const clientRef = useRef(null);
  const panelRef = useRef(null);

  const min = limits?.minFunding ?? 100;
  const max = limits?.maxFunding ?? 500000;
  const value = custom ? Number(custom) : amount;
  const valid = Number.isInteger(value) && value >= min && value <= max;

  // Card fee is added on top for real payments; ask the server for the exact
  // total (debounced while typing).
  const [quote, setQuote] = useState(null);
  useEffect(() => {
    if (!valid) {
      setQuote(null);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(() => {
      getFundingQuote(value)
        .then((q) => active && setQuote(q))
        .catch(() => active && setQuote(null));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [value, valid]);
  const total = quote && quote.amount === value ? quote.total : null;
  const fee = quote && quote.amount === value ? quote.fee : 0;

  useEffect(() => {
    panelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onPageShow = (event) => {
      if (event.persisted) setBusy(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!valid) {
      setError(`Enter a whole amount between ${formatNaira(min)} and ${formatNaira(max)}.`);
      return;
    }
    setError("");
    if (!clientRef.current) clientRef.current = makeReference();
    setBusy(true);
    try {
      const data = await fundWallet({ amount: value, clientReference: clientRef.current });
      clientRef.current = null;
      if (data.checkoutUrl) {
        if (!isTrustedCheckoutUrl(data.checkoutUrl)) throw new Error("Unexpected payment page. Please contact support.");
        window.location.assign(data.checkoutUrl);
        return;
      }
      onFunded(data);
      router.replace("/wallet", { scroll: false });
    } catch (err) {
      clientRef.current = null;
      setError(errorMessage(err, "Could not fund your wallet. Please try again."));
      setBusy(false);
    }
  };

  return (
    <section ref={panelRef} aria-labelledby="fund-heading" className="card scroll-mt-24 overflow-hidden animate-page-in">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 id="fund-heading" className="font-display text-base font-bold text-ink-900">
          Fund your wallet
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:bg-slate-100 hover:text-ink-800"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-5 p-5">
        <div role="group" aria-label="Quick amounts" className="grid grid-cols-3 gap-2.5">
          {QUICK_AMOUNTS.filter((v) => v >= min && v <= max).map((v) => {
            const active = !custom && amount === v;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setAmount(v);
                  setCustom("");
                  setError("");
                }}
                className={`focus-ring press rounded-xl border bg-white px-2 py-3.5 font-display text-sm font-bold ${
                  active
                    ? "border-cyan-400 bg-cyan-50 text-cyan-800 shadow-[0_0_0_1px_var(--color-cyan-400)]"
                    : "border-slate-200 text-ink-800 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {formatNaira(v)}
              </button>
            );
          })}
        </div>

        <div>
          <label htmlFor="fund-amount" className="mb-1.5 block text-sm font-semibold text-ink-700">
            Or enter an amount
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-semibold text-ink-500">₦</span>
            <input
              id="fund-amount"
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              step="1"
              placeholder={`${min.toLocaleString("en-NG")} – ${max.toLocaleString("en-NG")}`}
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value.replace(/[^\d]/g, ""));
                setError("");
              }}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "fund-error" : "fund-hint"}
              className="input-base pl-9 text-base"
            />
          </div>
          {error ? (
            <p id="fund-error" role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500">
              <AlertCircle size={14} aria-hidden="true" />
              {error}
            </p>
          ) : (
            <p id="fund-hint" className="mt-1.5 text-xs text-ink-400">
              Minimum {formatNaira(min)}, maximum {formatNaira(max)} per top-up.
            </p>
          )}
        </div>

        {valid && fee > 0 && (
          <dl className="space-y-1.5 rounded-xl border border-slate-200 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">Added to your wallet</dt>
              <dd className="font-semibold text-ink-900">{formatNaira(value)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Card processing fee</dt>
              <dd className="font-semibold text-ink-900">{formatNaira(fee)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1.5">
              <dt className="font-semibold text-ink-800">You pay</dt>
              <dd className="font-display font-extrabold text-ink-900">{formatNaira(total)}</dd>
            </div>
          </dl>
        )}

        <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-ink-500">
          <ShieldCheck size={16} className="mt-px shrink-0 text-emerald-600" aria-hidden="true" />
          <span>
            {mode === "test"
              ? "Test mode: the amount is added instantly and no real money is charged."
              : "You'll pay securely on Paystack. Your wallet is credited as soon as the payment is confirmed."}
          </span>
        </div>

        <button
          type="submit"
          disabled={busy || !valid}
          aria-busy={busy}
          className="gradient-btn focus-ring inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold brand-contrast disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && <span aria-hidden="true" className="brand-spin inline-block h-4 w-4 animate-spin rounded-full" />}
          {busy
            ? "Processing…"
            : !valid
              ? "Enter an amount"
              : fee > 0 && total
                ? `Pay ${formatNaira(total)}`
                : `Add ${formatNaira(value)} to wallet`}
        </button>
      </form>
    </section>
  );
}

function ActivityRow({ entry, hidden }) {
  const style = ENTRY_STYLE[entry.kind] || ENTRY_STYLE.purchase;
  const chip = STATUS_CHIP[entry.status];
  const credit = entry.direction === "credit";
  const amount = hidden ? "••••" : `${credit ? "+" : "−"}${formatNaira(entry.amount)}`;
  const body = (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.tone}`}>
        <style.icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink-900">
          {entry.kind === "purchase" ? entry.description || style.label : style.label}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
          {formatDateTime(entry.createdAt)}
          {chip && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip.className}`}>{chip.label}</span>}
        </span>
      </span>
      <span
        className={`shrink-0 font-display text-sm font-bold tabular-nums ${
          entry.status !== "successful" ? "text-ink-400" : credit ? "text-emerald-600" : "text-ink-900"
        }`}
      >
        {amount}
      </span>
    </>
  );

  const rowClass = "flex items-center gap-3 px-4 py-3.5 sm:px-5";
  if (entry.orderTransactionId) {
    return (
      <li>
        <Link href={`/history/${entry.orderTransactionId}`} className={`focus-ring ${rowClass} hover:bg-slate-50`}>
          {body}
        </Link>
      </li>
    );
  }
  return <li className={rowClass}>{body}</li>;
}

function WalletContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { balance, hidden, applyBalance } = useWallet();
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [fundOpen, setFundOpen] = useState(params.get("fund") === "1");
  const [notice, setNotice] = useState(null);

  const load = useCallback(
    async (page = 1) => {
      const data = await getWallet({ page, limit: 20 });
      setSummary(data.wallet);
      applyBalance(data.wallet.balance);
      setPagination(data.pagination);
      setEntries((current) => (page === 1 ? data.entries : [...current, ...data.entries]));
      return data;
    },
    [applyBalance]
  );

  useEffect(() => {
    let active = true;
    load(1)
      .then((data) => {
        if (!active) return;
        const funded = params.get("funded");
        if (funded) {
          const entry = data.entries.find((e) => e.reference === funded);
          if (entry?.status === "successful") {
            setNotice({ tone: "success", text: `${formatNaira(entry.amount)} was added to your wallet.` });
          } else if (entry) {
            setNotice({ tone: "info", text: "We're still confirming your payment. Your wallet updates automatically once it's confirmed." });
          }
          router.replace("/wallet", { scroll: false });
        }
      })
      .catch((err) => active && setError(errorMessage(err, "Could not load your wallet.")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // Only on first load; `params` is read once for the ?funded= notice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Opening "Fund" from the account menu while already on this page.
  const fundParam = params.get("fund");
  useEffect(() => {
    if (fundParam === "1") setFundOpen(true);
  }, [fundParam]);

  const onFunded = (data) => {
    setFundOpen(false);
    applyBalance(data.wallet.balance);
    setNotice({ tone: "success", text: `${formatNaira(data.entry.amount)} was added to your wallet.` });
    window.scrollTo({ top: 0, behavior: "smooth" });
    load(1).catch(() => {});
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      await load(pagination.page + 1);
    } catch (err) {
      setError(errorMessage(err, "Could not load more activity."));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">Wallet</h1>
        <p className="mt-1 text-sm text-ink-500">Top up once and pay for data and airtime in one tap.</p>
      </header>

      {notice && (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium animate-page-in ${
            notice.tone === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-amber-100 bg-amber-50 text-amber-700"
          }`}
        >
          {notice.tone === "success" ? (
            <CheckCircle2 size={18} className="mt-px shrink-0" aria-hidden="true" />
          ) : (
            <Clock size={18} className="mt-px shrink-0" aria-hidden="true" />
          )}
          <span className="flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="focus-ring rounded-full p-0.5 opacity-70 hover:opacity-100">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <WalletHero balance={balance} hidden={hidden} onFund={() => setFundOpen(true)} />

      {fundOpen && (
        <FundPanel
          limits={summary?.limits}
          mode={summary?.mode}
          onClose={() => {
            setFundOpen(false);
            router.replace("/wallet", { scroll: false });
          }}
          onFunded={onFunded}
        />
      )}

      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="mb-3 font-display text-lg font-bold text-ink-800">
          Wallet activity
        </h2>

        {loading ? (
          <LoadingSpinner size={32} label="Loading wallet activity..." />
        ) : error ? (
          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>
        ) : entries.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="wallet-gradient flex h-14 w-14 items-center justify-center rounded-2xl brand-contrast">
              <Wallet size={24} aria-hidden="true" />
            </span>
            <p className="font-display text-lg font-bold text-ink-800">No wallet activity yet</p>
            <p className="max-w-sm text-sm text-ink-500">Fund your wallet to pay for data and airtime instantly, without entering card details every time.</p>
            <button
              type="button"
              onClick={() => setFundOpen(true)}
              className="gradient-btn focus-ring mt-1 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold brand-contrast"
            >
              <Plus size={16} aria-hidden="true" />
              Fund wallet
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} hidden={hidden} />
              ))}
            </ul>
            {pagination.page < pagination.pages && (
              <div className="border-t border-slate-100 p-3 text-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="btn-secondary focus-ring inline-flex h-10 items-center rounded-xl px-5 text-sm font-semibold disabled:opacity-60"
                >
                  {loadingMore ? "Loading…" : "Show more"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading your wallet..." />}>
      <WalletContent />
    </Suspense>
  );
}
