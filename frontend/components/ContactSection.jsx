"use client";

import { useState } from "react";
import { Mail, Phone, Send, Info } from "lucide-react";
import { CONTACT } from "@/lib/data";

const initial = { name: "", email: "", message: "" };

// The form opens the visitor's own email app with the message filled in
// (mailto:) — there is no server-side mail sending. While the official
// address is not published, the form is disabled and says why, so nobody
// writes to an address that may not reach the team.
export default function ContactSection({ id = "contact" }) {
  const [form, setForm] = useState(initial);
  const [opened, setOpened] = useState(false);
  const live = CONTACT.published;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!live) return;
    const subject = encodeURIComponent(`EscriptPay enquiry from ${form.name}`);
    const body = encodeURIComponent(`${form.message}\n\n— ${form.name} (${form.email})`);
    window.location.href = `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
    setOpened(true);
  };

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
    disabled: !live,
  });

  const channels = [
    { icon: Mail, title: "Email", value: CONTACT.email, href: live ? `mailto:${CONTACT.email}` : null },
    { icon: Phone, title: "Phone", value: CONTACT.phone, href: live ? `tel:${CONTACT.phone.replace(/\s/g, "")}` : null },
  ];

  return (
    <section id={id} aria-labelledby="contact-heading">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center" data-reveal>
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan-600">Contact</p>
          <h2 id="contact-heading" className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            Get in touch
          </h2>
          <p className="mt-3 text-sm text-ink-500 sm:text-base">
            Questions about an order, the platform or partnering with us.
          </p>
        </div>

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[1fr_1.4fr]" data-reveal>
          <div className="space-y-3">
            {channels.map((c) => (
              <div key={c.title} className="card flex items-center gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                  <c.icon size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">{c.title}</p>
                  {c.href ? (
                    <a href={c.href} className="focus-ring truncate rounded text-sm text-cyan-700 hover:underline">
                      {c.value}
                    </a>
                  ) : (
                    <p className="truncate text-sm text-ink-500">
                      {c.value} <span className="text-ink-400">(placeholder)</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
            {!live && (
              <p className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
                <Info size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
                Official support details haven&apos;t been published yet. The contact form will open once they are.
              </p>
            )}
          </div>

          <div className="card p-6 sm:p-8">
            <h3 className="font-display text-lg font-bold text-ink-900">Send a message</h3>
            <p className="mt-1 text-sm text-ink-500">
              {live ? "This opens your email app with your message ready to send." : "Available once official contact details are published."}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="contact-name" className="mb-1.5 block text-sm font-semibold text-ink-700">Full name</label>
                <input id="contact-name" type="text" required autoComplete="name" placeholder="Your name" className="input-base disabled:cursor-not-allowed disabled:opacity-60" {...field("name")} />
              </div>
              <div>
                <label htmlFor="contact-email" className="mb-1.5 block text-sm font-semibold text-ink-700">Email</label>
                <input id="contact-email" type="email" required autoComplete="email" placeholder="you@example.com" className="input-base disabled:cursor-not-allowed disabled:opacity-60" {...field("email")} />
              </div>
              <div>
                <label htmlFor="contact-message" className="mb-1.5 block text-sm font-semibold text-ink-700">Message</label>
                <textarea id="contact-message" required rows={4} placeholder="How can we help?" className="input-base resize-none disabled:cursor-not-allowed disabled:opacity-60" {...field("message")} />
              </div>
              <button
                type="submit"
                disabled={!live}
                className="gradient-btn focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold brand-contrast disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={16} aria-hidden="true" />
                {live ? "Open in email app" : "Contact form not available yet"}
              </button>
              {opened && (
                <p role="status" className="text-center text-xs text-ink-500">
                  Your email app should have opened. If it didn&apos;t, write to {CONTACT.email}.
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
