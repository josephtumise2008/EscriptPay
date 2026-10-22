"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NetworkSelector from "@/components/NetworkSelector";
import { validateNigerianPhone } from "@/lib/validators";
import { createAirtimeTransaction, errorMessage } from "@/lib/api";
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
      return;
    }

    setPhoneError("");
    setSubmitError("");
    if (!clientRef.current) clientRef.current = makeReference();

    setProcessing(true);
    try {
      // TEST MODE purchase. The backend re-validates the network and the
      // amount range before creating the transaction.
      const { transaction } = await createAirtimeTransaction({
        network,
        amount: finalAmount,
        phone: phone.trim(),
        clientReference: clientRef.current,
      });

      clientRef.current = null;
      router.push(`/success?ref=${encodeURIComponent(transaction.transactionId)}`);
    } catch (error) {
      clientRef.current = null;
      setSubmitError(errorMessage(error, "Purchase could not be completed. Please try again."));
      setProcessing(false);
    }
  };

  const showAmountInput = customAmount !== "";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-6">
        <section aria-labelledby="airtime-network-heading">
          <h2 id="airtime-network-heading" className="mb-3 font-display text-base font-bold text-ink-800">
            Choose network
          </h2>
          <NetworkSelector selected={network} onSelect={setNetwork} />
        </section>

        <section aria-labelledby="airtime-amount-heading">
          <h2 id="airtime-amount-heading" className="mb-3 font-display text-base font-bold text-ink-800">
            Airtime amount
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {PRESET_AMOUNTS.map((value) => {
              const active = !showAmountInput && amount === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => pickPreset(value)}
                  aria-pressed={active}
                  className={`focus-ring rounded-2xl border px-3 py-4 text-center transition-all duration-200 ${
                    active
                      ? "border-cyan-300 bg-gradient-to-br from-cyan-50 to-purple-lite-100 shadow-[0_8px_24px_-12px_rgb(6_182_212/0.35)]"
                      : "card border-slate-100 hover:border-cyan-200"
                  }`}
                >
                  <span className={`block font-display text-sm font-extrabold ${active ? "gradient-text" : "text-ink-800"}`}>
                    {formatNaira(value)}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                    {network} airtime
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            <label htmlFor="airtime-custom" className="mb-1.5 block text-sm font-semibold text-ink-700">
              Or enter a custom amount
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
              className="input-base"
            />
            {amountError && (
              <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500">
                <AlertCircle size={14} />
                {amountError}
              </p>
            )}
          </div>
        </section>

        <section aria-labelledby="airtime-phone-heading">
          <h2 id="airtime-phone-heading" className="mb-3 font-display text-base font-bold text-ink-800">
            Phone number to recharge
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
            className="input-base"
          />
          {phoneError ? (
            <p
              id="airtime-phone-error"
              role="alert"
              className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500"
            >
              <AlertCircle size={14} />
              {phoneError}
            </p>
          ) : (
            <p id="airtime-phone-hint" className="mt-1.5 text-xs text-ink-400">
              Enter a valid Nigerian number, e.g. 08012345678.
            </p>
          )}
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card card-hover overflow-hidden">
          <div className="gradient-btn px-5 py-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider brand-contrast">
              Order Summary
            </h2>
          </div>

          <div className="p-5">
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-50 to-purple-lite-100 text-cyan-600">
                  <Wifi size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-400">Network</p>
                  <p className="truncate text-sm font-semibold text-ink-800">{network}</p>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-50 to-purple-lite-100 text-cyan-600">
                  <Banknote size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-400">Amount</p>
                  <p className="font-display text-lg font-extrabold gradient-text">
                    {formatNaira(customAmount ? Number(customAmount) : amount)}
                  </p>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-50 to-purple-lite-100 text-cyan-600">
                  <Smartphone size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-400">Phone</p>
                  <p className="truncate text-sm font-semibold text-ink-800">{phone || "—"}</p>
                </div>
              </li>
            </ul>

            <button
              type="button"
              onClick={buyNow}
              disabled={processing}
              className="gradient-btn focus-ring mt-6 w-full rounded-xl px-5 py-3.5 text-sm font-bold brand-contrast disabled:cursor-not-allowed disabled:opacity-60"
            >
              {processing ? "Processing payment..." : "BUY NOW"}
            </button>
            <p className="mt-3 text-center text-xs text-ink-400">
              Test mode — no real money moves and no real airtime is delivered.
            </p>
          </div>
        </div>

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