"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NetworkSelector from "@/components/NetworkSelector";
import PlanList from "@/components/PlanList";
import OrderSummary from "@/components/OrderSummary";
import { validateNigerianPhone } from "@/lib/validators";
import { createTestTransaction, errorMessage } from "@/lib/api";
import { PackageOpen, AlertCircle } from "lucide-react";

const makeReference = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `ref_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export default function BuyForm() {
  const router = useRouter();
  const [network, setNetwork] = useState("MTN");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const clientRef = useRef(null);

  const selectPlan = (plan) => {
    setSelectedPlan(plan);
    setSubmitError("");
  };

  const buyNow = async () => {
    if (!selectedPlan) return;

    const check = validateNigerianPhone(phone);
    if (!check.valid) {
      setPhoneError(check.message);
      return;
    }
    setPhoneError("");
    setSubmitError("");

    if (!clientRef.current) clientRef.current = makeReference();

    setProcessing(true);
    try {
      // TEST MODE purchase. Only the plan ID and phone are sent; the backend
      // reads the price/plan/network from MongoDB (never trusts the client).
      const { transaction } = await createTestTransaction({
        planId: selectedPlan._id,
        phone: phone.trim(),
        clientReference: clientRef.current,
      });

      clientRef.current = null;
      router.push(`/success?ref=${encodeURIComponent(transaction.transactionId)}`);
    } catch (error) {
      // Reset the idempotency key so a genuine retry creates a fresh order.
      clientRef.current = null;
      setSubmitError(errorMessage(error, "Purchase could not be completed. Please try again."));
      setProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-6">
        <section aria-labelledby="network-heading">
          <h2 id="network-heading" className="mb-3 font-display text-base font-bold text-ink-800">
            Choose network
          </h2>
          <NetworkSelector selected={network} onSelect={setNetwork} />
        </section>

        <section aria-labelledby="plan-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="plan-heading" className="font-display text-base font-bold text-ink-800">
              Select a data plan
            </h2>
            <span className="text-xs text-ink-400">{network} plans</span>
          </div>
          <PlanList network={network} selectedPlan={selectedPlan} onSelect={selectPlan} />
        </section>

        <section aria-labelledby="phone-heading">
          <h2 id="phone-heading" className="mb-3 font-display text-base font-bold text-ink-800">
            Phone number to receive data
          </h2>
          <label htmlFor="recipient-phone" className="sr-only">
            Recipient phone number
          </label>
          <input
            id="recipient-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="08012345678"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/[^\d+]/g, ""));
              setPhoneError("");
              setSubmitError("");
            }}
            aria-invalid={phoneError ? "true" : "false"}
            aria-describedby={phoneError ? "phone-error" : "phone-hint"}
            className="input-base"
          />
          {phoneError ? (
            <p
              id="phone-error"
              role="alert"
              className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500"
            >
              <AlertCircle size={14} />
              {phoneError}
            </p>
          ) : (
            <p id="phone-hint" className="mt-1.5 text-xs text-ink-400">
              Enter a valid Nigerian number, e.g. 08012345678.
            </p>
          )}
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        {selectedPlan ? (
          <OrderSummary plan={selectedPlan} phone={phone.trim()} onBuyNow={buyNow} processing={processing} />
        ) : (
          <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-100 to-purple-lite-100 text-cyan-600">
              <PackageOpen size={22} aria-hidden="true" />
            </span>
            <p className="font-display text-base font-bold text-ink-800">No plan selected</p>
            <p className="text-sm text-ink-500">
              Pick a {network} plan and your order summary will appear here.
            </p>
          </div>
        )}

        {submitError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
          >
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>
              {submitError}{" "}
              <button
                type="button"
                onClick={buyNow}
                disabled={processing}
                className="font-bold underline underline-offset-2 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Retry
              </button>
            </span>
          </div>
        )}
      </aside>
    </div>
  );
}