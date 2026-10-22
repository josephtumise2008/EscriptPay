"use client";

// Paystack redirects here after checkout with ?reference=... (and trxref).
// Arriving here proves nothing: the backend verifies the payment with
// Paystack, checks the exact amount/currency, and only then starts delivery.
// Then we show the normal order status page.

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, History } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { verifyPayment, errorMessage } from "@/lib/api";

const REFERENCE_PATTERN = /^[A-Za-z0-9.=-]{1,100}$/;

function CallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const reference = (params.get("reference") || params.get("trxref") || "").trim();
  const validReference = REFERENCE_PATTERN.test(reference);
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    // React Strict Mode runs effects twice in development; one request is
    // enough (the server is idempotent either way).
    if (started.current || !validReference) return;
    started.current = true;

    (async () => {
      try {
        const { transaction } = await verifyPayment(reference);
        router.replace(`/success?ref=${encodeURIComponent(transaction.transactionId)}`);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) {
          router.replace(`/login?next=${encodeURIComponent(`/payment/callback?reference=${reference}`)}`);
          return;
        }
        // Verification could not complete yet (e.g. Paystack slow): the order
        // page shows the real state and keeps refreshing.
        const tx = err?.response?.data?.transaction;
        if (tx?.transactionId) {
          router.replace(`/success?ref=${encodeURIComponent(tx.transactionId)}`);
          return;
        }
        setError(errorMessage(err, "We could not confirm this payment yet."));
      }
    })();
  }, [reference, validReference, router]);

  const message = !validReference ? "This payment link is missing a valid reference." : error;

  if (message) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-14">
        <div className="card w-full max-w-lg px-6 py-12 text-center">
          <p className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <AlertCircle size={26} aria-hidden="true" />
          </p>
          <h1 className="mt-5 font-display text-2xl font-extrabold text-ink-900">
            Payment not confirmed yet
          </h1>
          <p className="mt-2 text-sm text-ink-500">{message}</p>
          <p className="mt-2 text-sm text-ink-500">
            If you were debited, your order will update automatically once the payment is confirmed.
          </p>
          <Link
            href="/history"
            className="gradient-btn focus-ring mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold brand-contrast"
          >
            <History size={16} />
            View transactions
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-14">
      <LoadingSpinner size={44} label="Confirming your payment…" />
    </main>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackContent />
    </Suspense>
  );
}
