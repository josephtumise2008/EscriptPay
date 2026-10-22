"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

// Accessible confirmation modal (role=dialog, focus in, Esc to cancel,
// focus restored to the trigger when closed).
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement;
    cancelRef.current?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) {
      restoreRef.current?.focus?.();
    }
  }, [open]);

  if (!open) return null;

  const confirmStyles =
    tone === "danger"
      ? "bg-gradient-to-r from-red-500 to-rose-500 text-white hover:shadow-[0_10px_30px_-10px_rgb(239_68_68/0.5)]"
      : "gradient-btn brand-contrast";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        className="card animate-scale-in relative w-full max-w-sm p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring absolute right-4 top-4 rounded-lg p-1 text-ink-400 hover:text-ink-600"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <AlertTriangle size={22} aria-hidden="true" />
        </span>
        <h2 id="confirm-title" className="mt-4 font-display text-lg font-extrabold text-ink-900">
          {title}
        </h2>
        {description && (
          <p id="confirm-desc" className="mt-1.5 text-sm leading-relaxed text-ink-500">
            {description}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="focus-ring inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 transition-all hover:border-cyan-300 hover:text-cyan-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={`focus-ring inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${confirmStyles}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}