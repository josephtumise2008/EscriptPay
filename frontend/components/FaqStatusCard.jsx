import { CheckCircle2, Clock3, MessageCircleQuestion } from "lucide-react";

// Illustration for the FAQ intro: a question bubble, an answer bubble and a
// status board of what works today vs. what is still in test mode. Every
// item reflects the product's real current state.
const WORKS_TODAY = ["Create an account", "Browse live data prices", "Place test orders", "Receipts & purchase history"];
const COMING_NEXT = ["Real payments", "Real airtime & data delivery"];

export default function FaqStatusCard() {
  return (
    <div className="relative mx-auto mt-10 w-full max-w-md lg:mx-0" data-reveal>
      <div aria-hidden="true" className="anim-glow absolute -inset-6 rounded-[2.5rem] bg-gradient-to-tr from-cyan-200/40 via-sky-200/30 to-purple-lite-200/40 blur-2xl" />

      <figure className="relative rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_40px_80px_-40px_rgb(15_23_42/0.45)] sm:p-6">
        {/* Q & A bubbles */}
        <div className="space-y-3" data-reveal-stagger>
          <div style={{ "--i": 0 }} className="flex items-end gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-ink-500">
              <MessageCircleQuestion size={16} aria-hidden="true" />
            </span>
            <p className="rounded-2xl rounded-bl-md bg-slate-100 px-4 py-2.5 text-sm font-medium text-ink-800">
              Is EscriptPay live yet?
            </p>
          </div>
          <div style={{ "--i": 1 }} className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-br-md bg-cyan-500 px-4 py-2.5 text-sm font-medium brand-contrast">
              Not yet — here&apos;s exactly what works today.
            </p>
          </div>
        </div>

        <div className="my-5 border-t border-dashed border-slate-200" />

        {/* Status board */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-600">Works today</p>
            <ul className="mt-3 space-y-2.5" data-reveal-stagger>
              {WORKS_TODAY.map((item, i) => (
                <li key={item} style={{ "--i": i + 2 }} className="flex items-start gap-2 text-sm text-ink-800">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-600">Still in test mode</p>
            <ul className="mt-3 space-y-2.5" data-reveal-stagger>
              {COMING_NEXT.map((item, i) => (
                <li key={item} style={{ "--i": i + 6 }} className="flex items-start gap-2 text-sm text-ink-800">
                  <Clock3 size={16} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <figcaption className="sr-only">What works on EscriptPay today and what is still in test mode.</figcaption>
      </figure>
    </div>
  );
}
