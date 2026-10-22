import Link from "next/link";
import { Wifi } from "lucide-react";
import { formatNaira, formatDateTime, maskPhone } from "@/lib/format";

const STATUS_STYLES = {
  successful:
    "bg-emerald-50 text-emerald-600 ring-emerald-100",
  pending: "bg-amber-50 text-amber-600 ring-amber-100",
  failed: "bg-red-50 text-red-500 ring-red-100",
};

const STATUS_LABELS = {
  successful: "Successful",
  pending: "Pending",
  failed: "Failed",
};

export default function TransactionCard({ transaction, demo = false }) {
  const status = transaction.status || "pending";
  const date = transaction.createdAt || transaction.date;
  const href = `/history/${transaction._id}`;

  return (
    <Link
      href={href}
      aria-label={`View details for ${transaction.transactionId}`}
      className="card card-hover focus-ring flex items-center gap-4 p-4 animate-fade-up"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-100 to-purple-lite-100 text-cyan-600">
        <Wifi size={20} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="text-sm font-bold text-ink-800">{transaction.network}</p>
          {demo && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-400">
              Demo
            </span>
          )}
        </div>
        <p className="truncate text-sm text-ink-500">
          {transaction.plan} · {maskPhone(transaction.phone)}
        </p>
      </div>

      <div className="hidden text-right sm:block">
        <p className="text-sm font-bold text-ink-800">{formatNaira(transaction.amount)}</p>
        <p className="text-xs text-ink-400">{formatDateTime(date)}</p>
      </div>

      <span
        className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 sm:inline-flex ${
          STATUS_STYLES[status] || STATUS_STYLES.pending
        }`}
      >
        {STATUS_LABELS[status] || status}
      </span>

      <div className="flex shrink-0 flex-col items-end gap-1 sm:hidden">
        <p className="text-sm font-bold text-ink-800">{formatNaira(transaction.amount)}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
            STATUS_STYLES[status] || STATUS_STYLES.pending
          }`}
        >
          {STATUS_LABELS[status] || status}
        </span>
      </div>
    </Link>
  );
}