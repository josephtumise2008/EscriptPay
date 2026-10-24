"use client";

import { AlertCircle } from "lucide-react";

// Phone-only buy bar pinned above the tab bar, so the order total and the
// Buy button are always visible — no scrolling to the bottom to check out.
export default function MobileCheckoutBar({ title, subtitle, amountLabel, ready, processing, onBuy, error }) {
  return (
    <>
      {/* Reserves space so the bar never covers the end of the form. */}
      <div aria-hidden="true" className="h-24 lg:hidden" />
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-slate-200/80 bg-white px-4 py-3 shadow-[0_-12px_32px_-24px_rgb(15_23_42/0.4)] lg:hidden">
        <div className="mx-auto max-w-md">
          {error && (
            <p role="alert" className="mb-2 flex items-start gap-1.5 text-xs font-medium text-red-600">
              <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-900">{title}</p>
              <p className="truncate text-xs text-ink-500">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onBuy}
              disabled={!ready || processing}
              aria-busy={processing}
              className="gradient-btn focus-ring inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold brand-contrast disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing && <span aria-hidden="true" className="brand-spin inline-block h-4 w-4 animate-spin rounded-full" />}
              {processing ? "Processing…" : amountLabel ? `Buy · ${amountLabel}` : "Buy"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
