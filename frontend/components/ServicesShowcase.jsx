"use client";

import Link from "next/link";
import { ArrowUpRight, Wifi, Phone, Tv, Zap, GraduationCap, Sparkles } from "lucide-react";
import { formatNaira } from "@/lib/format";

// Cursor spotlight on each card (CSS reads --mx / --my).
const spot = (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
};

function Card({ href, tone, icon: Icon, title, body, badge, className = "", children, i }) {
  return (
    <li style={{ "--i": i }} className={className}>
      <Link
        href={href}
        onMouseMove={spot}
        className={`svc-card group focus-ring relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 ${tone}`}
      >
        <span aria-hidden="true" className="svc-spot" />
        <span aria-hidden="true" className="svc-orb" />
        <div className="relative flex items-start justify-between gap-3">
          <span className="svc-icon flex h-12 w-12 items-center justify-center rounded-2xl brand-contrast shadow-lg">
            <Icon size={22} aria-hidden="true" />
          </span>
          <span className="flex items-center gap-2">
            {badge && <span className="svc-badge rounded-full px-2.5 py-1 text-[11px] font-bold">{badge}</span>}
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-ink-500 transition-all duration-300 group-hover:rotate-45 group-hover:border-transparent group-hover:bg-ink-900 group-hover:text-white">
              <ArrowUpRight size={16} aria-hidden="true" />
            </span>
          </span>
        </div>
        <h3 className="relative mt-5 font-display text-xl font-extrabold tracking-tight text-ink-900">{title}</h3>
        <p className="relative mt-1.5 max-w-md text-sm leading-relaxed text-ink-500">{body}</p>
        <div className="relative mt-6 flex-1">{children}</div>
      </Link>
    </li>
  );
}

const MARQUEE = ["MTN", "Airtel", "Glo", "9mobile", "DStv", "GOtv", "StarTimes", "IBEDC", "EKEDC", "IKEDC", "AEDC", "PHEDC", "EEDC", "KEDCO", "BEDC", "WAEC", "JAMB"];

export default function ServicesShowcase({ cheapest1GB }) {
  return (
    <section id="services" aria-labelledby="services-heading" className="relative overflow-hidden py-20 lg:py-28">
      <div aria-hidden="true" className="svc-aurora" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center" data-reveal>
          <p className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/70 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-600 backdrop-blur">
            <Sparkles size={13} aria-hidden="true" /> New on EscriptPay
          </p>
          <h2 id="services-heading" className="mt-4 font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
            One wallet. <span className="gradient-text anim-shine">Every bill.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-500 sm:text-lg">
            Data, airtime, cable TV, electricity and exam PINs, all in one place. Pay from your wallet with no fee, and get your token or PIN on screen in seconds.
          </p>
        </div>

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-reveal-stagger>
          <Card
            i={0}
            className="sm:col-span-2"
            href="/buy-data"
            tone="svc-cyan"
            icon={Wifi}
            title="Cheap data, every network"
            body="SME and direct bundles for MTN, Airtel, Glo and 9mobile, priced below the network."
            badge={cheapest1GB ? `1GB from ${formatNaira(cheapest1GB)}` : null}
          >
            <div className="flex h-28 items-end gap-2 sm:gap-3" aria-hidden="true">
              {[30, 48, 66, 84, 100, 72, 90, 58, 96, 78, 100, 64].map((h, k) => (
                <span key={k} className="svc-bar flex-1 rounded-t-lg" style={{ "--h": `${h}%`, animationDelay: `${k * 90}ms` }} />
              ))}
            </div>
          </Card>

          <Card i={1} href="/buy-airtime" tone="svc-sky" icon={Phone} title="Instant airtime" body="Top up any Nigerian line from ₦100, delivered in seconds.">
            <div className="flex h-28 items-center justify-center" aria-hidden="true">
              <div className="svc-ticker font-display text-4xl font-extrabold text-ink-900">
                <span className="svc-ticker-track">
                  <span>₦100</span>
                  <span>₦500</span>
                  <span>₦1,000</span>
                  <span>₦2,000</span>
                  <span>₦100</span>
                </span>
              </div>
            </div>
          </Card>

          <Card i={2} href="/cable-tv" tone="svc-violet" icon={Tv} title="Cable TV" body="Renew DStv, GOtv and StarTimes. We confirm the name on the smartcard first." badge="Cheaper than usual">
            <div className="svc-tv mx-auto aspect-[16/10] w-full max-w-[15rem] rounded-2xl p-1.5" aria-hidden="true">
              <div className="svc-tv-screen relative flex h-full items-center justify-center overflow-hidden rounded-xl">
                <span className="svc-scan" />
                <span className="svc-channels font-display text-lg font-extrabold text-white">
                  <span>DStv</span>
                  <span>GOtv</span>
                  <span>StarTimes</span>
                </span>
              </div>
            </div>
          </Card>

          <Card i={3} href="/electricity" tone="svc-amber" icon={Zap} title="Electricity" body="Prepaid tokens and postpaid bills for IBEDC, EKEDC, IKEDC and 9 more.">
            <div className="flex h-28 flex-col items-center justify-center gap-3" aria-hidden="true">
              <span className="svc-bulb flex h-12 w-12 items-center justify-center rounded-full">
                <Zap size={22} className="text-amber-500" />
              </span>
              <span className="svc-token rounded-lg px-3 py-1.5 font-mono text-sm font-bold tracking-[0.18em] text-ink-800">4521 8830 1176 0942</span>
            </div>
          </Card>

          <Card i={4} href="/exam-pins" tone="svc-rose" icon={GraduationCap} title="Exam PINs" body="WAEC result checker and JAMB PINs, shown instantly and emailed to you.">
            <div className="flex h-28 items-center justify-center" aria-hidden="true">
              <div className="svc-pin w-full max-w-[15rem] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">WAEC PIN</p>
                <p className="svc-pin-digits mt-1 font-mono text-lg font-extrabold tracking-[0.2em] text-ink-900">
                  <span className="svc-mask">••••••••••••</span>
                  <span className="svc-real">5728 7147 4684</span>
                </p>
              </div>
            </div>
          </Card>
        </ul>
      </div>

      <div className="svc-marquee relative mt-16 overflow-hidden border-y border-slate-200/70 bg-white/50 py-4" aria-label="Supported providers">
        <div className="svc-marquee-track flex w-max gap-10">
          {[...MARQUEE, ...MARQUEE].map((name, k) => (
            <span key={`${name}-${k}`} aria-hidden={k >= MARQUEE.length ? "true" : undefined} className="flex items-center gap-2.5 whitespace-nowrap font-display text-base font-bold text-ink-600">
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" />
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
