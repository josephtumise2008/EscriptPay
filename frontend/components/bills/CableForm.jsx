"use client";

import { useState } from "react";
import { Tv, Package, CreditCard as Card, Smartphone, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { validateNigerianPhone } from "@/lib/validators";
import { formatNaira } from "@/lib/format";
import { useBillsCatalog, useAccountCheck, useBillOrder } from "./useBills";
import { BillCheckout, Step, ChoiceGrid, AccountField, PhoneField, CatalogState } from "./BillCheckout";

export default function CableForm() {
  const { user } = useAuth();
  const { catalog, error, loading, reload } = useBillsCatalog();
  const providers = (catalog?.cable || []).filter((g) => g.packages.length > 0);
  const [providerId, setProviderId] = useState("dstv");
  const provider = providers.find((p) => p.id === providerId) || providers[0];
  const [card, setCard] = useState("");
  const [query, setQuery] = useState("");
  const [packageCode, setPackageCode] = useState("");
  const [phone, setPhone] = useState(user?.phone ? String(user.phone).replace(/^\+234/, "0") : "");
  const [phoneError, setPhoneError] = useState("");

  const check = useAccountCheck({ service: "cable", provider: provider?.id, account: card, minLength: 10 });
  const q = query.trim().toLowerCase();
  const allPackages = provider?.packages || [];
  const packages = q ? allPackages.filter((p) => p.name.toLowerCase().includes(q)) : allPackages;
  const pkg = provider?.packages.find((p) => p.code === packageCode) || null;
  const order = useBillOrder(pkg ? pkg.price : NaN, "cable");

  const ready = Boolean(provider && pkg && check.status === "ok");

  const buy = () => {
    const ph = validateNigerianPhone(phone);
    if (!ph.valid) {
      setPhoneError(ph.message);
      return;
    }
    if (!ready) {
      order.setError(check.status !== "ok" ? "Enter a valid smartcard number first." : "Choose a package.");
      return;
    }
    order.submit({ service: "cable", provider: provider.id, packageCode: pkg.code, account: check.digits, phone: phone.trim() });
  };

  if (!catalog) return <CatalogState loading={loading} error={error || "Cable TV isn't available right now."} onRetry={reload} />;

  return (
    <BillCheckout
      step={4}
      amount={pkg ? pkg.price : NaN}
      cardFee={catalog.cardFee}
      order={order}
      onBuy={buy}
      ready={ready}
      title={pkg ? pkg.name : `${provider?.name || "Cable"} subscription`}
      subtitle={check.status === "ok" ? check.name : "Enter your smartcard number"}
      rows={[
        { label: "Provider", value: provider?.name, icon: Tv },
        { label: "Smartcard", value: check.status === "ok" ? `${check.digits} · ${check.name}` : card, icon: Card },
        { label: "Package", value: pkg?.name, icon: Package },
        { label: "Phone", value: phone, icon: Smartphone },
      ]}
    >
      <Step n={1} id="cable-provider" title="Provider">
        <ChoiceGrid
          label="Cable provider"
          options={providers.map((p) => ({ value: p.id, title: p.name }))}
          value={provider?.id}
          onChange={(v) => {
            setProviderId(v);
            setPackageCode("");
            setQuery("");
          }}
        />
      </Step>

      <Step n={2} id="cable-card" title="Smartcard / IUC number">
        <AccountField
          id="cable-smartcard"
          label="Smartcard / IUC number"
          placeholder="e.g. 7023456789"
          value={card}
          onChange={setCard}
          check={check}
          hint="It's on your decoder or on the back of your smartcard. We'll show the owner's name to confirm."
        />
      </Step>

      <Step n={3} id="cable-package" title="Package">
        <div className="relative mb-2.5">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${provider?.name || ""} packages`}
            aria-label="Search packages"
            className="input-base pl-10 text-sm"
          />
        </div>
        <div className="max-h-[22rem] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white" role="radiogroup" aria-label="Packages">
          {packages.length === 0 && <p className="p-4 text-sm text-ink-500">No package matches “{query}”.</p>}
          {packages.map((p) => {
            const active = p.code === packageCode;
            return (
              <button
                key={p.code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPackageCode(p.code)}
                className={`focus-ring flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 ${
                  active ? "bg-cyan-50" : "hover:bg-slate-50"
                }`}
              >
                <span className={`min-w-0 text-sm font-semibold ${active ? "text-cyan-800" : "text-ink-800"}`}>{p.name}</span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-sm font-bold text-ink-900">{formatNaira(p.price)}</span>
                  {p.networkPrice > p.price && <span className="block text-[11px] text-ink-400 line-through">{formatNaira(p.networkPrice)}</span>}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-emerald-700">Paying from your wallet is cheaper than the usual price, with no fee.</p>
      </Step>

      <PhoneField id="cable-phone" value={phone} onChange={(v) => { setPhone(v); setPhoneError(""); }} error={phoneError} />
    </BillCheckout>
  );
}
