"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  FileText,
  ListChecks,
  Lock,
  ReceiptText,
  Smartphone,
  Wallet,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FAQAccordion from "@/components/FAQAccordion";
import ContactSection from "@/components/ContactSection";
import { useRevealObserver } from "@/hooks/useRevealObserver";
import { useAuth } from "@/lib/auth-context";
import { getPlans } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import InstallApp from "@/components/InstallApp";
import ServicesShowcase from "@/components/ServicesShowcase";
import PriceBoard from "@/components/PriceBoard";

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

export default function HomePage() {
  useRevealObserver();
  const { user } = useAuth();
  const [catalogue, setCatalogue] = useState(null);

  useEffect(() => {
    getPlans()
      .then((all) => setCatalogue(all || []))
      .catch(() => setCatalogue(null));
  }, []);

  // Live numbers from the real price list (never hard-coded).
  const planCount = catalogue ? catalogue.length : null;
  const cheapest1GB = useMemo(() => {
    const oneGB = (catalogue || []).filter((p) => /^1\s?GB\b/i.test(String(p.name).split(" - ")[0].trim()));
    return oneGB.length ? oneGB.reduce((a, b) => (b.price < a.price ? b : a)) : null;
  }, [catalogue]);
  return (
    <>
      <Navbar />

      <main>
        {/* Hero: the promise on the left, the actual price list on the right. */}
        <section aria-labelledby="hero-heading" className="hero">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-8 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-16">
            <div className="hero-copy">
              <a href="#services" className="focus-ring inline-flex items-center gap-2 rounded-full text-sm font-medium text-ink-600 hover:text-ink-900">
                <span className="rounded-full bg-ink-900 px-2 py-0.5 text-[11px] font-bold text-white dark:bg-cyan-600 dark:text-[#ffffff]">New</span>
                Pay for TV, electricity and exam PINs too
              </a>

              <h1 id="hero-heading" className="mt-6 font-display text-[2.7rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-ink-900 sm:text-6xl lg:text-[4.5rem]">
                Cheaper data.
                <br />
                Instant airtime.
              </h1>

              <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink-600 sm:text-lg">
                Top up any MTN, Airtel, Glo or 9mobile line in seconds. Fund your wallet once, then every purchase is one tap with no fee.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href={user ? "/buy-data" : "/signup"} className="btn-primary focus-ring">
                  {user ? "Buy data" : "Create free account"}
                </Link>
                <Link href={user ? "/dashboard" : "/login"} className="btn-quiet focus-ring">
                  {user ? "Go to dashboard" : "I have an account"}
                </Link>
              </div>

              <div className="mt-4">
                <InstallApp variant="hero" />
              </div>

              {cheapest1GB && (
                <p className="mt-8 text-sm text-ink-500">
                  1GB from <strong className="font-semibold text-ink-900">{formatNaira(cheapest1GB.price)}</strong> on {cheapest1GB.network}
                  {planCount ? <>, {planCount} plans across 4 networks.</> : "."}
                </p>
              )}
            </div>

            <div className="hero-board">
              <PriceBoard />
            </div>
          </div>
        </section>

        <ServicesShowcase cheapest1GB={cheapest1GB ? cheapest1GB.price : null} />

        {/* How it works */}
        <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <h2 id="how-heading" className="max-w-xl font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            From choosing to done in under a minute
          </h2>
          <ol className="steps mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, i) => (
              <li key={step.title} className="step">
                <span className="step-num" aria-hidden="true">{i + 1}</span>
                <h3 className="mt-5 font-display text-lg font-bold text-ink-900">{step.title}</h3>
                <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-500">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Why EscriptPay */}
        <section id="why-escriptpay" aria-labelledby="why-heading" className="border-y border-slate-200/70 bg-white py-20 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-8">
            <div>
              <h2 id="why-heading" className="font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
                Small payments, handled carefully
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-500 sm:text-base">
                Buying airtime should be boring in the best way: the right price, the right number, and a clear record afterwards.
              </p>
            </div>
            <ul className="grid gap-x-12 gap-y-9 sm:grid-cols-2">
              {BENEFITS.map((b) => (
                <li key={b.title} className="border-t border-slate-200 pt-5">
                  <b.icon size={20} className="text-cyan-600" aria-hidden="true" />
                  <h3 className="mt-3 font-display text-base font-bold text-ink-900">{b.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink-500">{b.body}</p>
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
          <div className="relative overflow-hidden rounded-3xl bg-ink-900 px-6 py-14 text-center sm:px-12 dark:bg-slate-100">
            <h2 id="cta-heading" className="relative font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl dark:text-ink-900">
              Your next top-up can take ten seconds
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-sm text-slate-300 sm:text-base dark:text-ink-500">
              Create a free account and buy your first data or airtime in under a minute.
            </p>
            <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={user ? "/dashboard" : "/signup"} className="btn-primary focus-ring">
                {user ? "Go to dashboard" : "Create free account"}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
