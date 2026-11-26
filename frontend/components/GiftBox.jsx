"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Gift, Sparkles, ShoppingBag, Share2, Bell, BellRing, Check, Loader2 } from "lucide-react";
import { getGiftBox, openGiftBox, getReferrals, errorMessage } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useWallet } from "@/lib/wallet-context";
import { usePushAlerts } from "@/lib/push";

// Daily gift box on the dashboard: open once a day (Lagos time) to reveal a
// cashback amount, which lands in the wallet after a qualifying data order
// the same day. Rules live on the server (services/giftBoxes.js).

function AlertsButton() {
  const { state, enable } = usePushAlerts();
  const [busy, setBusy] = useState(false);

  if (state === "loading" || state === "unavailable") return null;
  if (state === "on") {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <BellRing size={14} aria-hidden="true" />
        Gift alerts are on
      </p>
    );
  }
  if (state === "install-first") {
    return <p className="text-xs text-ink-500">Add EscriptPay to your Home Screen to get a daily alert when your gift is ready.</p>;
  }
  if (state === "blocked") {
    return <p className="text-xs text-ink-500">Notifications are blocked for EscriptPay. Allow them in your browser settings to get gift alerts.</p>;
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await enable();
        setBusy(false);
      }}
      className="focus-ring press inline-flex items-center gap-1.5 rounded-lg px-1 text-xs font-semibold text-cyan-600 hover:text-cyan-700 disabled:opacity-60"
    >
      <Bell size={14} aria-hidden="true" />
      Remind me every day
    </button>
  );
}

export default function GiftBoxCard() {
  const { refresh } = useWallet();
  const [gift, setGift] = useState(null);
  const [opening, setOpening] = useState(false);
  const [justOpened, setJustOpened] = useState(false);
  const [error, setError] = useState("");
  const [shared, setShared] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    let active = true;
    getGiftBox()
      .then((g) => active && setGift(g))
      .catch(() => active && setGift(null));
    // Opened from the morning notification: bring the box into view.
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("gift") === "1") {
      setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    }
    return () => {
      active = false;
    };
  }, []);

  // Refresh when the user comes back (e.g. after buying data in another tab).
  useEffect(() => {
    if (!gift || gift.status !== "opened") return undefined;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      getGiftBox()
        .then((g) => {
          setGift(g);
          if (g.status === "credited") refresh();
        })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [gift, refresh]);

  if (!gift || !gift.enabled) return null;

  const open = async () => {
    setOpening(true);
    setError("");
    try {
      const g = await openGiftBox();
      setGift(g);
      setJustOpened(true);
      if (g.status === "credited") refresh();
    } catch (err) {
      setError(errorMessage(err, "Could not open your gift. Please try again."));
    } finally {
      setOpening(false);
    }
  };

  const share = async () => {
    let link = typeof window !== "undefined" ? window.location.origin : "https://escriptpay.com";
    try {
      const r = await getReferrals();
      if (r?.link) link = r.link;
    } catch {
      // Share the site without an invite code.
    }
    const text = `I get a free gift box with cashback every day on EscriptPay 🎁 Cheap data, airtime, TV and electricity. Join with my link: ${link}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "EscriptPay", text });
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      }
      setShared(true);
    } catch {
      // Share sheet closed.
    }
  };

  const shareButton = (
    <button
      type="button"
      onClick={share}
      className="focus-ring press inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink-700 hover:bg-slate-50"
    >
      {shared ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
      {shared ? "Shared" : "Share with friends"}
    </button>
  );

  return (
    <section ref={ref} aria-labelledby="gift-heading" className="card relative overflow-hidden p-4 sm:p-5">
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-gradient-to-br from-amber-300/30 to-fuchsia-400/20 blur-2xl" />

      {!gift.opened ? (
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="animate-gift-wiggle flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-fuchsia-500 brand-contrast shadow-[0_12px_28px_-14px_rgb(234_88_12/0.9)]">
            <Gift size={28} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="gift-heading" className="font-display text-base font-bold text-ink-900">Your daily gift box is ready</h2>
            <p className="text-xs text-ink-500 sm:text-sm">
              Open it to see your cashback (up to {formatNaira(gift.maxPrize)}). Buy {formatNaira(gift.minPurchase)}+ data today to collect it.
            </p>
          </div>
          <button
            type="button"
            onClick={open}
            disabled={opening}
            className="gradient-btn focus-ring press inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold brand-contrast disabled:opacity-70 sm:w-auto"
          >
            {opening ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}
            {opening ? "Opening…" : "Open gift"}
          </button>
          {error && <p className="w-full text-xs font-medium text-red-600">{error}</p>}
          <div className="w-full">
            <AlertsButton />
          </div>
        </div>
      ) : (
        <div className="relative space-y-3" aria-live="polite">
          <div className="flex items-center gap-4">
            <span className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-amber-100 text-amber-600 ${justOpened ? "animate-pop" : ""}`}>
              <span className="font-display text-lg font-extrabold leading-none">{formatNaira(gift.prize)}</span>
            </span>
            <div className="min-w-0 flex-1">
              {gift.status === "credited" ? (
                <>
                  <h2 id="gift-heading" className="font-display text-base font-bold text-ink-900">{formatNaira(gift.prize)} added to your wallet 🎉</h2>
                  <p className="text-xs text-ink-500 sm:text-sm">Thanks for buying with EscriptPay. A new gift box opens tomorrow.</p>
                </>
              ) : gift.status === "budget_out" ? (
                <>
                  <h2 id="gift-heading" className="font-display text-base font-bold text-ink-900">Today's gifts have all been claimed</h2>
                  <p className="text-xs text-ink-500 sm:text-sm">So many people collected their cashback today. Be early tomorrow!</p>
                </>
              ) : gift.status === "crediting" ? (
                <>
                  <h2 id="gift-heading" className="font-display text-base font-bold text-ink-900">Adding {formatNaira(gift.prize)} to your wallet…</h2>
                  <p className="text-xs text-ink-500 sm:text-sm">This takes a moment.</p>
                </>
              ) : (
                <>
                  <h2 id="gift-heading" className="font-display text-base font-bold text-ink-900">You won {formatNaira(gift.prize)} cashback!</h2>
                  <p className="text-xs text-ink-500 sm:text-sm">
                    Buy {formatNaira(gift.minPurchase)} or more of data before midnight and it goes straight into your wallet.
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {gift.status === "opened" && (
              <Link
                href="/buy-data"
                className="gradient-btn focus-ring press inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-5 text-sm font-bold brand-contrast"
              >
                <ShoppingBag size={16} aria-hidden="true" />
                Buy data now
              </Link>
            )}
            {shareButton}
          </div>
          <AlertsButton />
        </div>
      )}
    </section>
  );
}
