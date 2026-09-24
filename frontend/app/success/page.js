"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Wifi,
  Package,
  Banknote,
  ShoppingBag,
  History,
  AlertCircle,
  Smartphone,
  XCircle,
  Clock,
} from "lucide-react";
import { getTransaction, errorMessage } from "@/lib/api";
import { formatDateTime, formatNaira } from "@/lib/format";
import { statusLabel } from "@/lib/transactions";
import LoadingSpinner from "@/components/LoadingSpinner";
import TestModeBadge from "@/components/TestModeBadge";

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
        if (active) {
          setLoading(false);
          setError("No transaction reference provided.");
        }
        return;
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
  }, [ref]);

  useEffect(() => {
    if (unauthorized) {
      router.replace(`/login?next=/success?ref=${encodeURIComponent(ref)}`);
    }
  }, [unauthorized, ref, router]);

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-14">
        <LoadingSpinner size={44} label="Loading your transaction..." />
      </main>
    );
  }

  if (error || !transaction) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-14">
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
      </main>
    );
  }

  const StatusIcon = STATUS_ICONS[transaction.status] || Clock;
  const successful = transaction.status === "successful";
  const isAirtime = transaction.type === "airtime";
  const deliveredLabel = isAirtime ? formatNaira(transaction.amount) : transaction.plan;
  const buyAgainHref = isAirtime ? "/buy-airtime" : "/buy-data";

  const rows = [
    { label: "Network", value: transaction.network, icon: Wifi },
    { label: "Plan", value: isAirtime ? "Airtime top-up" : transaction.plan, icon: Package },
    { label: "Amount", value: formatNaira(transaction.amount), icon: Banknote },
  ];

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-14">
      <div className="w-full max-w-lg">
        <div className="flex justify-center">
          <TestModeBadge />
        </div>
        <div className="card card-hover mt-3 animate-pop px-6 py-10 text-center sm:px-10">
          <div
            className={`mx-auto flex h-20 w-20 animate-check items-center justify-center rounded-full shadow-[0_12px_30px_-10px_rgb(6_182_212/0.5)] ${
              successful
                ? "bg-gradient-to-tr from-cyan-500 via-sky-500 to-purple-lite-500"
                : "bg-slate-200"
            }`}
          >
            <StatusIcon size={42} className="brand-contrast" aria-hidden="true" />
          </div>

          <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            {successful ? "Purchase Successful!" : "Purchase " + statusLabel(transaction.status)}
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            {successful ? (
              <>
                <span className="font-semibold text-ink-700">{deliveredLabel}</span> has been
                sent to:
              </>
            ) : (
              "This purchase did not go through."
            )}
          </p>
          <p className="mt-1 font-display text-lg font-bold gradient-text">
            {successful ? transaction.phone : "—"}
          </p>

          <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-left sm:p-5">
            <div className="flex items-center justify-center gap-2 border-b border-slate-200/70 pb-3">
              <p className="font-mono text-sm font-bold text-ink-800">{transaction.transactionId}</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-400">
                Transaction ID
              </span>
            </div>

            <div className="mt-2 space-y-1">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center gap-3 py-1.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-cyan-600 shadow-sm">
                    <row.icon size={15} aria-hidden="true" />
                  </span>
                  <span className="text-sm text-ink-500">{row.label}</span>
                  <span className="ml-auto text-sm font-semibold text-ink-800">{row.value}</span>
                </div>
              ))}
              <div className="flex items-center gap-3 py-1.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-purple-lite-600 shadow-sm">
                  <Smartphone size={15} aria-hidden="true" />
                </span>
                <span className="text-sm text-ink-500">Status</span>
                <span
                  className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                    successful
                      ? "bg-emerald-50 text-emerald-600 ring-emerald-100"
                      : transaction.status === "pending"
                        ? "bg-amber-50 text-amber-600 ring-amber-100"
                        : "bg-red-50 text-red-500 ring-red-100"
                  }`}
                >
                  {statusLabel(transaction.status)}
                </span>
              </div>
            </div>

            <p className="pt-3 text-center text-xs text-ink-400">
              {formatDateTime(transaction.createdAt)} · {transaction.mode === "test" ? "Test mode" : "Live"}
            </p>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href={buyAgainHref}
              className="gradient-btn focus-ring inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold brand-contrast"
            >
              <ShoppingBag size={17} />
              Buy Again
            </Link>
            <Link
              href="/history"
              className="focus-ring inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 transition-all hover:border-cyan-300 hover:text-cyan-700"
            >
              <History size={17} />
              View Transactions
            </Link>
          </div>

          <p className="mt-5 text-xs text-ink-400">
            This is a simulated test purchase — no real money was moved and no data was delivered.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}