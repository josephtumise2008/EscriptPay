"use client";

import { useState } from "react";
import { ChevronDown, MessageCircleQuestion } from "lucide-react";
import { FAQ_ITEMS } from "@/lib/data";
import { useRevealObserver } from "@/hooks/useRevealObserver";

export default function FAQAccordion() {
  useRevealObserver();
  const [open, setOpen] = useState(0);

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center" data-reveal>
        <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-cyan-700 ring-1 ring-cyan-100">
          <MessageCircleQuestion size={14} />
          Have questions?
        </span>
        <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          Frequently Asked{" "}
          <span className="gradient-text">Questions</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-ink-500 sm:text-base">
          Everything you need to know about buying data with EscriptPay.
        </p>
      </div>

      <div className="w-full max-w-3xl space-y-3">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              data-reveal
              style={{ transitionDelay: `${(i % 4) * 40}ms` }}
              className={`card overflow-hidden transition-shadow duration-300 ${
                isOpen ? "shadow-[var(--shadow-card-hover)] border-cyan-100" : ""
              }`}
            >
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-button-${i}`}
                  className="focus-ring flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors duration-200 ${
                        isOpen
                          ? "gradient-btn brand-contrast"
                          : "bg-cyan-50 text-cyan-700"
                      }`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm font-semibold text-ink-800 sm:text-[15px]">
                      {item.question}
                    </span>
                  </span>
                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className={`shrink-0 text-ink-400 transition-transform duration-300 ${
                      isOpen ? "rotate-180 text-cyan-500" : ""
                    }`}
                  />
                </button>
              </h3>
              <div
                id={`faq-panel-${i}`}
                role="region"
                aria-labelledby={`faq-button-${i}`}
                className={`grid transition-all duration-300 ease-in-out ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 pl-16 text-sm leading-relaxed text-ink-600">
                    {item.answer}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}