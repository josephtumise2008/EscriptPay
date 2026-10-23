"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, CreditCard, Check } from "lucide-react";
import { useWallet } from "@/lib/wallet-context";
import { getAppConfig } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { MASKED } from "@/components/WalletBalance";

// Chooses wallet vs. direct payment. `value` is "wallet" | "card".
export function usePayWith(amount) {
  const { balance } = useWallet();
  const [choice, setChoice] = useState(null);
  const enough = balance !== null && Number.isFinite(amount) && amount > 0 && balance >= amount;
  // Until the customer picks, prefer the wallet whenever it can cover the order.
  const value = choice || (enough ? "wallet" : "card");
  return { value, setValue: setChoice, enough, balance };
}

let cachedProvider = null;

export default function PaymentMethodPicker({ amount, value, onChange }) {
  const { balance, hidden } = useWallet();
  const [provider, setProvider] = useState(cachedProvider);

  useEffect(() => {
    if (cachedProvider) return;
    getAppConfig()
      .then((config) => {
        cachedProvider = config?.paymentProvider || "test";
        setProvider(cachedProvider);
      })
      .catch(() => setProvider("test"));
  }, []);

  const hasAmount = Number.isFinite(amount) && amount > 0;
  const short = balance !== null && hasAmount && balance < amount;

  const options = [
    {
      id: "wallet",
      icon: Wallet,
      title: "Wallet",
      detail: balance === null ? "Loading balance…" : `Balance ${hidden ? MASKED : formatNaira(balance)}`,
    },
    {
      id: "card",
      icon: CreditCard,
      title: provider === "paystack" ? "Card, transfer or USSD" : "Pay directly",
      detail: provider === "paystack" ? "Secured by Paystack" : "Instant checkout",
    },
  ];

  return (
    <div>
      <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.id)}
              className={`focus-ring press relative flex items-start gap-3 rounded-2xl border bg-white p-3.5 text-left ${
                selected
                  ? "border-cyan-400 bg-cyan-50 shadow-[0_0_0_1px_var(--color-cyan-400)]"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  option.id === "wallet" ? "wallet-gradient brand-contrast" : "bg-slate-100 text-ink-600"
                }`}
              >
                <option.icon size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink-900">{option.title}</span>
                <span className="mt-0.5 block truncate text-xs text-ink-500">{option.detail}</span>
              </span>
              <span
                aria-hidden="true"
                className={`absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                  selected ? "border-cyan-500 bg-cyan-500 brand-contrast" : "border-slate-300"
                }`}
              >
                {selected && <Check size={12} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      {value === "wallet" && short && (
        <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 text-xs font-medium text-amber-700">
          Your balance is {formatNaira(amount - balance)} short for this order.
          <Link href="/wallet?fund=1" className="font-bold text-cyan-700 underline underline-offset-2 hover:text-cyan-800">
            Fund wallet
          </Link>
        </p>
      )}
    </div>
  );
}
