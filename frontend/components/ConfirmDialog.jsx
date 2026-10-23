"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

// Accessible confirmation modal: focus starts on Cancel (the safe choice),
// Tab is trapped inside, Escape/backdrop cancel (unless busy), page scroll is
// locked, and focus returns to the element that opened it.
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  busyLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  error = "",
  onConfirm,
  onCancel,
}) {
  const id = useId();
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = document.activeElement;
    cancelRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape" && !busy) {
        e.stopPropagation();
        onCancel?.();
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll("button:not(:disabled), [href], input, [tabindex]:not([tabindex='-1'])");
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmStyles =
    tone === "danger"
      ? "bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400"
      : "gradient-btn";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center" role="presentation">
      <div
        className="absolute inset-0 animate-fade-in bg-slate-950/50 backdrop-blur-[2px]"
        onClick={busy ? undefined : onCancel}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-desc` : undefined}
        className="card animate-scale-in relative w-full max-w-md p-6 shadow-2xl sm:p-7"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="focus-ring icon-btn absolute right-3 top-3 h-9 w-9 disabled:opacity-40"
          aria-label="Close dialog"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="flex items-start gap-4">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              tone === "danger" ? "bg-red-50 text-red-600" : "bg-cyan-50 text-cyan-600"
            }`}
          >
            <AlertTriangle size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 pr-6">
            <h2 id={`${id}-title`} className="font-display text-lg font-bold text-ink-900">
              {title}
            </h2>
            {description && (
              <p id={`${id}-desc`} className="mt-1 text-sm leading-relaxed text-ink-500">
                {description}
              </p>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="focus-ring btn-secondary py-2.5">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className={`focus-ring press inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold brand-contrast disabled:cursor-wait disabled:opacity-80 ${confirmStyles}`}
          >
            {busy && <span aria-hidden="true" className="brand-spin inline-block h-4 w-4 animate-spin rounded-full" />}
            {busy && busyLabel ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
