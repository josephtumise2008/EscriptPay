"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Share, PlusSquare, X, MoreVertical, Smartphone } from "lucide-react";
import Logo from "@/components/Logo";
import { useInstallApp } from "@/lib/pwa";
import { useScrollLock } from "@/hooks/useScrollLock";

const STEPS = {
  ios: {
    steps: [
      { icon: Share, text: <>Tap the <b>Share</b> button (the square with an arrow). On newer iPhones tap <b>⋯</b> first, then <b>Share</b>.</> },
      { icon: PlusSquare, text: <>Scroll down and tap <b>Add to Home Screen</b>.</> },
      { icon: Smartphone, text: <>Tap <b>Add</b>. EscriptPay now opens from your home screen like an app.</> },
    ],
  },
  "ios-other": {
    steps: [
      { icon: Share, text: <>Tap the <b>Share</b> button at the top right, next to the address.</> },
      { icon: PlusSquare, text: <>Scroll to the bottom of the list and tap <b>Add to Home Screen</b>. Not there? Tap <b>Edit Actions</b> or <b>More</b> to find it.</> },
      { icon: Smartphone, text: <>Tap <b>Add</b>. EscriptPay now opens from your home screen like an app.</> },
    ],
    note: "Easiest in Safari: open escriptpay.com in Safari and use Share → Add to Home Screen.",
  },
  android: {
    steps: [
      { icon: MoreVertical, text: <>Tap your browser&apos;s <b>menu</b> (⋮).</> },
      { icon: PlusSquare, text: <>Tap <b>Install app</b> or <b>Add to Home screen</b>.</> },
      { icon: Smartphone, text: <>Confirm. EscriptPay now opens from your home screen like an app.</> },
    ],
  },
  "mac-safari": {
    steps: [
      { icon: Share, text: <>In Safari, open the <b>File</b> menu (or click Share).</> },
      { icon: PlusSquare, text: <>Choose <b>Add to Dock</b>.</> },
      { icon: Smartphone, text: <>EscriptPay now opens from your Dock like an app.</> },
    ],
  },
};

function InstructionsSheet({ hint, onClose }) {
  useScrollLock(true);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const guide = STEPS[hint] || STEPS.android;
  const steps = guide.steps;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="install-title" className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" tabIndex={-1} aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-[2px] animate-fade-in" />
      <div className="card relative w-full max-w-md rounded-b-none rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-fade-up sm:rounded-3xl sm:pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Logo size={44} withWordmark={false} />
            <div>
              <h2 id="install-title" className="font-display text-lg font-extrabold tracking-tight text-ink-900">Install EscriptPay</h2>
              <p className="text-sm text-ink-500">Buy data and airtime in one tap from your home screen.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="focus-ring -mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-slate-100">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <ol className="mt-5 space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-3.5 py-3 text-sm text-ink-700">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                <step.icon size={18} aria-hidden="true" />
              </span>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
        {guide.note && <p className="mt-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-ink-500">{guide.note}</p>}
        <button type="button" onClick={onClose} className="gradient-btn focus-ring mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl text-sm font-bold brand-contrast">
          Got it
        </button>
      </div>
    </div>,
    document.body
  );
}

// variant: "row" (menu row), "block" (big button), "banner" (dismissible card)
export default function InstallApp({ variant = "row", rowClass = "", iconBox = "", onDone }) {
  const { available, canPrompt, hint, install } = useInstallApp();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (variant !== "banner") return;
    try {
      setDismissed(localStorage.getItem("ep-install-dismissed") === "1");
    } catch {
      setDismissed(false);
    }
  }, [variant]);

  if (!available) return null;
  if (variant === "banner" && dismissed) return null;

  // The instructions sheet lives in <InstallSheetHost /> (root layout) so it
  // stays open even when the menu that opened it closes.
  const start = async () => {
    if (canPrompt) await install();
    else window.dispatchEvent(new CustomEvent("ep-install-steps", { detail: hint }));
    onDone?.();
  };

  if (variant === "banner") {
    return (
      <section aria-label="Install the app" className="card flex items-center gap-3.5 p-4 animate-page-in">
        <Logo size={44} withWordmark={false} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-bold text-ink-900">Get the EscriptPay app</p>
          <p className="text-xs text-ink-500">Open it from your home screen and buy in one tap.</p>
        </div>
        <button type="button" onClick={start} className="gradient-btn focus-ring press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-bold brand-contrast">
          <Download size={16} aria-hidden="true" />
          Install
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem("ep-install-dismissed", "1");
            } catch {}
          }}
          className="focus-ring -mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-slate-100 hover:text-ink-700"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </section>
    );
  }

  if (variant === "hero") {
    return (
      <button type="button" onClick={start} className="focus-ring press inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-white">
        <Download size={16} aria-hidden="true" className="text-cyan-600" />
        Install the EscriptPay app
      </button>
    );
  }

  if (variant === "block") {
    return (
      <>
        <button type="button" onClick={start} className="focus-ring press flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-[15px] font-semibold text-ink-800 hover:bg-slate-50">
          <Download size={18} aria-hidden="true" />
          Install the app
        </button>
      </>
    );
  }

  return (
    <>
      <button type="button" onClick={start} className={rowClass}>
        <span className={iconBox}><Download size={17} aria-hidden="true" /></span>
        Install app
      </button>
    </>
  );
}

export function InstallSheetHost() {
  const [hint, setHint] = useState(null);
  useEffect(() => {
    const open = (e) => setHint(e.detail || "android");
    window.addEventListener("ep-install-steps", open);
    return () => window.removeEventListener("ep-install-steps", open);
  }, []);
  if (!hint) return null;
  return <InstructionsSheet hint={hint} onClose={() => setHint(null)} />;
}
