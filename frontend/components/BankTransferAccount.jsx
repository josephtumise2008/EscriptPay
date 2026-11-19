"use client";

import { useEffect, useState } from "react";
import { Landmark, Copy, Check, AlertCircle } from "lucide-react";
import { getWalletAccount, createWalletAccount, errorMessage } from "@/lib/api";

// The customer's own bank account number: transfer from any bank or app
// (OPay, PalmPay, Kuda, GTB…) and it lands in the wallet automatically.
// Renders nothing until the feature is switched on for the business.
export default function BankTransferAccount({ compact = false }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    getWalletAccount()
      .then((r) => active && setState(r))
      .catch(() => active && setState({ enabled: false, account: null }));
    return () => {
      active = false;
    };
  }, []);

  if (!state || !state.enabled) return null;
  const account = state.account;

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      setState(await createWalletAccount());
    } catch (err) {
      setError(errorMessage(err, "We couldn't create your account number right now. Please try again later."));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(account.accountNumber);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section aria-label="Fund by bank transfer" className={`card ${compact ? "p-4" : "p-4 sm:p-5"}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Landmark size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink-900">Fund by bank transfer</p>
          {account && account.status === "active" ? (
            <>
              <p className="mt-0.5 text-xs text-ink-500">
                Send any amount to this account from any bank or app. It lands in your wallet automatically.
              </p>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <p className="text-xs font-semibold text-ink-500">{account.bankName}</p>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="font-mono text-xl font-bold tracking-wider text-ink-900">{account.accountNumber}</span>
                  <button
                    type="button"
                    onClick={copy}
                    className="focus-ring press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-ink-900 px-3 text-xs font-bold text-white"
                  >
                    {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-500">{account.accountName}</p>
              </div>
            </>
          ) : account && account.status === "requesting" ? (
            <p className="mt-0.5 text-xs text-ink-500">Creating your account number… check back in a minute.</p>
          ) : (
            <>
              <p className="mt-0.5 text-xs text-ink-500">
                Get your own EscriptPay account number. Transfer to it from OPay, PalmPay or any bank. No card needed.
              </p>
              <button
                type="button"
                onClick={create}
                disabled={busy}
                className="focus-ring press mt-3 inline-flex h-10 items-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {busy ? "Creating…" : "Get my account number"}
              </button>
            </>
          )}
          {error && (
            <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-medium text-red-600">
              <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
