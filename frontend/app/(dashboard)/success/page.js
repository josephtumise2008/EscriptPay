"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Banknote,
  ShoppingBag,
  History,
  AlertCircle,
  XCircle,
  Clock, Home } from "lucide-react";
import { getTransaction, errorMessage } from "@/lib/api";
import { useWallet } from "@/lib/wallet-context";
import { formatDateTime, formatNaira } from "@/lib/format";
import { statusLabel, describeTransaction, isAwaitingUpdate } from "@/lib/transactions";
import { isTrustedCheckoutUrl, openCheckout } from "@/lib/checkout";
import LoadingSpinner from "@/components/LoadingSpinner";

const STATUS_ICONS = {
  successful: CheckCircle2,
  failed: XCircle,
  pending: Clock,
};

function SuccessContent() {
  const router = useRouter();
  const params = useSearchParams();
  const ref = params.get("ref") || "";

  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState(null);
  const [error, setError] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!ref) {
        router.replace("/history");
        return;
      }
      if (active) {
        setError("");
        setLoading(true);
      }
      try {
        const { transaction: tx } = await getTransaction(ref);
        if (active) setTransaction(tx);
      } catch (err) {
        if (err?.response?.status === 401) {
          if (active) setUnauthorized(true);
        } else if (active) {
          setError(errorMessage(err, "We could not find this transaction."));
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [ref, router]);

  useEffect(() => {
    if (unauthorized) {
      router.replace(`/login?next=/success?ref=${encodeURIComponent(ref)}`);
    }
  }, [unauthorized, ref, router]);

  // While payment confirmation (webhook) or delivery is still in flight,
  // refresh the order every few seconds for up to ~5 minutes (real suppliers
  // can take a few minutes to confirm delivery).
  const awaiting = isAwaitingUpdate(transaction);
  const txRef = transaction?.transactionId || "";
  useEffect(() => {
    if (!awaiting || !txRef) return;
    let active = true;
    let tries = 0;
    let timer;
    // Fast checks first (delivery usually lands within seconds), then slower.
    const tick = async () => {
      tries += 1;
      try {
        const { transaction: tx } = await getTransaction(txRef);
        if (active && tx) setTransaction(tx);
      } catch {
        // Transient network error: try again on the next tick.
      }
      if (active && tries < 80) timer = setTimeout(tick, tries < 20 ? 2000 : 5000);
    };
    timer = setTimeout(tick, 1500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [awaiting, txRef]);

  // A wallet order that finishes (or is refunded) changes the balance.
  const { refresh: refreshWallet } = useWallet();
  const finalStatus = transaction?.status;
  useEffect(() => {
    if (finalStatus && finalStatus !== "pending") refreshWallet();
  }, [finalStatus, refreshWallet]);

  if (loading) {
    return (
      <div className="flex justify-center py-2 sm:py-6">
        <LoadingSpinner size={44} label="Loading your transaction..." />
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="flex justify-center py-2 sm:py-6">
        <div className="card card-hover w-full max-w-lg px-6 py-12 text-center">
          <p className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <AlertCircle size={26} aria-hidden="true" />
          </p>
          <h1 className="mt-5 font-display text-2xl font-extrabold text-ink-900">
            Transaction not found
          </h1>
          <p className="mt-2 text-sm text-ink-500">{error || "This purchase does not exist."}</p>
          <Link
            href="/buy-data"
            className="gradient-btn focus-ring mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold brand-contrast"
          >
            <ShoppingBag size={16} />
            Buy Data
          </Link>
        </div>
      </div>
    );
  }

  const StatusIcon = STATUS_ICONS[transaction.status] || Clock;
  const successful = transaction.status === "successful";
  const summary = describeTransaction(transaction);
  const resumeCheckoutUrl =
    transaction.paymentStatus === "pending" && isTrustedCheckoutUrl(transaction.checkoutUrl)
      ? transaction.checkoutUrl
      : "";
  const isAirtime = transaction.type === "airtime";
  const deliveredLabel = isAirtime ? formatNaira(transaction.amount) : transaction.plan;
  const buyAgainHref = isAirtime
    ? `/buy-airtime?network=${encodeURIComponent(transaction.network)}&amount=${transaction.amount}`
    : `/buy-data?network=${encodeURIComponent(transaction.network)}${
        transaction.planId ? `&plan=${encodeURIComponent(transaction.planId)}` : ""
      }`;


  const tone = successful
    ? "bg-emerald-50 text-emerald-600"
    : transaction.status === "pending"
      ? "bg-amber-50 text-amber-600"
      : "bg-red-50 text-red-500";

  const details = [
    { label: "Transaction ID", value: transaction.transactionId, mono: true },
    { label: "Network", value: transaction.network },
    { label: isAirtime ? "Type" : "Plan", value: isAirtime ? "Airtime top-up" : transaction.plan },
    { label: "Phone number", value: transaction.phone },
    { label: "Date", value: formatDateTime(transaction.createdAt) },
    { label: "Status", value: statusLabel(transaction.status), badge: true },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Outcome */}
      <section className="card animate-scale-in p-5 sm:p-7" aria-labelledby="outcome-heading">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14 ${tone}`}>
              <StatusIcon size={26} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 id="outcome-heading" className="font-display text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">
                {summary.title}
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">
                {successful ? (
                  <>
                    <span className="font-semibold text-ink-800">{deliveredLabel}</span> sent to{" "}
                    <span className="font-semibold text-ink-800">{transaction.phone}</span>
                  </>
                ) : (
                  summary.message
                )}
              </p>
              {awaiting && transaction.paymentStatus === "successful" && (
                <div className="mt-3 w-full max-w-xs" role="status">
                  <p className="text-xs font-medium text-ink-500">
                    Sending to {transaction.phone}… this usually takes a few seconds.
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                    <div className="delivery-bar h-full w-1/3 rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-sky-400" />
                  </div>
                </div>
              )}
              {awaiting && transaction.paymentStatus !== "successful" && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-600" role="status">
                  <Clock size={13} aria-hidden="true" />
                  Checking for updates…
                </p>
              )}
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4 sm:border-0 sm:pt-0 sm:text-right">
            <p className="text-xs font-medium text-ink-500">Amount</p>
            <p className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              {formatNaira(transaction.amount)}
            </p>
          </div>
        </div>

        {resumeCheckoutUrl && (
          <a
            href={resumeCheckoutUrl}
            onClick={(event) => {
              event.preventDefault();
              openCheckout({
                checkoutUrl: resumeCheckoutUrl,
                onSuccess: (ref) =>
                  router.push(`/payment/callback?reference=${encodeURIComponent(ref || transaction.paymentReference || transaction.transactionId)}`),
              }).catch(() => window.location.assign(resumeCheckoutUrl));
            }}
            className="gradient-btn focus-ring mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold brand-contrast sm:w-auto"
          >
            <Banknote size={16} aria-hidden="true" />
            Complete payment
          </a>
        )}
      </section>

      {/* Details */}
      <section className="card p-5 sm:p-7" aria-labelledby="details-heading">
        <h2 id="details-heading" className="font-display text-base font-bold text-ink-900">
          Order details
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {details.map((d) => (
            <div key={d.label} className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 sm:flex-col sm:items-start sm:justify-start sm:gap-1">
              <dt className="text-sm text-ink-500 sm:text-xs sm:font-medium sm:uppercase sm:tracking-wide">{d.label}</dt>
              <dd className={`text-right text-sm font-semibold text-ink-900 sm:text-left ${d.mono ? "break-all font-mono" : ""}`}>
                {d.badge ? (
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{d.value}</span>
                ) : (
                  d.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Next steps */}
      <div className="grid grid-cols-2 gap-2.5 sm:flex sm:justify-end sm:gap-3">
        <Link href={`/history/${transaction._id}`} className="focus-ring btn-secondary">
          <History size={16} aria-hidden="true" />
          View receipt
        </Link>
        <Link
          href={buyAgainHref}
          className="gradient-btn focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold brand-contrast"
        >
          <ShoppingBag size={16} aria-hidden="true" />
          Buy again
        </Link>
      </div>
      <Link
        href="/dashboard"
        className="focus-ring press flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-ink-800 hover:bg-slate-50 sm:ml-auto sm:w-auto sm:px-8"
      >
        <Home size={16} aria-hidden="true" />
        Done
      </Link>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}