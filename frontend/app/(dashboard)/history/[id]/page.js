"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, ShoppingBag, History, AlertCircle, Inbox } from "lucide-react";
import Receipt from "@/components/Receipt";
import LoadingSpinner from "@/components/LoadingSpinner";
import TestModeBadge from "@/components/TestModeBadge";
import { getTransaction, errorMessage } from "@/lib/api";
import { maskPhone } from "@/lib/format";

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id || "";

  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState(null);
  const [error, setError] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!id) {
        if (active) {
          setLoading(false);
          setError("No transaction reference provided.");
        }
        return;
      }
      try {
        const { transaction: tx } = await getTransaction(id);
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
  }, [id]);

  useEffect(() => {
    if (unauthorized) router.replace(`/login?next=/history/${encodeURIComponent(id)}`);
  }, [unauthorized, id, router]);

  if (loading) {
    return (
      <div className="card p-6">
        <LoadingSpinner size={36} label="Loading transaction..." />
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="card card-hover flex flex-col items-center gap-4 px-6 py-14 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <Inbox size={24} aria-hidden="true" />
        </span>
        <h1 className="font-display text-xl font-extrabold text-ink-900">
          Transaction not found
        </h1>
        <p className="max-w-sm text-sm text-ink-500">
          {error || "This purchase does not exist or belongs to another account."}
        </p>
        <Link
          href="/history"
          className="gradient-btn focus-ring inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold brand-contrast"
        >
          <History size={16} />
          Back to history
        </Link>
      </div>
    );
  }

  const isAirtime = transaction.type === "airtime";
  const buyAgainHref = isAirtime
    ? `/buy-airtime?network=${encodeURIComponent(transaction.network)}&amount=${transaction.amount}`
    : `/buy-data?network=${encodeURIComponent(transaction.network)}${
        transaction.planId ? `&plan=${encodeURIComponent(transaction.planId)}` : ""
      }`;

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/history"
              className="focus-ring inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-600 transition-colors hover:text-cyan-700"
            >
              <ArrowLeft size={15} />
              Back to history
            </Link>
            <h1 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              Transaction details
            </h1>
            <p className="mt-1.5 text-sm text-ink-500">
              {transaction.network} · {transaction.plan} · {maskPhone(transaction.phone)}
            </p>
          </div>
          <TestModeBadge />
        </div>
      </header>

      <div className="no-print flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="gradient-btn focus-ring inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold brand-contrast"
        >
          <Printer size={16} />
          Print Receipt
        </button>
        <Link
          href={buyAgainHref}
          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 transition-all hover:border-cyan-300 hover:text-cyan-700"
        >
          <ShoppingBag size={16} />
          Buy Again
        </Link>
      </div>

      <div className="animate-fade-up">
        <Receipt transaction={transaction} />
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        This is a simulated test purchase — no real money moved and no data or
        airtime was delivered.
      </p>
    </div>
  );
}