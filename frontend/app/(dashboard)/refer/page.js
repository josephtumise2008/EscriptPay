"use client";

import { useEffect, useState } from "react";
import { Gift, Copy, Check, Share2, UserPlus, Wallet, Sparkles, Users, AlertCircle } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getReferrals, errorMessage } from "@/lib/api";
import { formatNaira, formatDate } from "@/lib/format";

const WhatsAppIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.2 4.24-9.44 9.45-9.44a9.4 9.4 0 0 1 9.44 9.45c0 5.21-4.24 9.44-9.45 9.44m8.04-17.49A11.3 11.3 0 0 0 12.05.68C5.78.68.68 5.78.67 12.04c0 2 .52 3.96 1.52 5.68L.57 23.6l6.03-1.58a11.34 11.34 0 0 0 5.44 1.39h.01c6.26 0 11.37-5.1 11.37-11.37a11.3 11.3 0 0 0-3.33-8.03" />
  </svg>
);

export default function ReferPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    let active = true;
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    getReferrals()
      .then((r) => active && setData(r))
      .catch((err) => active && setError(errorMessage(err, "Could not load your invites.")));
    return () => {
      active = false;
    };
  }, []);

  const message = data
    ? `I buy cheap data, airtime, TV and electricity on EscriptPay. Sign up with my link: ${data.link}`
    : "";

  const copy = async (what, text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
      } catch {}
      el.remove();
    }
    setCopied(what);
    setTimeout(() => setCopied(""), 2000);
  };

  const share = async () => {
    try {
      await navigator.share({ title: "EscriptPay", text: message });
    } catch {}
  };

  if (error) {
    return (
      <div role="alert" className="card flex items-center gap-2 p-5 text-sm font-medium text-red-600">
        <AlertCircle size={18} aria-hidden="true" />
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  const steps = [
    { icon: Share2, title: "Share your link", text: "Send it on WhatsApp, Instagram or anywhere." },
    { icon: UserPlus, title: "Friend signs up", text: "They create an account with your link or code." },
    { icon: Wallet, title: `They top up ${formatNaira(data.minTopup)}+`, text: `You get ${formatNaira(data.reward)} in your wallet, instantly.` },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="wallet-gradient relative overflow-hidden rounded-3xl p-5 brand-contrast shadow-[0_30px_60px_-34px_rgb(91_79_240/0.8)] sm:p-7">
        <div aria-hidden="true" className="wallet-sheen pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full border border-[#ffffff]/15" />
        <div className="relative">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#ffffff]/75">
            <Gift size={14} aria-hidden="true" />
            Invite &amp; earn
          </p>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Get {formatNaira(data.reward)} for every friend you bring
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[#ffffff]/80">
            When a friend signs up with your link and adds {formatNaira(data.minTopup)} or more to their wallet, we add{" "}
            {formatNaira(data.reward)} to yours. Spend it on data, airtime, TV, electricity or exam PINs.
          </p>

          <div className="mt-5 rounded-2xl bg-[#ffffff]/12 p-3 ring-1 ring-[#ffffff]/20 sm:p-4">
            <p className="text-xs font-semibold text-[#ffffff]/70">Your invite link</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">{data.link.replace(/^https?:\/\//, "")}</span>
              <button
                type="button"
                onClick={() => copy("link", data.link)}
                className="focus-ring press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#ffffff] px-3 text-xs font-bold text-[#5b21b6]"
              >
                {copied === "link" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                {copied === "link" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-xs text-[#ffffff]/70">
              Or they can type your code when signing up:{" "}
              <button
                type="button"
                onClick={() => copy("code", data.code)}
                className="focus-ring rounded font-mono text-sm font-bold tracking-widest text-[#ffffff] underline decoration-dotted underline-offset-4"
                aria-label={`Copy code ${data.code}`}
              >
                {data.code}
              </button>
              {copied === "code" && <span className="ml-1.5 font-semibold">Copied</span>}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring press inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#25d366] px-5 text-sm font-bold text-[#ffffff] sm:flex-none"
            >
              <WhatsAppIcon className="h-[18px] w-[18px]" />
              Share on WhatsApp
            </a>
            {canShare && (
              <button
                type="button"
                onClick={share}
                className="focus-ring press inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#ffffff]/15 px-5 text-sm font-semibold text-[#ffffff] hover:bg-[#ffffff]/25 sm:flex-none"
              >
                <Share2 size={17} aria-hidden="true" />
                More ways
              </button>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Your invite results" className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: "Friends joined", value: data.invited, icon: Users },
          { label: "Rewards paid", value: data.rewarded, icon: Sparkles },
          { label: "You've earned", value: formatNaira(data.earned), icon: Gift },
        ].map((s) => (
          <div key={s.label} className="card p-4 sm:p-5">
            <s.icon size={18} className="text-violet-500" aria-hidden="true" />
            <p className="mt-2 font-display text-xl font-extrabold text-ink-900 sm:text-2xl">{s.value}</p>
            <p className="mt-0.5 text-xs text-ink-500 sm:text-sm">{s.label}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="how-heading" className="card p-5 sm:p-6">
        <h2 id="how-heading" className="font-display text-lg font-bold text-ink-800">
          How it works
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <step.icon size={19} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-bold text-ink-800">
                  {i + 1}. {step.title}
                </span>
                <span className="mt-0.5 block text-sm text-ink-500">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="friends-heading">
        <h2 id="friends-heading" className="mb-3 font-display text-lg font-bold text-ink-800">
          Your friends
        </h2>
        {data.friends.length === 0 ? (
          <div className="card px-5 py-10 text-center">
            <p className="text-sm font-semibold text-ink-700">No one has joined with your link yet.</p>
            <p className="mt-1 text-sm text-ink-500">Share it with a few friends to get started.</p>
          </div>
        ) : (
          <ul className="card divide-y divide-slate-100 overflow-hidden">
            {data.friends.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink-800">{f.name}</span>
                  <span className="block text-xs text-ink-500">Joined {formatDate(f.joinedAt)}</span>
                </span>
                {f.status === "rewarded" ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    +{formatNaira(data.reward)} paid
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    Waiting for top-up
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-400">
          One reward per friend. Rewards go into your wallet to spend on EscriptPay and can&apos;t be withdrawn. Accounts made with
          your own phone number don&apos;t count.
        </p>
      </section>
    </div>
  );
}
