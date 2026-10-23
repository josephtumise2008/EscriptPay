"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { FAQ_ITEMS } from "@/lib/data";
import FaqStatusCard from "@/components/FaqStatusCard";

// Accessible accordion: real buttons with aria-expanded/aria-controls, one
// panel open at a time, height animated via grid rows (no JS measuring).
export default function FAQAccordion() {
  const [open, setOpen] = useState(0);

  return (
    <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="text-sm font-semibold uppercase tracking-wider text-cyan-600">FAQ</p>
        <h2 id="faq-heading" className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          Questions, answered
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-500 sm:text-base">
          What to expect when buying data and airtime with EscriptPay — including what works today and what is still in test mode.
        </p>
        <FaqStatusCard />
      </div>

      <div className="divide-y divide-slate-200 border-y border-slate-200" data-reveal>
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.question}>
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-button-${i}`}
                  className="focus-ring group flex w-full items-center justify-between gap-4 rounded-lg py-5 text-left"
                >
                  <span className="text-[15px] font-semibold text-ink-900 group-hover:text-cyan-700 sm:text-base">
                    {item.question}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-[transform,background-color,border-color] duration-200 ${
                      isOpen ? "rotate-45 border-cyan-400 bg-cyan-50 text-cyan-700" : "border-slate-200 text-ink-500"
                    }`}
                  >
                    <Plus size={16} />
                  </span>
                </button>
              </h3>
              <div
                id={`faq-panel-${i}`}
                role="region"
                aria-labelledby={`faq-button-${i}`}
                className={`grid transition-[grid-template-rows,opacity] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden" inert={!isOpen}>
                  <p className="pb-5 pr-12 text-sm leading-relaxed text-ink-600 sm:text-[15px]">{item.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
