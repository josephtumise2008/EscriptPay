"use client";

import Link from "next/link";
import { Wallet, Eye, EyeOff } from "lucide-react";
import { useWallet } from "@/lib/wallet-context";
import { formatNaira } from "@/lib/format";

// Non-breaking space: the symbol and dots always stay on one line.
export const MASKED = "₦\u00A0••••";

// "₦12,450" — or masked when the customer hid their balance.
export function BalanceAmount({ className = "", skeletonClass = "h-4 w-16" }) {
  const { balance, hidden } = useWallet();
  if (balance === null) {
    return <span aria-label="Loading balance" className={`inline-block animate-pulse rounded-md bg-slate-200 align-middle ${skeletonClass}`} />;
  }
  if (hidden) {
    return (
      <span className={`inline-flex items-center gap-1 whitespace-nowrap ${className}`} aria-label="Balance hidden">
        <span>₦</span>
        <span aria-hidden="true" className="inline-flex items-center gap-[3px]">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-[0.32em] w-[0.32em] rounded-full bg-current" />
          ))}
        </span>
      </span>
    );
  }
  return <span className={`whitespace-nowrap tabular-nums ${className}`}>{formatNaira(balance)}</span>;
}

export function HideBalanceButton({ className = "", size = 16 }) {
  const { hidden, toggleHidden } = useWallet();
  return (
    <button
      type="button"
      onClick={toggleHidden}
      aria-label={hidden ? "Show balance" : "Hide balance"}
      aria-pressed={hidden}
      className={`focus-ring inline-flex items-center justify-center rounded-full ${className}`}
    >
      {hidden ? <EyeOff size={size} aria-hidden="true" /> : <Eye size={size} aria-hidden="true" />}
    </button>
  );
}

// Header pill: wallet icon + balance (opens the wallet) and a hide toggle.
export default function WalletPill({ className = "" }) {
  return (
    <div
      className={`flex h-10 items-center rounded-full border border-slate-200 bg-white pl-1 pr-1 shadow-[0_1px_2px_rgb(15_23_42/0.04)] ${className}`}
    >
      <Link
        href="/wallet"
        aria-label="Wallet balance — open wallet"
        className="focus-ring press flex h-8 items-center gap-2 rounded-full pr-1.5"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full wallet-gradient brand-contrast shadow-[0_6px_14px_-6px_rgb(124_58_237/0.7)]">
          <Wallet size={15} aria-hidden="true" />
        </span>
        <BalanceAmount className="font-display text-sm font-extrabold text-ink-900" skeletonClass="h-3.5 w-14" />
      </Link>
      <HideBalanceButton className="h-8 w-8 text-ink-400 hover:bg-slate-100 hover:text-ink-700" size={15} />
    </div>
  );
}
