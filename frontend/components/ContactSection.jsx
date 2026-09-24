"use client";

import { useState } from "react";
import { Mail, Phone, Headset, Send, CheckCircle2 } from "lucide-react";
import { CONTACT_PLACEHOLDERS } from "@/lib/data";
import { useRevealObserver } from "@/hooks/useRevealObserver";

const CHANNELS = [
  {
    icon: Mail,
    title: "Email",
    value: CONTACT_PLACEHOLDERS.email,
    note: "We reply within 1 business day",
  },
  {
    icon: Phone,
    title: "Phone",
    value: CONTACT_PLACEHOLDERS.phone,
    note: CONTACT_PLACEHOLDERS.supportHours,
  },
  {
    icon: Headset,
    title: "Support",
    value: "Help centre",
    note: "Guides, FAQs and troubleshooting",
  },
];

const initial = { name: "", email: "", message: "" };

export default function ContactSection({ id = "contact" }) {
  useRevealObserver();
  const [form, setForm] = useState(initial);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSending(true);
    // V1: no mail backend — simulate a friendly acknowledgement.
    setTimeout(() => {
      setSending(false);
      setSent(true);
      setForm(initial);
      setTimeout(() => setSent(false), 4000);
    }, 900);
  };

  return (
    <section id={id} aria-labelledby="contact-heading" className="scroll-mt-20">
      <div className="mx-auto max-w-5xl">
        <div className="text-center" data-reveal>
          <span className="inline-flex items-center gap-2 rounded-full bg-purple-lite-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-purple-lite-600 ring-1 ring-purple-lite-200">
            Want to reach us?
          </span>
          <h2 id="contact-heading" className="mt-4 font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            Get in <span className="gradient-text">touch</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-ink-500 sm:text-base">
            Our team is here to help with purchases, reseller questions or anything else.
          </p>
        </div>

        <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            {CHANNELS.map((c, i) => (
              <div
                key={c.title}
                data-reveal
                style={{ transitionDelay: `${i * 70}ms` }}
                className="card card-hover flex items-start gap-4 p-5"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-100 to-purple-lite-100 text-cyan-600">
                  <c.icon size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-base font-bold text-ink-800">{c.title}</p>
                  <p className="truncate text-sm text-ink-500">{c.value}</p>
                  {c.note && <p className="mt-0.5 text-xs text-ink-400">{c.note}</p>}
                </div>
              </div>
            ))}
            <p
              data-reveal
              style={{ transitionDelay: "220ms" }}
              className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700 ring-1 ring-amber-100"
            >
              The email and phone above are <strong>temporary placeholders</strong>.
              Official details will replace them soon.
            </p>
          </div>

          <div className="card card-hover p-6 sm:p-8" data-reveal style={{ transitionDelay: "100ms" }}>
            <h3 className="font-display text-lg font-bold text-ink-900">Send us a message</h3>
            <p className="mt-1 text-sm text-ink-500">
              Fill in the form and we&apos;ll get back to you.
            </p>

            {sent ? (
              <div
                role="status"
                className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-10 text-center"
              >
                <CheckCircle2 size={34} className="text-emerald-500" />
                <p className="font-display text-lg font-bold text-emerald-700">Message received!</p>
                <p className="text-sm text-emerald-600">
                  Thanks for reaching out — we&apos;ll respond as soon as possible.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="contact-name" className="mb-1.5 block text-sm font-semibold text-ink-700">
                    Full Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                    className="input-base"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="mb-1.5 block text-sm font-semibold text-ink-700">
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                    className="input-base"
                  />
                </div>
                <div>
                  <label htmlFor="contact-message" className="mb-1.5 block text-sm font-semibold text-ink-700">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    placeholder="How can we help?"
                    className="input-base resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="gradient-btn focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold brand-contrast disabled:opacity-60"
                >
                  <Send size={16} />
                  {sending ? "Sending..." : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}