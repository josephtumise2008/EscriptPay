"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Zap, Wifi, Phone, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { getSelfOrderInfo, createSelfOrder, errorMessage } from "@/lib/api";
import { formatNaira, formatDateTime } from "@/lib/format";
import { detectNetwork } from "@/lib/networks";
import { validateNigerianPhone } from "@/lib/validators";

const NETWORKS = ["MTN", "Airtel", "Glo", "9mobile"];
const newKey = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? `self-${crypto.randomUUID()}` : `self-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const STATUS = {
  successful: { icon: CheckCircle2, text: "Delivered", className: "text-emerald-600" },
  failed: { icon: AlertCircle, text: "Failed", className: "text-red-600" },
  pending: { icon: Clock, text: "Processing", className: "text-amber-600" },
};

// Admin only: send data or airtime to your own line, paid straight from the
// ClubKonnect balance (like the terminal test order). Not counted as sales.
export default function SelfOrder({ onDone }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [type, setType] = useState("data");
  const [network, setNetwork] = useState("MTN");
  const [planId, setPlanId] = useState("");
  const [amount, setAmount] = useState("500");
  const [phone, setPhone] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const key = useRef(newKey());

  const load = () =>
    getSelfOrderInfo()
      .then((d) => {
        setInfo(d);
        setPhone((p) => p || d.phone || "");
      })
      .catch((err) => setError(errorMessage(err, "Could not load plans.")));

  useEffect(() => {
    load();
  }, []);

  // Pick the network from the number, like the customer pages.
  useEffect(() => {
    const n = detectNetwork(phone);
    if (n) setNetwork(n);
  }, [phone]);

  const plans = useMemo(() => (info ? info.plans.filter((p) => p.network === network) : []), [info, network]);
  const plan = plans.find((p) => p.id === planId) || null;
  useEffect(() => {
    if (planId && !plans.some((p) => p.id === planId)) setPlanId("");
  }, [plans, planId]);

  const cost = type === "data" ? (plan ? plan.cost ?? plan.price : null) : Number(amount);
  const phoneOk = validateNigerianPhone(phone).valid;
  const amountOk = type === "data" ? !!plan : Number.isInteger(Number(amount)) && Number(amount) >= 50 && Number(amount) <= (info?.maxNaira || 20000);
  const ready = info && phoneOk && amountOk;

  const send = async () => {
    setSending(true);
    setError("");
    setResult(null);
    try {
      const order = await createSelfOrder(
        type === "data"
          ? { type, planId, phone, clientReference: key.current }
          : { type, network, amount: Number(amount), phone, clientReference: key.current }
      );
      setResult(order);
      key.current = newKey();
      setConfirming(false);
      load();
      if (onDone) onDone();
    } catch (err) {
      setError(errorMessage(err, "Could not send it. Check the list below before trying again."));
      setConfirming(false);
      load();
    } finally {
      setSending(false);
    }
  };

  const tab = (value, Icon, label) => (
    <button
      type="button"
      onClick={() => {
        setType(value);
        setConfirming(false);
        setResult(null);
      }}
      aria-pressed={type === value}
      className={`focus-ring flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${
        type === value ? "bg-white text-cyan-700 shadow-sm" : "text-ink-500 hover:text-ink-700"
      }`}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </button>
  );

  const st = result ? STATUS[result.status] || STATUS.pending : null;

  return (
    <section aria-labelledby="self-order-heading" className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="self-order-heading" className="flex items-center gap-2 font-display text-lg font-bold text-ink-800">
          <Zap size={18} className="text-amber-500" aria-hidden="true" />
          Buy for myself
        </h2>
        <p className="text-xs text-ink-500">Paid from your ClubKonnect balance · not counted as sales</p>
      </div>

      {!info && !error ? (
        <p className="mt-4 text-sm text-ink-500">Loading plans…</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex rounded-xl bg-slate-100 p-1">
              {tab("data", Wifi, "Data")}
              {tab("airtime", Phone, "Airtime")}
            </div>

            <div>
              <label htmlFor="self-phone" className="text-xs font-semibold text-ink-600">
                Number
              </label>
              <input
                id="self-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/[^\d+]/g, ""));
                  setConfirming(false);
                }}
                placeholder="08012345678"
                className="input-base mt-1 text-base"
              />
            </div>

            <div className="grid grid-cols-4 gap-2" role="group" aria-label="Network">
              {NETWORKS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setNetwork(n);
                    setConfirming(false);
                  }}
                  aria-pressed={network === n}
                  className={`focus-ring rounded-lg border px-2 py-2 text-xs font-bold ${
                    network === n ? "border-cyan-400 bg-cyan-50 text-cyan-800" : "border-slate-200 bg-white text-ink-600"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {type === "data" ? (
              <div>
                <label htmlFor="self-plan" className="text-xs font-semibold text-ink-600">
                  {network} plan
                </label>
                <select
                  id="self-plan"
                  value={planId}
                  onChange={(e) => {
                    setPlanId(e.target.value);
                    setConfirming(false);
                  }}
                  className="input-base mt-1 text-sm"
                >
                  <option value="">Choose a plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.validity} · costs you {formatNaira(p.cost ?? p.price)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label htmlFor="self-amount" className="text-xs font-semibold text-ink-600">
                  Airtime amount (₦50 – {formatNaira(info?.maxNaira || 20000)})
                </label>
                <input
                  id="self-amount"
                  type="number"
                  inputMode="numeric"
                  min={50}
                  max={info?.maxNaira || 20000}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value.replace(/\D/g, ""));
                    setConfirming(false);
                  }}
                  className="input-base mt-1 text-base"
                />
              </div>
            )}

            {!confirming ? (
              <button
                type="button"
                disabled={!ready || sending}
                onClick={() => setConfirming(true)}
                className="focus-ring press h-11 w-full rounded-xl bg-ink-900 px-4 text-sm font-bold text-white disabled:opacity-40"
              >
                {ready && cost ? `Send ${type === "data" ? plan.name : `${formatNaira(cost)} airtime`}` : "Fill in the details"}
              </button>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-900">
                  Send {type === "data" ? `${network} ${plan?.name}` : `${network} ${formatNaira(cost)} airtime`} to {phone}?
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  {info?.simulated ? "Test mode: nothing real is sent." : `About ${formatNaira(cost)} comes off your ClubKonnect balance.`}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={send}
                    disabled={sending}
                    className="focus-ring press h-10 flex-1 rounded-lg bg-amber-600 px-3 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {sending ? "Sending…" : "Yes, send it"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={sending}
                    className="focus-ring h-10 rounded-lg px-3 text-sm font-semibold text-ink-600 hover:bg-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-red-600">
                <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}
            {st && (
              <p role="status" className={`flex items-center gap-1.5 text-sm font-semibold ${st.className}`}>
                <st.icon size={16} aria-hidden="true" />
                {st.text}
                {result.status === "pending" && <span className="font-normal text-ink-500">: it&apos;ll finish on its own, check below.</span>}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Recent</p>
            {info?.recent?.length ? (
              <ul className="mt-2 divide-y divide-slate-100">
                {info.recent.map((o) => {
                  const s = STATUS[o.status] || STATUS.pending;
                  return (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink-800">
                          {o.network} {o.type === "data" ? o.plan : "airtime"} · {formatNaira(o.cost)}
                        </span>
                        <span className="block text-xs text-ink-500">
                          {o.phone.startsWith("+234") ? `0${o.phone.slice(4)}` : o.phone} · {formatDateTime(o.createdAt)}
                        </span>
                      </span>
                      <span className={`flex shrink-0 items-center gap-1 text-xs font-bold ${s.className}`}>
                        <s.icon size={13} aria-hidden="true" />
                        {s.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-500">Nothing yet.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
