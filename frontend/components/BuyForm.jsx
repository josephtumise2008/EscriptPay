"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NetworkSelector from "@/components/NetworkSelector";
import PlanList from "@/components/PlanList";
import OrderSummary from "@/components/OrderSummary";
import MobileCheckoutBar from "@/components/MobileCheckoutBar";
import { validateNigerianPhone } from "@/lib/validators";
import { createDataTransaction, getPlanById, errorMessage } from "@/lib/api";
import { continueAfterOrder } from "@/lib/checkout";
import { PackageOpen, AlertCircle } from "lucide-react";
import { formatNaira } from "@/lib/format";
import PaymentMethodPicker, { usePayWith } from "@/components/PaymentMethodPicker";
import { useWallet } from "@/lib/wallet-context";

const makeReference = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `ref_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const KNOWN_NETWORKS = ["MTN", "Airtel", "Glo", "9mobile"];

export default function BuyForm({ initialNetwork = "", initialPlanId = "" }) {
  const router = useRouter();
  const startingNetwork = KNOWN_NETWORKS.includes(initialNetwork) ? initialNetwork : "MTN";
  const [network, setNetwork] = useState(startingNetwork);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const clientRef = useRef(null);
  const pay = usePayWith(selectedPlan ? selectedPlan.price : NaN);
  const { applyBalance, refresh: refreshWallet } = useWallet();

  // Returning from Paystack with the browser Back button can restore this
  // page from cache with the button still "processing"; re-enable it.
  useEffect(() => {
    const onPageShow = (event) => {
      if (event.persisted) setProcessing(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // "Buy Again" support: when arriving with ?plan=<id>, load that exact plan
  // (which also selects its network) so the summary is pre-filled.
  useEffect(() => {
    if (!initialPlanId) return;
    let active = true;
    getPlanById(initialPlanId)
      .then((plan) => {
        if (active && plan) {
          setNetwork(plan.network);
          setSelectedPlan(plan);
        }
      })
      .catch(() => {
        // Plan no longer exists — fall back to a normal empty form.
      });
    return () => {
      active = false;
    };
  }, [initialPlanId]);

  const selectPlan = (plan) => {
    setSelectedPlan(plan);
    setSubmitError("");
  };

  const buyNow = async () => {
    if (!selectedPlan) return;

    const check = validateNigerianPhone(phone);
    if (!check.valid) {
      setPhoneError(check.message);
      const input = document.getElementById("recipient-phone");
      input?.scrollIntoView({ block: "center", behavior: "smooth" });
      input?.focus({ preventScroll: true });
      return;
    }
    setPhoneError("");
    setSubmitError("");

    if (pay.value === "wallet" && !pay.enough) {
      setSubmitError("Your wallet balance is too low for this plan. Fund your wallet or choose another payment method.");
      return;
    }

    if (!clientRef.current) clientRef.current = makeReference();

    setProcessing(true);
    try {
      // Only the plan ID and phone are sent; the backend reads the
      // price/plan/network from MongoDB (never trusts the client). With
      // Paystack enabled the response carries a checkout URL and nothing is
      // delivered until the server verifies the payment.
      const data = await createDataTransaction({
        planId: selectedPlan._id,
        phone: phone.trim(),
        clientReference: clientRef.current,
        payWith: pay.value,
      });

      clientRef.current = null;
      if (data.wallet) applyBalance(data.wallet.balance);
      continueAfterOrder(router, data, "data");
    } catch (error) {
      // Reset the idempotency key so a genuine retry creates a fresh order.
      clientRef.current = null;
      setSubmitError(errorMessage(error, "Purchase could not be completed. Please try again."));
      setProcessing(false);
      if (pay.value === "wallet") refreshWallet();
    }
  };

  const stepHeading = "mb-3 flex items-center gap-2 font-display text-base font-bold text-ink-800";
  const stepNumber = "flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-ink-600";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-7">
        <section aria-labelledby="network-heading">
          <h2 id="network-heading" className={stepHeading}>
            <span className={stepNumber} aria-hidden="true">1</span>
            Network
          </h2>
          <NetworkSelector
            selected={network}
            onSelect={(n) => {
              setNetwork(n);
              if (selectedPlan && selectedPlan.network !== n) setSelectedPlan(null);
            }}
          />
        </section>

        <section aria-labelledby="phone-heading">
          <h2 id="phone-heading" className={stepHeading}>
            <span className={stepNumber} aria-hidden="true">2</span>
            Phone number
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
            className={`input-base text-base ${phoneError ? "border-red-300" : ""}`}
          />
          {phoneError ? (
            <p id="phone-error" role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500">
              <AlertCircle size={14} aria-hidden="true" />
              {phoneError}
            </p>
          ) : (
            <p id="phone-hint" className="mt-1.5 text-xs text-ink-400">
              The number that will receive the data, e.g. 08012345678.
            </p>
          )}
        </section>

        <section aria-labelledby="pay-heading">
          <h2 id="pay-heading" className={stepHeading}>
            <span className={stepNumber} aria-hidden="true">3</span>
            Pay with
          </h2>
          <PaymentMethodPicker
            amount={selectedPlan ? selectedPlan.price : NaN}
            value={pay.value}
            onChange={(v) => {
              pay.setValue(v);
              setSubmitError("");
            }}
          />
        </section>
        <section aria-labelledby="plan-heading">
          <h2 id="plan-heading" className={stepHeading}>
            <span className={stepNumber} aria-hidden="true">4</span>
            {network} data plan
          </h2>
          <PlanList network={network} selectedPlan={selectedPlan} onSelect={selectPlan} />
        </section>

      </div>

      <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        {selectedPlan ? (
          <OrderSummary
            plan={selectedPlan}
            phone={phone.trim()}
            onBuyNow={buyNow}
            processing={processing}
            payWith={pay.value}
          />
        ) : (
          <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
              <PackageOpen size={22} aria-hidden="true" />
            </span>
            <p className="font-display text-base font-bold text-ink-800">No plan selected</p>
            <p className="text-sm text-ink-500">Pick a {network} plan and your order summary will appear here.</p>
          </div>
        )}

        {submitError && (
          <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
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

      <MobileCheckoutBar
        title={selectedPlan ? selectedPlan.name : "No plan selected"}
        subtitle={selectedPlan ? `${selectedPlan.network} · ${selectedPlan.validity}${phone ? ` · ${phone}` : ""}` : `Choose a ${network} plan above`}
        amountLabel={selectedPlan ? formatNaira(selectedPlan.price) : ""}
        ready={Boolean(selectedPlan)}
        processing={processing}
        onBuy={buyNow}
        error={submitError}
      />
    </div>
  );
}
