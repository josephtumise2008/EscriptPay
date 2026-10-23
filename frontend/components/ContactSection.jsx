"use client";

import { useEffect, useState } from "react";
import { Mail, Phone, Send, MessageSquareText, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { CONTACT } from "@/lib/data";
import { sendContactMessage, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const initial = { name: "", email: "", message: "", website: "" };

function FieldError({ name, errors }) {
  if (!errors[name]) return null;
  return (
    <p id={`contact-${name}-error`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500">
      <AlertCircle size={14} aria-hidden="true" />
      {errors[name]}
    </p>
  );
}
const MESSAGE_MAX = 2000;

// Messages are saved by the EscriptPay backend (POST /api/contact) and the
// team replies by email — the form works whether or not a public support
// email/phone has been published yet.
export default function ContactSection({ id = "contact" }) {
  const { user } = useAuth();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const [serverError, setServerError] = useState("");

  // Signed-in visitors don't need to retype their details.
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({ ...f, name: f.name || user.name || "", email: f.email || user.email || "" }));
  }, [user]);

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.message.trim().length < 10) next.message = "Tell us a little more (at least 10 characters).";
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setServerError("");
    if (Object.keys(found).length) {
      document.getElementById(`contact-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setStatus("sending");
    try {
      await sendContactMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        message: form.message.trim(),
        website: form.website,
      });
      setStatus("sent");
      setForm((f) => ({ ...initial, name: f.name, email: f.email }));
    } catch (err) {
      const field = err?.response?.data?.field;
      if (field) setErrors({ [field]: err.response.data.message });
      else setServerError(errorMessage(err, "Could not send your message. Please try again."));
      setStatus("idle");
    }
  };

  const field = (key) => ({
    value: form[key],
    onChange: (e) => {
      const value = e.target.value;
      setForm((f) => ({ ...f, [key]: value }));
      if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
      if (status === "sent") setStatus("idle");
    },
    "aria-invalid": errors[key] ? "true" : "false",
    "aria-describedby": errors[key] ? `contact-${key}-error` : undefined,
  });

  // Only real, published details are shown as contact channels.
  const channels = CONTACT.published
    ? [
        { icon: Mail, title: "Email", value: CONTACT.email, href: `mailto:${CONTACT.email}` },
        { icon: Phone, title: "Phone", value: CONTACT.phone, href: `tel:${CONTACT.phone.replace(/\s/g, "")}` },
      ]
    : [];

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
            <div className="card flex items-start gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                <MessageSquareText size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900">Message our team</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-500">
                  Send us a message with the form and we&apos;ll reply to your email address.
                </p>
              </div>
            </div>
            <div className="card flex items-start gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                <Clock size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900">About an order?</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-500">
                  Include your transaction ID (it starts with ESCP-) so we can find it quickly.
                </p>
              </div>
            </div>
            {channels.map((c) => (
              <div key={c.title} className="card flex items-center gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                  <c.icon size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">{c.title}</p>
                  <a href={c.href} className="focus-ring truncate rounded text-sm text-cyan-700 hover:underline">
                    {c.value}
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="card p-6 sm:p-8">
            <h3 className="font-display text-lg font-bold text-ink-900">Send a message</h3>
            <p className="mt-1 text-sm text-ink-500">We read every message and reply by email.</p>

            {status === "sent" ? (
              <div role="status" className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-10 text-center animate-page-in">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 size={24} aria-hidden="true" />
                </span>
                <p className="font-display text-lg font-bold text-ink-900">Message sent</p>
                <p className="max-w-sm text-sm text-ink-600">
                  Thanks, {form.name.split(" ")[0] || "there"}. We&apos;ll get back to you at {form.email}.
                </p>
                <button
                  type="button"
                  onClick={() => setStatus("idle")}
                  className="focus-ring mt-1 rounded-lg text-sm font-semibold text-cyan-700 hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
                {/* Honeypot: hidden from people and screen readers; bots fill it. */}
                <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
                  <label htmlFor="contact-website">Website</label>
                  <input id="contact-website" type="text" tabIndex={-1} autoComplete="off" {...field("website")} />
                </div>
                <div>
                  <label htmlFor="contact-name" className="mb-1.5 block text-sm font-semibold text-ink-700">Full name</label>
                  <input id="contact-name" type="text" autoComplete="name" maxLength={80} placeholder="Your name" className={`input-base ${errors.name ? "border-red-300" : ""}`} {...field("name")} />
                  <FieldError name="name" errors={errors} />
                </div>
                <div>
                  <label htmlFor="contact-email" className="mb-1.5 block text-sm font-semibold text-ink-700">Email</label>
                  <input id="contact-email" type="email" inputMode="email" autoComplete="email" maxLength={254} placeholder="you@example.com" className={`input-base ${errors.email ? "border-red-300" : ""}`} {...field("email")} />
                  <FieldError name="email" errors={errors} />
                </div>
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <label htmlFor="contact-message" className="block text-sm font-semibold text-ink-700">Message</label>
                    <span className="text-xs tabular-nums text-ink-400">{form.message.length}/{MESSAGE_MAX}</span>
                  </div>
                  <textarea id="contact-message" rows={5} maxLength={MESSAGE_MAX} placeholder="How can we help?" className={`input-base resize-none ${errors.message ? "border-red-300" : ""}`} {...field("message")} />
                  <FieldError name="message" errors={errors} />
                </div>
                {serverError && (
                  <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    {serverError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={status === "sending"}
                  aria-busy={status === "sending"}
                  className="gradient-btn focus-ring inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold brand-contrast disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === "sending" ? (
                    <span aria-hidden="true" className="brand-spin inline-block h-4 w-4 animate-spin rounded-full" />
                  ) : (
                    <Send size={16} aria-hidden="true" />
                  )}
                  {status === "sending" ? "Sending…" : "Send message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
