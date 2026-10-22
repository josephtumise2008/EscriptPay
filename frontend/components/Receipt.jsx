"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Wifi,
  Smartphone,
  Landmark,
  ShieldCheck,
  Zap,
  Copy,
} from "lucide-react";
import Logo from "@/components/Logo";
import { formatDateTime, formatNaira } from "@/lib/format";
import { statusLabel } from "@/lib/transactions";

const STATUS_META = {
  successful: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
  pending: { icon: Clock, cls: "bg-amber-50 text-amber-600 ring-amber-100" },
  failed: { icon: XCircle, cls: "bg-red-50 text-red-500 ring-red-100" },
};

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API can be denied; fall back to a prompt-free no-op.
    return false;
  }
};

// Professional, printable receipt shown on the transaction detail page.
export default function Receipt({ transaction }) {
  const [copied, setCopied] = useState(false);
  const tx = transaction || {};
  const isAirtime = tx.type === "airtime";
  const Status = STATUS_META[tx.status] || STATUS_META.pending;

  const handleCopy = async () => {
    const ok = await copyText(tx.transactionId || "");
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const rows = [
    { label: "Transaction ID", value: tx.transactionId || "—", mono: true },
    { label: "Type", value: isAirtime ? "Airtime top-up" : "Data purchase" },
    { label: "Network", value: tx.network || "—" },
    { label: "Plan", value: isAirtime ? `Airtime ${formatNaira(tx.amount)}` : tx.plan || "—" },
    { label: "Phone", value: tx.phone || "—" },
    { label: "Payment ref", value: tx.paymentReference || "—", mono: Boolean(tx.paymentReference) },
    { label: "Reference", value: tx.providerReference || "—" },
    { label: "Date", value: formatDateTime(tx.createdAt) },
  ];

  return (
    <div className="receipt-sheet card overflow-hidden">
      {/* Receipt header */}
      <div className="gradient-btn px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 brand-contrast">
            <div className="rounded-xl bg-white/15 p-2 backdrop-blur-sm">
              <Logo size={26} />
            </div>
            <div>
              <p className="font-display text-base font-extrabold leading-none">EscriptPay</p>
              <p className="mt-0.5 text-[11px] font-medium opacity-80">
                Payment receipt — {tx.mode === "test" ? "Test" : "Live"}
              </p>
            </div>
          </div>
          <span className="rounded-lg bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest brand-contrast backdrop-blur-sm">
            Receipt
          </span>
        </div>
      </div>

      <div className="p-6">
        {/* Status + amount */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-dashed border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${
                Status.cls || "bg-slate-50 text-ink-400 ring-slate-100"
              }`}
            >
              <Status.icon size={21} aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-ink-800">
                {statusLabel(tx.status)}
              </p>
              <p className="text-xs text-ink-400">
                {tx.mode === "test" ? "Simulated (TEST MODE)" : "Live purchase"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-400">
              {tx.paymentStatus === "successful" ? "Amount paid" : "Amount"}
            </p>
            <p className="font-display text-2xl font-extrabold tracking-tight gradient-text">
              {formatNaira(tx.amount)}
            </p>
          </div>
        </div>

        {/* Details table */}
        <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-start justify-between gap-3 border-b border-slate-50 pb-2"
            >
              <span className="flex items-center gap-2 text-xs text-ink-400">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-50 text-cyan-600">
                  {row.label === "Transaction ID" ? (
                    <Zap size={12} aria-hidden="true" />
                  ) : row.label === "Network" ? (
                    <Wifi size={12} aria-hidden="true" />
                  ) : row.label === "Phone" ? (
                    <Smartphone size={12} aria-hidden="true" />
                  ) : (
                    <ShieldCheck size={12} aria-hidden="true" />
                  )}
                </span>
                {row.label}
              </span>
              <span
                className={`text-right text-sm break-all ${
                  row.mono ? "font-mono text-xs text-ink-700" : "font-semibold text-ink-800"
                }`}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Payment pipeline status */}
        <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 text-center">
          <div>
            <p className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink-400">
              <Landmark size={11} aria-hidden="true" />
              Payment
            </p>
            <p className="mt-1 text-xs font-semibold capitalize text-ink-700">
              {String(tx.paymentStatus || "not_required").replace("_", " ")}
            </p>
          </div>
          <div>
            <p className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink-400">
              <Zap size={11} aria-hidden="true" />
              Delivery
            </p>
            <p className="mt-1 text-xs font-semibold capitalize text-ink-700">
              {tx.providerStatus || "—"}
            </p>
          </div>
          <div>
            <p className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink-400">
              <ShieldCheck size={11} aria-hidden="true" />
              Mode
            </p>
            <p className="mt-1 text-xs font-semibold uppercase text-ink-700">{tx.mode || "test"}</p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-400">
            Generated {formatDateTime(new Date().toISOString())} — subject to verification.
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="no-print focus-ring inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 transition-colors hover:border-cyan-300 hover:text-cyan-700"
          >
            {copied ? (
              <CheckCircle2 size={13} className="text-emerald-500" aria-hidden="true" />
            ) : (
              <Copy size={13} aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy ID"}
          </button>
        </div>

        {tx.mode !== "live" && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-center text-[11px] font-medium text-amber-700">
            TEST MODE receipt — no real money moved and no data/airtime was delivered.
          </p>
        )}
      </div>
    </div>
  );
}