"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  FileText,
  ListChecks,
  Lock,
  ReceiptText,
  Smartphone,
  Wallet,
  Wifi,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FAQAccordion from "@/components/FAQAccordion";
import ContactSection from "@/components/ContactSection";
import { useRevealObserver } from "@/hooks/useRevealObserver";
import { useAuth } from "@/lib/auth-context";
import { getPlans } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import Image from "next/image";
import PhoneFrame from "@/components/PhoneFrame";
import TrustReceipt from "@/components/TrustReceipt";
import { HERO_PHOTO } from "@/lib/data";

const NETWORKS = [
  { name: "MTN", dot: "bg-yellow-400" },
  { name: "Airtel", dot: "bg-red-500" },
  { name: "Glo", dot: "bg-emerald-500" },
  { name: "9mobile", dot: "bg-lime-500" },
];

const STEPS = [
  {
    icon: Smartphone,
    title: "Choose a network",
    body: "MTN, Airtel, Glo or 9mobile — then pick a data bundle or enter an airtime amount.",
  },
  {
    icon: ListChecks,
    title: "Check the order",
    body: "Enter the phone number and review the exact price, network and plan before you confirm.",
  },
  {
    icon: ReceiptText,
    title: "Track and keep a receipt",
    body: "Follow payment and delivery status in your history, with a printable receipt for every order.",
  },
];

const BENEFITS = [
  {
    icon: Wallet,
    title: "Prices set on our server",
    body: "The amount you see is calculated by EscriptPay for every order, so it can't be altered in your browser.",
  },
  {
    icon: BadgeCheck,
    title: "Payment verified before delivery",
    body: "Orders are only processed after the server confirms the payment with the provider — never on a redirect alone.",
  },
  {
    icon: FileText,
    title: "A record of every purchase",
    body: "Transaction IDs, receipts, search and filters keep your purchase history easy to check.",
  },
  {
    icon: Lock,
    title: "Account security basics done right",
    body: "Hashed passwords, a secure session cookie, and card details handled by the payment provider — not by us.",
  },
];

const NETWORK_BADGE = {
  MTN: { letter: "M", cls: "bg-yellow-400 text-yellow-950" },
  Airtel: { letter: "A", cls: "bg-red-500 brand-contrast" },
  Glo: { letter: "G", cls: "bg-emerald-500 brand-contrast" },
  "9mobile": { letter: "9", cls: "bg-lime-500 text-lime-950" },
};

// Mini EscriptPay app screen shown inside the hero phone, using the live plan
// catalogue. Cycles through networks on its own until the visitor taps one.
function PhoneApp({ rows = 4 }) {
  const [plans, setPlans] = useState(null);
  const [failed, setFailed] = useState(false);
  const [network, setNetwork] = useState("MTN");
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    let active = true;
    getPlans()
      .then((all) => active && setPlans(all || []))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!auto || !plans) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const names = NETWORKS.map((n) => n.name);
    const timer = setInterval(() => {
      setNetwork((current) => names[(names.indexOf(current) + 1) % names.length]);
    }, 3600);
    return () => clearInterval(timer);
  }, [auto, plans]);

  const visible = useMemo(
    () => (plans || []).filter((p) => p.network === network).sort((a, b) => a.price - b.price).slice(0, rows),
    [plans, network, rows]
  );

  return (
    <div className="px-4 pb-4 pt-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium text-ink-500">EscriptPay</p>
          <p className="font-display text-[17px] font-bold leading-tight text-ink-900">Buy data</p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 text-[10px] font-bold brand-contrast">
          EP
        </span>
      </div>

      <div role="tablist" aria-label="Network" className="mt-4 grid grid-cols-4 gap-1.5">
        {NETWORKS.map((n) => {
          const selected = n.name === network;
          const badge = NETWORK_BADGE[n.name];
          return (
            <button
              key={n.name}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setAuto(false);
                setNetwork(n.name);
              }}
              className={`focus-ring flex flex-col items-center gap-1 rounded-xl py-2 transition-[background-color,box-shadow] duration-300 ${
                selected ? "bg-white shadow-[0_6px_16px_-8px_rgb(15_23_42/0.35)] ring-1 ring-cyan-200" : "hover:bg-white/60"
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full font-display text-[13px] font-extrabold transition-transform duration-300 ${badge.cls} ${
                  selected ? "scale-110" : "scale-100 opacity-80"
                }`}
              >
                {badge.letter}
              </span>
              <span className={`text-[10px] font-semibold ${selected ? "text-ink-900" : "text-ink-500"}`}>{n.name}</span>
            </button>
          );
        })}
      </div>

      <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">Popular {network} plans</p>

      <div style={{ minHeight: `${rows * 3.25}rem` }}>
        {failed ? (
          <p className="flex items-center justify-center pt-10 text-center text-xs text-ink-500">Prices are unavailable right now.</p>
        ) : !plans ? (
          <ul className="space-y-1.5" aria-label="Loading prices">
            {Array.from({ length: rows }).map((_, i) => (
              <li key={i} className="h-[2.85rem] animate-pulse rounded-xl bg-white" />
            ))}
          </ul>
        ) : visible.length === 0 ? (
          <p className="pt-10 text-center text-xs text-ink-500">No {network} plans yet.</p>
        ) : (
          <ul key={network} className="space-y-1.5">
            {visible.map((p, i) => (
              <li
                key={p._id}
                style={{ animationDelay: `${i * 60}ms` }}
                className="flex animate-fade-up items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-ink-900">{p.name}</span>
                  <span className="block text-[10.5px] text-ink-500">{p.validity}</span>
                </span>
                <span className="shrink-0 font-display text-[13px] font-bold text-ink-900">{formatNaira(p.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href={`/buy-data?network=${encodeURIComponent(network)}`}
        className="gradient-btn focus-ring mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold brand-contrast"
      >
        Buy {network} data
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}

function PhoneScreen({ rows }) {
  return <PhoneApp rows={rows} />;
}

// Subtle 3D tilt that follows the pointer (desktop mice only, never with
// reduced motion). Writes CSS variables directly — no React re-renders.
function useTilt() {
  const stageRef = useRef(null);
  const cardRef = useRef(null);
  useEffect(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card) return undefined;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return undefined;
    let frame = 0;
    const onMove = (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        card.style.setProperty("--tilt-y", `${(x * 12).toFixed(2)}deg`);
        card.style.setProperty("--tilt-x", `${(-y * 10).toFixed(2)}deg`);
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
    };
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  return { stageRef, cardRef };
}

function FloatingNote({ icon: Icon, title, body, className, delay, floatDelay }) {
  return (
    <div className={`absolute z-10 hidden lg:block ${className}`}>
      <div className="anim-pop" style={{ animationDelay: delay }}>
        <div
          className="anim-float flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-3.5 py-3 shadow-[0_24px_50px_-24px_rgb(15_23_42/0.45)] backdrop-blur"
          style={{ animationDelay: floatDelay }}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Icon size={18} aria-hidden="true" />
          </span>
          <span>
            <span className="block whitespace-nowrap text-[13px] font-semibold text-ink-900">{title}</span>
            <span className="block whitespace-nowrap text-[11px] text-ink-500">{body}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// Hero visual: the real price list inside a phone. With a hero photo
// configured (lib/data.js → HERO_PHOTO), the phone overlaps the photo.
function HeroVisual() {
  const { stageRef, cardRef } = useTilt();

  if (HERO_PHOTO.src) {
    return (
      <div className="relative mx-auto w-full max-w-[26rem] pb-16 sm:pb-10">
        <div aria-hidden="true" className="anim-glow absolute -inset-8 rounded-[3rem] bg-gradient-to-tr from-cyan-300/40 via-sky-200/30 to-purple-lite-300/40 blur-3xl" />
        <div className="anim-rise relative ml-auto aspect-[4/5] w-[86%] overflow-hidden rounded-[2rem] border border-white/40 shadow-[0_40px_90px_-40px_rgb(15_23_42/0.6)]">
          <Image src={HERO_PHOTO.src} alt={HERO_PHOTO.alt} fill priority sizes="(min-width: 1024px) 26rem, 86vw" className="object-cover" />
        </div>
        <div className="anim-rise absolute -left-1 bottom-0 w-[54%] sm:-left-4" style={{ animationDelay: "180ms" }}>
          <PhoneFrame>
            <PhoneScreen rows={3} />
          </PhoneFrame>
        </div>
      </div>
    );
  }

  return (
    <div ref={stageRef} className="tilt-stage relative mx-auto w-full max-w-[16rem] sm:max-w-[17rem] lg:mr-0 lg:ml-auto lg:max-w-[30rem]">
      <div aria-hidden="true" className="anim-glow absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-300/50 via-sky-200/40 to-purple-lite-300/50 blur-3xl lg:left-1/3" />
      {/* Phone sits on the right on desktop; the notes fill the space to its
          left, overlapping only the bezel edge — never the screen content. */}
      <div className="anim-rise relative mx-auto w-[16rem] sm:w-[17rem] lg:mr-6 lg:ml-auto" style={{ animationDelay: "120ms" }}>
        <div ref={cardRef} className="tilt-card">
          <PhoneFrame>
            <PhoneScreen rows={4} />
          </PhoneFrame>
        </div>
        <FloatingNote
          icon={BadgeCheck}
          title="Price shown upfront"
          body="Set by the server, not the browser"
          className="right-[calc(100%-0.5rem)] top-[22%]"
          delay="700ms"
          floatDelay="0s"
        />
        <FloatingNote
          icon={ReceiptText}
          title="Receipt for every order"
          body="Transaction ID and status"
          className="right-[calc(100%-0.5rem)] bottom-[18%] mr-8"
          delay="900ms"
          floatDelay="-3s"
        />
      </div>
    </div>
  );
}

export default function HomePage() {
  useRevealObserver();
  const { user } = useAuth();
  const [planCount, setPlanCount] = useState(null);

  useEffect(() => {
    getPlans()
      .then((all) => setPlanCount((all || []).length))
      .catch(() => setPlanCount(null));
  }, []);

  const facts = [
    ["4", "Networks"],
    [planCount ? String(planCount) : "—", "Data plans"],
    ["₦100+", "Airtime from"],
  ];

  return (
    <>
      <Navbar />

      <main>
        {/* Hero */}
        <section aria-labelledby="hero-heading" className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-cyan-200/35 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-40 top-10 h-[30rem] w-[30rem] rounded-full bg-purple-lite-200/35 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.2fr_1fr] lg:gap-8 lg:px-8 lg:pb-20 lg:pt-12">
            <div className="text-center lg:text-left">
              <p className="anim-pop inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-ink-600">
                <Wifi size={14} className="text-cyan-600" aria-hidden="true" />
                Airtime &amp; data for Nigerian networks
              </p>
              <h1
                id="hero-heading"
                className="mt-6 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl lg:text-[3.6rem]"
              >
                <span className="anim-line" style={{ animationDelay: "80ms" }}>Top up any Nigerian</span>
                <span className="anim-line" style={{ animationDelay: "180ms" }}>
                  line with <span className="gradient-text anim-shine">clear prices</span>
                </span>
                <span className="anim-line" style={{ animationDelay: "280ms" }}>and a receipt.</span>
              </h1>
              <p className="anim-line mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-500 sm:text-lg lg:mx-0" style={{ animationDelay: "380ms" }}>
                Choose MTN, Airtel, Glo or 9mobile, pick a bundle or amount, and see exactly what you&apos;ll pay before you confirm.
              </p>

              <div className="anim-pop mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start" style={{ animationDelay: "480ms" }}>
                {user ? (
                  <>
                    <Link href="/buy-data" className="gradient-btn focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold brand-contrast">
                      Buy data <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                    <Link href="/buy-airtime" className="focus-ring btn-secondary px-6 py-3.5">
                      Buy airtime
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/signup" className="gradient-btn focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold brand-contrast">
                      Create free account <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                    <Link href="/#how-it-works" className="focus-ring btn-secondary px-6 py-3.5">
                      See how it works
                    </Link>
                  </>
                )}
              </div>

              <dl style={{ animationDelay: "580ms" }} className="anim-pop mx-auto mt-10 grid max-w-md grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 pt-6 lg:mx-0">
                {facts.map(([value, label]) => (
                  <div key={label} className="flex flex-col items-center px-2 lg:items-start lg:px-0 lg:pl-5 lg:first:pl-0">
                    <dt className="order-2 mt-1 whitespace-nowrap text-xs text-ink-500">{label}</dt>
                    <dd className="order-1 whitespace-nowrap font-display text-2xl font-bold leading-none text-ink-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="w-full">
              <HeroVisual />
            </div>
          </div>
        </section>

        {/* Networks */}
        <section aria-label="Supported networks" className="border-y border-slate-200/70 bg-white/50">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
            <p className="text-sm font-medium text-ink-500">Supported networks</p>
            <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {NETWORKS.map((n) => (
                <li key={n.name} className="flex items-center gap-2 font-display text-base font-bold text-ink-800">
                  <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${n.dot}`} />
                  {n.name}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl text-center" data-reveal>
            <p className="text-sm font-semibold uppercase tracking-wider text-cyan-600">How it works</p>
            <h2 id="how-heading" className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              Three steps, no surprises
            </h2>
          </div>
          <ol className="mt-12 grid gap-5 md:grid-cols-3" data-reveal-stagger>
            {STEPS.map((step, i) => (
              <li key={step.title} style={{ "--i": i }} className="card relative p-6 hover:shadow-[var(--shadow-card-hover)]">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                    <step.icon size={20} aria-hidden="true" />
                  </span>
                  <span className="font-display text-sm font-bold text-ink-300">0{i + 1}</span>
                </div>
                <h3 className="mt-5 font-display text-lg font-bold text-ink-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Why EscriptPay */}
        <section id="why-escriptpay" aria-labelledby="why-heading" className="border-y border-slate-200/70 bg-white/60 py-20 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-cyan-600">Why EscriptPay</p>
              <h2 id="why-heading" className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
                Built to be trusted with small, everyday payments
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-500 sm:text-base">
                Buying airtime should be boring in the best way: the right price, the right number, and a clear record afterwards.
              </p>
              <div className="mt-10">
                <TrustReceipt />
              </div>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2" data-reveal-stagger>
              {BENEFITS.map((b, i) => (
                <li key={b.title} style={{ "--i": i }} className="card p-6 hover:shadow-[var(--shadow-card-hover)]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-ink-700">
                    <b.icon size={19} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-display text-base font-bold text-ink-900">{b.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{b.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-heading" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <FAQAccordion />
        </section>

        {/* Contact */}
        <div className="border-t border-slate-200/70 bg-white/40 px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <ContactSection />
        </div>

        {/* Closing call to action */}
        <section aria-labelledby="cta-heading" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-ink-900 px-6 py-12 text-center sm:px-12 dark:bg-slate-100" data-reveal>
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(124_58_237/0.4),transparent)]" />
            <h2 id="cta-heading" className="relative font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl dark:text-ink-900">
              Ready to try EscriptPay?
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-sm text-slate-300 sm:text-base dark:text-ink-500">
              Create an account and walk through a test purchase — it takes about a minute.
            </p>
            <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={user ? "/dashboard" : "/signup"} className="gradient-btn focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold brand-contrast">
                {user ? "Go to dashboard" : "Create free account"} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
