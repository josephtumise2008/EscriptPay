import { CheckCircle2, BadgeCheck, Smartphone, ReceiptText } from "lucide-react";
import Logo from "@/components/Logo";

// Illustration for "Why EscriptPay": an example receipt that shows the three
// promises — right price, right number, clear record. Clearly labelled as an
// example; it is not a real customer's order.
const ROWS = [
  { label: "Network", value: "MTN" },
  { label: "Plan", value: "1GB (Share) Weekly" },
  { label: "Phone", value: "0803 ••• 4512", tag: "Right number", icon: Smartphone },
  { label: "Amount", value: "₦500", tag: "Right price", icon: BadgeCheck, strong: true },
  { label: "Transaction ID", value: "ESCP-20261023-7F3A21", tag: "Clear record", icon: ReceiptText, mono: true },
];

export default function TrustReceipt() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0" data-reveal>
      <div aria-hidden="true" className="anim-glow absolute -inset-6 rounded-[2.5rem] bg-gradient-to-tr from-emerald-200/40 via-cyan-200/40 to-sky-200/40 blur-2xl" />

      <figure className="relative">
        <div
          className="rounded-t-3xl border border-b-0 border-slate-200/80 bg-white px-5 pb-6 pt-5 shadow-[0_40px_80px_-40px_rgb(15_23_42/0.45)] sm:px-6"
        >
          <div className="flex items-center justify-between">
            <Logo size={24} />
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-ink-500">Example receipt</span>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <span className="anim-pop flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600" style={{ animationDelay: "200ms" }}>
              <CheckCircle2 size={24} aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-ink-900">Purchase successful</p>
              <p className="text-xs text-ink-500">Payment verified · 23 Oct, 10:42</p>
            </div>
          </div>

          <div className="my-5 border-t border-dashed border-slate-200" />

          <ul className="space-y-1" data-reveal-stagger>
            {ROWS.map((row, i) => (
              <li
                key={row.label}
                style={{ "--i": i }}
                className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${row.tag ? "bg-emerald-50/60 ring-1 ring-emerald-100" : ""}`}
              >
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-400">{row.label}</span>
                  <span className={`block truncate ${row.strong ? "font-display text-lg font-extrabold text-ink-900" : "text-sm font-semibold text-ink-800"} ${row.mono ? "font-mono text-[13px]" : ""}`}>
                    {row.value}
                  </span>
                </span>
                {row.tag && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-100">
                    <row.icon size={12} aria-hidden="true" />
                    {row.tag}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Torn / perforated receipt edge */}
        <div
          aria-hidden="true"
          className="h-4 bg-white"
          style={{
            WebkitMask: "radial-gradient(circle at 10px 0, transparent 8px, #000 8.5px) 0 0 / 20px 100% repeat-x",
            mask: "radial-gradient(circle at 10px 0, transparent 8px, #000 8.5px) 0 0 / 20px 100% repeat-x",
            transform: "scaleY(-1)",
          }}
        />
        <figcaption className="sr-only">
          Example EscriptPay receipt highlighting the price, the phone number and the transaction ID.
        </figcaption>
      </figure>
    </div>
  );
}
