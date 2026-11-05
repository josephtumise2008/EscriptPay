"use client";

import { AlertCircle, CheckCircle2, Loader2, Wallet, CreditCard, RotateCcw } from "lucide-react";
import PaymentMethodPicker from "@/components/PaymentMethodPicker";
import MobileCheckoutBar from "@/components/MobileCheckoutBar";
import { formatNaira } from "@/lib/format";
import { cardTotal } from "@/lib/bills";

export const stepHeading = "mb-3 flex items-center gap-2 font-display text-base font-bold text-ink-800";
export const stepNumber = "flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-ink-600";

export function Step({ n, id, title, children }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className={stepHeading}>
        <span className={stepNumber} aria-hidden="true">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

// Big selectable tiles (providers, packages, meter type).
export function ChoiceGrid({ options, value, onChange, cols = "grid-cols-3", label }) {
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-2.5 ${cols}`}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`focus-ring press rounded-xl border bg-white px-3 py-3 text-left ${
              active ? "border-cyan-400 bg-cyan-50 shadow-[0_0_0_1px_var(--color-cyan-400)]" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className={`block text-sm font-bold ${active ? "text-cyan-800" : "text-ink-900"}`}>{o.title}</span>
            {o.detail && <span className="mt-0.5 block text-xs text-ink-500">{o.detail}</span>}
            {o.extra}
          </button>
        );
      })}
    </div>
  );
}

// Number input + the owner's name from the supplier check.
export function AccountField({ id, label, placeholder, value, onChange, check, hint }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink-700">{label}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 16))}
        aria-invalid={check.status === "invalid" ? "true" : "false"}
        aria-describedby={`${id}-status`}
        className={`input-base text-base tracking-wide ${check.status === "invalid" ? "border-red-300" : ""}`}
      />
      <div id={`${id}-status`} className="mt-2 min-h-[1.25rem] text-sm" aria-live="polite">
        {check.status === "checking" && (
          <span className="inline-flex items-center gap-1.5 text-ink-500">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Checking…
          </span>
        )}
        {check.status === "ok" && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
            <CheckCircle2 size={15} aria-hidden="true" /> {check.name}
          </span>
        )}
        {(check.status === "invalid" || check.status === "error") && (
          <span className="inline-flex flex-wrap items-center gap-1.5 font-medium text-red-600">
            <AlertCircle size={14} aria-hidden="true" /> {check.message}
            {check.status === "error" && (
              <button type="button" onClick={check.recheck} className="inline-flex items-center gap-1 font-bold underline underline-offset-2">
                <RotateCcw size={12} aria-hidden="true" /> Try again
              </button>
            )}
          </span>
        )}
        {check.status === "idle" && hint && <span className="text-xs text-ink-400">{hint}</span>}
      </div>
    </div>
  );
}

export function PhoneField({ id, value, onChange, error, hint = "We send your receipt details to this number." }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink-700">Phone number</label>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="08012345678"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d+]/g, ""))}
        aria-invalid={error ? "true" : "false"}
        className={`input-base text-base ${error ? "border-red-300" : ""}`}
      />
      {error ? (
        <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500">
          <AlertCircle size={14} aria-hidden="true" /> {error}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-ink-400">{hint}</p>
      )}
    </div>
  );
}

// Page layout: the form steps (children) + "Pay with", the order summary
// with the buy button on desktop, and the buy bar on phones.
export function BillCheckout({ children, step, amount, rows, title, subtitle, ready, order, onBuy, cardFee, buyLabel = "Pay" }) {
  const { pay, processing, error } = order;
  const valid = Number.isFinite(amount) && amount > 0;
  const card = pay.value === "card" && valid ? cardTotal(amount, cardFee) : null;
  const total = card ? card.total : amount;
  const totalLabel = valid ? formatNaira(total) : "";

  const summary = [
    ...rows,
    pay.value === "wallet" ? { label: "Pay with", value: "Wallet · no fee", icon: Wallet } : { label: "Pay with", value: "Card / bank", icon: CreditCard },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-7">
      {children}
      <Step n={step} id="bill-pay-heading" title="Pay with">
        <PaymentMethodPicker amount={valid ? amount : NaN} value={pay.value} onChange={pay.setValue} />
        {card && card.fee > 0 && (
          <p className="mt-2.5 text-xs text-ink-500">
            Card / bank adds Paystack's fee of <span className="font-semibold text-ink-700">{formatNaira(card.fee)}</span>.{" "}
            <span className="font-semibold text-emerald-700">Pay from your wallet: no fee.</span>
          </p>
        )}
      </Step>
      </div>

      <aside className="hidden lg:block">
        <div className="lg:sticky lg:top-24">
          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-base font-bold text-ink-900">Order summary</h2>
            </div>
            <div className="p-5">
              <ul className="space-y-3">
                {summary.map((row) => (
                  <li key={row.label} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-ink-500">
                      <row.icon size={16} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-ink-500">{row.label}</p>
                      <p className="truncate text-sm font-semibold text-ink-800">{row.value || "—"}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-4">
                <span className="text-sm font-semibold text-ink-700">Total</span>
                <span className="font-display text-xl font-extrabold text-ink-900">{totalLabel || "—"}</span>
              </div>
              <button
                type="button"
                onClick={onBuy}
                disabled={processing || !ready}
                className="gradient-btn focus-ring mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold brand-contrast disabled:cursor-not-allowed disabled:opacity-60"
              >
                {processing && <span aria-hidden="true" className="brand-spin inline-block h-4 w-4 animate-spin rounded-full" />}
                {processing ? "Processing…" : valid ? `${buyLabel} ${totalLabel}` : buyLabel}
              </button>
            </div>
          </div>
          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </aside>

      <MobileCheckoutBar title={title} subtitle={subtitle} amountLabel={valid ? totalLabel : ""} ready={ready} processing={processing} onBuy={onBuy} error={error} />
    </div>
  );
}

export function CatalogState({ loading, error, onRetry }) {
  if (loading) {
    return (
      <div className="card flex items-center gap-3 p-5 text-sm text-ink-500">
        <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="card flex flex-wrap items-center gap-3 p-5 text-sm text-red-600">
        <AlertCircle size={18} aria-hidden="true" /> {error}
        <button type="button" onClick={onRetry} className="font-bold underline underline-offset-2">Try again</button>
      </div>
    );
  }
  return null;
}
