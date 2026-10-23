"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NetworkSelector from "@/components/NetworkSelector";
import { validateNigerianPhone } from "@/lib/validators";
import { createAirtimeTransaction, errorMessage } from "@/lib/api";
import { continueAfterOrder } from "@/lib/checkout";
import MobileCheckoutBar from "@/components/MobileCheckoutBar";
import { formatNaira } from "@/lib/format";
import { Smartphone, Banknote, AlertCircle, Wifi } from "lucide-react";

const PRESET_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];
const MIN_AMOUNT = 100;
const MAX_AMOUNT = 10000;
const KNOWN_NETWORKS = ["MTN", "Airtel", "Glo", "9mobile"];

const makeReference = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `ref_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export default function AirtimeForm({ initialNetwork = "", initialAmount = "" }) {
  const router = useRouter();
  const startingNetwork = KNOWN_NETWORKS.includes(initialNetwork) ? initialNetwork : "MTN";
  const parsedAmount = Number(initialAmount);
  const startingAmount =
    Number.isInteger(parsedAmount) && parsedAmount >= MIN_AMOUNT && parsedAmount <= MAX_AMOUNT
      ? parsedAmount
      : 500;

  const [network, setNetwork] = useState(startingNetwork);
  const [amount, setAmount] = useState(startingAmount);
  const [customAmount, setCustomAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [amountError, setAmountError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const clientRef = useRef(null);

  // Returning from Paystack with the browser Back button can restore this
  // page from cache with the button still "processing"; re-enable it.
  useEffect(() => {
    const onPageShow = (event) => {
      if (event.persisted) setProcessing(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const pickPreset = (value) => {
    setAmount(value);
    setCustomAmount("");
    setAmountError("");
    setSubmitError("");
  };

  const handleCustom = (value) => {
    setCustomAmount(value);
    if (value) setAmount(Number(value));
    setAmountError("");
    setSubmitError("");
  };

  const buyNow = async () => {
    const finalAmount = customAmount ? Number(customAmount) : amount;
    if (!Number.isInteger(finalAmount) || finalAmount < MIN_AMOUNT || finalAmount > MAX_AMOUNT) {
      setAmountError(`Amount must be between ${formatNaira(MIN_AMOUNT)} and ${formatNaira(MAX_AMOUNT)}.`);
      return;
    }

    const check = validateNigerianPhone(phone);
    if (!check.valid) {
      setPhoneError(check.message);
      const input = document.getElementById("airtime-phone");
      input?.scrollIntoView({ block: "center", behavior: "smooth" });
      input?.focus({ preventScroll: true });
      return;
    }

    setPhoneError("");
    setSubmitError("");
    if (!clientRef.current) clientRef.current = makeReference();

    setProcessing(true);
    try {
      // The backend re-validates the network and the amount range before
      // creating the transaction. With Paystack enabled the customer is sent
      // to checkout; delivery only starts after server-side verification.
      const data = await createAirtimeTransaction({
        network,
        amount: finalAmount,
        phone: phone.trim(),
        clientReference: clientRef.current,
      });

      clientRef.current = null;
      continueAfterOrder(router, data, "airtime");
    } catch (error) {
      clientRef.current = null;
      setSubmitError(errorMessage(error, "Purchase could not be completed. Please try again."));
      setProcessing(false);
    }
  };

  const showAmountInput = customAmount !== "";
  const finalAmount = customAmount ? Number(customAmount) : amount;
  const amountValid = Number.isInteger(finalAmount) && finalAmount >= MIN_AMOUNT && finalAmount <= MAX_AMOUNT;

  const stepHeading = "mb-3 flex items-center gap-2 font-display text-base font-bold text-ink-800";
  const stepNumber = "flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-ink-600";

  const summaryRows = [
    { label: "Network", value: network, icon: Wifi },
    { label: "Amount", value: amountValid ? formatNaira(finalAmount) : "—", icon: Banknote, emphasize: true },
    { label: "Phone", value: phone || "—", icon: Smartphone },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-7">
        <section aria-labelledby="airtime-network-heading">
          <h2 id="airtime-network-heading" className={stepHeading}>
            <span className={stepNumber} aria-hidden="true">1</span>
            Network
          </h2>
          <NetworkSelector selected={network} onSelect={setNetwork} />
        </section>

        <section aria-labelledby="airtime-phone-heading">
          <h2 id="airtime-phone-heading" className={stepHeading}>
            <span className={stepNumber} aria-hidden="true">2</span>
            Phone number
          </h2>
          <label htmlFor="airtime-phone" className="sr-only">
            Phone number to recharge
          </label>
          <input
            id="airtime-phone"
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
            aria-describedby={phoneError ? "airtime-phone-error" : "airtime-phone-hint"}
            className={`input-base text-base ${phoneError ? "border-red-300" : ""}`}
          />
          {phoneError ? (
            <p id="airtime-phone-error" role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500">
              <AlertCircle size={14} aria-hidden="true" />
              {phoneError}
            </p>
          ) : (
            <p id="airtime-phone-hint" className="mt-1.5 text-xs text-ink-400">
              The number to recharge, e.g. 08012345678.
            </p>
          )}
        </section>

        <section aria-labelledby="airtime-amount-heading">
          <h2 id="airtime-amount-heading" className={stepHeading}>
            <span className={stepNumber} aria-hidden="true">3</span>
            Amount
          </h2>
          <div role="group" aria-label="Preset amounts" className="grid grid-cols-3 gap-2.5 sm:grid-cols-6 sm:gap-3">
            {PRESET_AMOUNTS.map((value) => {
              const active = !showAmountInput && amount === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => pickPreset(value)}
                  aria-pressed={active}
                  className={`focus-ring press rounded-xl border bg-white px-2 py-3.5 text-center font-display text-sm font-bold ${
                    active
                      ? "border-cyan-400 bg-cyan-50 text-cyan-800 shadow-[0_0_0_1px_var(--color-cyan-400)]"
                      : "border-slate-200 text-ink-800 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {formatNaira(value)}
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            <label htmlFor="airtime-custom" className="mb-1.5 block text-sm font-semibold text-ink-700">
              Or enter an amount
            </label>
            <input
              id="airtime-custom"
              type="number"
              inputMode="numeric"
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
              step="50"
              placeholder={`${formatNaira(MIN_AMOUNT)} – ${formatNaira(MAX_AMOUNT)}`}
              value={customAmount}
              onChange={(e) => handleCustom(e.target.value)}
              aria-invalid={amountError ? "true" : "false"}
              className="input-base text-base"
            />
            {amountError && (
              <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500">
                <AlertCircle size={14} aria-hidden="true" />
                {amountError}
              </p>
            )}
          </div>
        </section>
      </div>

      <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-base font-bold text-ink-900">Order summary</h2>
          </div>
          <div className="p-5">
            <ul className="space-y-3">
              {summaryRows.map((row) => (
                <li key={row.label} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-ink-500">
                    <row.icon size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink-500">{row.label}</p>
                    <p className={`truncate ${row.emphasize ? "font-display text-lg font-bold text-ink-900" : "text-sm font-semibold text-ink-800"}`}>
                      {row.value}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={buyNow}
              disabled={processing}
              className="gradient-btn focus-ring mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold brand-contrast disabled:cursor-not-allowed disabled:opacity-60"
            >
              {processing && <span aria-hidden="true" className="brand-spin inline-block h-4 w-4 animate-spin rounded-full" />}
              {processing ? "Processing…" : amountValid ? `Buy airtime · ${formatNaira(finalAmount)}` : "Buy airtime"}
            </button>
          </div>
        </div>

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
        title={`${network} airtime`}
        subtitle={phone ? `To ${phone}` : "Enter the number above"}
        amountLabel={amountValid ? formatNaira(finalAmount) : ""}
        ready={amountValid}
        processing={processing}
        onBuy={buyNow}
        error={submitError || amountError}
      />
    </div>
  );
}
