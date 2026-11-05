"use client";

import { useState } from "react";
import { Copy, Check, Zap, KeyRound, Info } from "lucide-react";

function CopyValue({ label, value, big = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value).replace(/\s+/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard denied: the value is still selectable.
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        <p className={`select-all break-all font-mono font-bold tracking-wide text-ink-900 ${big ? "text-lg sm:text-xl" : "text-base"}`}>{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="focus-ring inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-ink-700 hover:bg-slate-50"
      >
        {copied ? <Check size={14} className="text-emerald-600" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

// What the customer must keep: electricity token or exam PINs. Shown on the
// order page and the receipt once the order succeeds.
export default function BillDeliverables({ transaction: tx }) {
  if (!tx || tx.status !== "successful") return null;

  if (tx.type === "electricity") {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5" aria-label="Your token">
        <p className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-amber-800">
          <Zap size={16} aria-hidden="true" /> Your electricity token
        </p>
        {tx.token ? (
          <CopyValue label="Token" value={tx.token} big />
        ) : (
          <p className="flex items-start gap-2 text-sm text-amber-800">
            <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            {tx.meterType === "02"
              ? "Your postpaid bill has been paid. No token is needed."
              : `Your token has been sent by SMS to ${tx.phone}. It will also show here once your electricity company sends it.`}
          </p>
        )}
        {tx.token && <p className="mt-2 text-xs text-amber-800">We've also emailed it to you. Enter it on your meter.</p>}
      </section>
    );
  }

  if (tx.type === "exam") {
    const pins = Array.isArray(tx.pins) ? tx.pins : [];
    return (
      <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 sm:p-5" aria-label="Your PIN">
        <p className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-indigo-800">
          <KeyRound size={16} aria-hidden="true" /> Your {tx.network} PIN
        </p>
        <div className="space-y-2.5">
          {pins.length > 0 ? (
            pins.map((p, i) => (
              <div key={`${p.serial}-${i}`} className="space-y-2.5">
                <CopyValue label={pins.length > 1 ? `Serial No ${i + 1}` : "Serial No"} value={p.serial} />
                <CopyValue label={pins.length > 1 ? `PIN ${i + 1}` : "PIN"} value={p.pin} big />
              </div>
            ))
          ) : tx.cardDetails ? (
            <CopyValue label="PIN details" value={tx.cardDetails} />
          ) : (
            <p className="text-sm text-indigo-800">Your PIN has been sent by SMS to {tx.phone}.</p>
          )}
        </div>
        <p className="mt-2 text-xs text-indigo-800">We've also emailed it to you. Keep it private.</p>
      </section>
    );
  }
  return null;
}
