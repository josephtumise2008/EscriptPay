"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePushAlerts } from "@/lib/push";
import { useScrollLock } from "@/hooks/useScrollLock";

// Asks signed-in customers to turn on notifications as soon as they open the
// app. Phones only allow a site to send notifications after the person taps
// Allow, so this is the one tap that switches everything on. "Not now" waits
// three days before asking again; turning alerts off later is in Settings.
const KEY = "escriptpay.push-ask";
const WAIT_MS = 3 * 24 * 60 * 60 * 1000;

const askedRecently = () => {
  try {
    const t = Number(localStorage.getItem(KEY) || 0);
    return Date.now() - t < WAIT_MS;
  } catch {
    return false;
  }
};
const remember = () => {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    // ignore
  }
};

export default function PushPrompt() {
  const { user } = useAuth();
  const { state, enable } = usePushAlerts();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || state !== "off" || askedRecently()) return undefined;
    // Give the dashboard (and the launch screen) a moment first.
    const t = setTimeout(() => setOpen(true), 2500);
    return () => clearTimeout(t);
  }, [user, state]);

  if (!open) return null;

  const close = () => {
    remember();
    setOpen(false);
  };

  return <Sheet busy={busy} onClose={close} onEnable={async () => {
    setBusy(true);
    await enable();
    remember();
    setBusy(false);
    setOpen(false);
  }} />;
}

function Sheet({ busy, onClose, onEnable }) {
  useScrollLock(true);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="push-ask-title" className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" tabIndex={-1} aria-label="Close" onClick={() => !busy && onClose()} className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-[2px] animate-fade-in" />
      <section className="card relative w-full max-w-sm rounded-b-none rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center animate-fade-up sm:rounded-3xl sm:pb-6">
        <button type="button" onClick={onClose} disabled={busy} aria-label="Not now" className="focus-ring absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-400 hover:bg-slate-100 hover:text-ink-700">
          <X size={18} aria-hidden="true" />
        </button>
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl wallet-gradient brand-contrast">
          <BellRing size={26} aria-hidden="true" />
        </span>
        <h2 id="push-ask-title" className="mt-4 font-display text-lg font-bold text-ink-900">Don&apos;t miss your daily gift</h2>
        <p className="mt-1.5 text-sm text-ink-500">
          Get a reminder when your gift box is ready, plus alerts for cashback and referral rewards. You can turn them off anytime in Settings.
        </p>
        <button type="button" onClick={onEnable} disabled={busy} className="gradient-btn focus-ring press mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold brand-contrast disabled:opacity-60">
          {busy ? "Turning on…" : "Turn on notifications"}
        </button>
        <button type="button" onClick={onClose} disabled={busy} className="focus-ring mt-2 h-10 w-full rounded-xl text-sm font-semibold text-ink-500 hover:text-ink-800">
          Not now
        </button>
      </section>
    </div>
  );
}
