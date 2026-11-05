"use client";

import { useState } from "react";
import { Zap, Gauge, Banknote, Smartphone, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { validateNigerianPhone } from "@/lib/validators";
import { formatNaira } from "@/lib/format";
import { useBillsCatalog, useAccountCheck, useBillOrder } from "./useBills";
import { BillCheckout, Step, ChoiceGrid, AccountField, PhoneField, CatalogState } from "./BillCheckout";

const PRESETS = [1000, 2000, 3000, 5000, 10000, 20000];

export default function ElectricityForm() {
  const { user } = useAuth();
  const { catalog, error, loading, reload } = useBillsCatalog();
  const el = catalog?.electricity;
  const [disco, setDisco] = useState("07");
  const [meterType, setMeterType] = useState("01");
  const [meter, setMeter] = useState("");
  const [amount, setAmount] = useState(2000);
  const [custom, setCustom] = useState("");
  const [phone, setPhone] = useState(user?.phone ? String(user.phone).replace(/^\+234/, "0") : "");
  const [phoneError, setPhoneError] = useState("");

  const check = useAccountCheck({ service: "electricity", provider: disco, account: meter, meterType, minLength: 10 });
  const value = custom ? Number(custom) : amount;
  const min = el?.min ?? 1000;
  const max = el?.max ?? 200000;
  const amountOk = Number.isInteger(value) && value >= min && value <= max;
  const order = useBillOrder(amountOk ? value : NaN, "electricity");
  const company = el?.companies.find((c) => c.code === disco);
  const ready = Boolean(company && amountOk && check.status === "ok");

  const buy = () => {
    const ph = validateNigerianPhone(phone);
    if (!ph.valid) {
      setPhoneError(ph.message);
      return;
    }
    if (!ready) {
      order.setError(check.status !== "ok" ? "Enter a valid meter number first." : `Enter an amount between ${formatNaira(min)} and ${formatNaira(max)}.`);
      return;
    }
    order.submit({ service: "electricity", provider: disco, meterType, amount: value, account: check.digits, phone: phone.trim() });
  };

  if (!catalog) return <CatalogState loading={loading} error={error} onRetry={reload} />;

  return (
    <BillCheckout
      step={5}
      amount={amountOk ? value : NaN}
      cardFee={catalog.cardFee}
      order={order}
      onBuy={buy}
      ready={ready}
      title={`${company?.short || "Electricity"} ${meterType === "01" ? "prepaid" : "postpaid"}`}
      subtitle={check.status === "ok" ? check.name : "Enter your meter number"}
      rows={[
        { label: "Company", value: company ? `${company.name} (${company.short})` : "", icon: Zap },
        { label: "Meter", value: check.status === "ok" ? `${check.digits} · ${check.name}` : meter, icon: Gauge },
        { label: "Amount", value: amountOk ? formatNaira(value) : "", icon: Banknote },
        { label: "Phone", value: phone, icon: Smartphone },
      ]}
    >
      <Step n={1} id="el-company" title="Electricity company">
        <ChoiceGrid
          label="Electricity company"
          cols="grid-cols-2 sm:grid-cols-3"
          options={(el?.companies || []).map((c) => ({ value: c.code, title: c.short, detail: c.name }))}
          value={disco}
          onChange={setDisco}
        />
      </Step>

      <Step n={2} id="el-type" title="Meter type">
        <ChoiceGrid
          label="Meter type"
          cols="grid-cols-2"
          options={[
            { value: "01", title: "Prepaid", detail: "You get a token to load" },
            { value: "02", title: "Postpaid", detail: "Pays your monthly bill" },
          ]}
          value={meterType}
          onChange={setMeterType}
        />
      </Step>

      <Step n={3} id="el-meter" title="Meter number">
        <AccountField
          id="el-meter-no"
          label={meterType === "01" ? "Meter number" : "Meter / account number"}
          placeholder="e.g. 45031234567"
          value={meter}
          onChange={setMeter}
          check={check}
          hint="We'll show the name on the meter so you can confirm before paying."
        />
      </Step>

      <Step n={4} id="el-amount" title="Amount">
        <div role="group" aria-label="Preset amounts" className="grid grid-cols-3 gap-2.5">
          {PRESETS.map((v) => {
            const active = !custom && amount === v;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setAmount(v);
                  setCustom("");
                }}
                className={`focus-ring press rounded-xl border bg-white px-2 py-3.5 font-display text-sm font-bold ${
                  active ? "border-cyan-400 bg-cyan-50 text-cyan-800 shadow-[0_0_0_1px_var(--color-cyan-400)]" : "border-slate-200 text-ink-800 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {formatNaira(v)}
              </button>
            );
          })}
        </div>
        <label htmlFor="el-custom" className="mb-1.5 mt-3 block text-sm font-semibold text-ink-700">Or enter an amount</label>
        <input
          id="el-custom"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          placeholder={`${formatNaira(min)} – ${formatNaira(max)}`}
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ""))}
          className="input-base text-base"
        />
        {custom && !amountOk && (
          <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500">
            <AlertCircle size={14} aria-hidden="true" /> Enter an amount between {formatNaira(min)} and {formatNaira(max)}.
          </p>
        )}
      </Step>

      <PhoneField id="el-phone" value={phone} onChange={(v) => { setPhone(v); setPhoneError(""); }} error={phoneError} hint="Your electricity company may also send the token to this number." />
    </BillCheckout>
  );
}
