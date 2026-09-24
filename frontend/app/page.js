"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Zap,
  ShieldCheck,
  Headset,
  Wifi,
  ArrowRight,
  Smartphone,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FAQAccordion from "@/components/FAQAccordion";
import ContactSection from "@/components/ContactSection";
import { useRevealObserver } from "@/hooks/useRevealObserver";
import { getPlans } from "@/lib/api";
import { formatNaira } from "@/lib/format";

const NETWORKS = [
  { name: "MTN", color: "bg-yellow-400", text: "text-yellow-600" },
  { name: "Airtel", color: "bg-red-500", text: "text-red-500" },
  { name: "Glo", color: "bg-emerald-500", text: "text-emerald-600" },
  { name: "9mobile", color: "bg-lime-500", text: "text-lime-600" },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Fast",
    description:
      "Plans delivered in seconds after every successful order. No long queues, no waiting.",
    accent: "from-cyan-500 to-sky-500",
  },
  {
    icon: Smartphone,
    title: "Simple",
    description:
      "Pick your network, choose a bundle, enter a number and buy. It's that easy.",
    accent: "from-sky-500 to-indigo-500",
  },
  {
    icon: ShieldCheck,
    title: "Reliable",
    description:
      "Clear prices, transparent orders and a support team that actually responds.",
    accent: "from-purple-lite-400 to-purple-lite-600",
  },
];

export default function HomePage() {
  useRevealObserver();
  const [plans, setPlans] = useState(null);

  useEffect(() => {
    let active = true;
    getPlans()
      .then((all) => {
        if (!active) return;
        const mtn = (all || []).filter((p) => p.network.toLowerCase() === "mtn");
        setPlans(mtn);
      })
      .catch(() => {
        // Landing page stays graceful if the API is unreachable.
        if (active) setPlans([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const previewPlans = (plans?.slice(0, 6)) || null;

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section aria-labelledby="hero-heading" className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -left-24 h-[30rem] w-[30rem] rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="pointer-events-none absolute top-20 -right-24 h-[28rem] w-[28rem] rounded-full bg-purple-lite-200/40 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:px-8">
          <div className="text-center lg:text-left" data-reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-cyan-700 ring-1 ring-cyan-100 shadow-sm">
              <Wifi size={14} />
              Nigerian data &amp; airtime vending
            </span>
            <h1
              id="hero-heading"
              className="mt-6 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl"
            >
              Buy Data. <span className="gradient-text">Stay</span> Connected.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base text-ink-500 sm:text-lg lg:mx-0">
              Fast, simple and reliable data purchases with EscriptPay. Choose your
              network and get connected in seconds.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/buy-data"
                className="gradient-btn focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold brand-contrast"
              >
                Buy Data
                <ArrowRight size={17} />
              </Link>
              <Link
                href="/signup"
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-sm font-semibold text-ink-700 shadow-sm transition-all duration-200 hover:border-cyan-300 hover:text-cyan-700"
              >
                Create Account
              </Link>
            </div>

            <dl className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 lg:justify-start">
              {[
                ["4+", "Networks"],
                [plans ? `${plans.length}+` : "18+", "MTN plans"],
                ["24/7", "Support"],
              ].map(([num, label]) => (
                <div key={label} className="text-center lg:text-left">
                  <dt className="sr-only">{label}</dt>
                  <dd className="font-display text-2xl font-extrabold gradient-text">{num}</dd>
                  <dd className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Hero phone mock */}
          <div className="relative mx-auto w-full max-w-sm" data-reveal style={{ transitionDelay: "120ms" }}>
            <div className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gradient-to-tr from-cyan-200/40 via-sky-200/40 to-purple-lite-200/40 blur-2xl" />
            <div className="relative rounded-[2rem] border border-slate-100 bg-white p-4 shadow-[var(--shadow-card-hover)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="font-display text-base font-extrabold text-ink-900">Buy Data</p>
                  <p className="text-xs text-ink-400">MTN bundles</p>
                </div>
                <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700 ring-1 ring-cyan-100">
                  MTN
                </span>
              </div>
              <ul className="space-y-2.5">
                {previewPlans
                  ? previewPlans.map((p) => (
                      <li
                        key={p._id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5 transition-colors hover:border-cyan-200"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-800">{p.name}</p>
                          <p className="flex items-center gap-1 text-[11px] text-ink-400">
                            <CalendarDays size={11} /> {p.validity}
                          </p>
                        </div>
                        <p className="shrink-0 font-display text-sm font-extrabold gradient-text">
                          {formatNaira(p.price)}
                        </p>
                      </li>
                    ))
                  : Array.from({ length: 6 }).map((_, i) => (
                      <li
                        key={i}
                        className="flex animate-pulse items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5"
                      >
                        <div className="h-4 w-32 rounded bg-slate-200" />
                        <div className="h-4 w-14 rounded bg-slate-200" />
                      </li>
                    ))}
              </ul>
              <Link
                href="/buy-data"
                className="gradient-btn focus-ring mt-4 w-full rounded-xl px-4 py-3 text-center text-sm font-bold brand-contrast"
              >
                BUY NOW
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Networks */}
      <section aria-labelledby="networks-heading" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="card card-hover" data-reveal>
          <div className="flex flex-col items-center justify-between gap-4 p-6 sm:flex-row">
            <div>
              <h2 id="networks-heading" className="font-display text-lg font-bold text-ink-800">
                Supported Networks
              </h2>
              <p className="mt-1 text-sm text-ink-500">Buy data on all major Nigerian networks.</p>
            </div>
            <ul className="flex items-center gap-4">
              {NETWORKS.map((n) => (
                <li key={n.name} className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${n.color}`} />
                  <span className={`text-sm font-bold ${n.text}`}>{n.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Why EscriptPay */}
      <section id="why-escriptpay" aria-labelledby="why-heading" className="scroll-mt-20 bg-gradient-to-b from-slate-50 to-purple-lite-100/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center" data-reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-cyan-700 ring-1 ring-cyan-100">
              Why EscriptPay
            </span>
            <h2 id="why-heading" className="mt-4 font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              Data buying, <span className="gradient-text">made effortless</span>
            </h2>
            <p className="mt-3 text-sm text-ink-500 sm:text-base">
              Built for people who want to stay online without the stress.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                data-reveal
                style={{ transitionDelay: `${i * 90}ms` }}
                className="card card-hover p-7"
              >
                <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr ${f.accent} brand-contrast shadow-md`}>
                  <f.icon size={22} aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold text-ink-800">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard / purchasing preview */}
      <section aria-labelledby="preview-heading" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div data-reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-purple-lite-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-purple-lite-600 ring-1 ring-purple-lite-200">
              <Headset size={14} />
              Full dashboard
            </span>
            <h2 id="preview-heading" className="mt-4 font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              Everything you need, on <span className="gradient-text">one screen</span>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-500 sm:text-base">
              Track recent transactions, view your weekly activity and jump straight
              into buying data or airtime — all from a clean, modern dashboard.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Buy data for MTN, Airtel, Glo and 9mobile",
                "Live plans pulled straight from the API",
                "Transaction history, filters and search",
                "Real-time order summary before you pay",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-ink-700">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-cyan-500" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link
                href="/signup"
                className="gradient-btn focus-ring inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold brand-contrast"
              >
                Create your account
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>

          <div data-reveal style={{ transitionDelay: "120ms" }}>
            <div className="relative rounded-2xl border border-slate-100 bg-white p-5 shadow-[var(--shadow-card)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-bold text-ink-800">Your dashboard</p>
                  <p className="text-xs text-ink-400">Manage your account and purchases.</p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
                  Test mode
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Wallet", "—"],
                  ["Transactions", "0"],
                  ["Successful", "0"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-3">
                    <p className="text-[11px] text-ink-400">{label}</p>
                    <p className="mt-0.5 font-display text-sm font-extrabold text-ink-800">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-ink-800">MTN · 1GB (Share) Weekly</p>
                  <p className="text-[11px] text-ink-400">0803••••123 · Example purchase</p>
                </div>
                <p className="font-display text-sm font-extrabold gradient-text">₦500</p>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-100 to-purple-lite-100 text-cyan-600">
                  <Wifi size={17} />
                </div>
                <div>
                  <p className="text-sm font-bold text-ink-800">Buy Data</p>
                  <p className="text-[11px] text-ink-400">Pick a plan and place a test order.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" aria-label="FAQ" className="scroll-mt-20 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <FAQAccordion />
      </section>

      {/* Contact */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
        <ContactSection />
      </section>

      <Footer />
    </>
  );
}