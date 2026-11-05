"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBillsCatalog, verifyBillAccount, createBillTransaction, errorMessage } from "@/lib/api";
import { continueAfterOrder } from "@/lib/checkout";
import { useWallet } from "@/lib/wallet-context";
import { usePayWith } from "@/components/PaymentMethodPicker";

let catalogCache = null;

// Loads the live catalog (cable packages, electricity companies, exam PINs).
export function useBillsCatalog() {
  const [catalog, setCatalog] = useState(catalogCache);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!catalogCache);

  const load = () => {
    setLoading(true);
    setError("");
    getBillsCatalog()
      .then((c) => {
        catalogCache = c;
        setCatalog(c);
      })
      .catch((err) => setError(errorMessage(err, "Could not load this service. Please try again.")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Refresh once on open even when cached, so prices stay current.
  }, []);

  return { catalog, error, loading, reload: load };
}

// Checks the smartcard / meter / profile number with the supplier as soon as
// it looks complete, and shows the owner's name before paying.
//   status: idle | checking | ok | invalid | error
export function useAccountCheck({ service, provider, account, meterType, minLength = 10, enabled = true }) {
  const [state, setState] = useState({ status: "idle", name: "", message: "" });
  const seq = useRef(0);
  const digits = String(account || "").replace(/\D/g, "");
  const key = `${service}|${provider}|${meterType || ""}|${digits}`;

  const run = async () => {
    const id = ++seq.current;
    setState({ status: "checking", name: "", message: "" });
    try {
      const r = await verifyBillAccount({ service, provider, account: digits, meterType });
      if (id === seq.current) setState({ status: "ok", name: r.name, message: "" });
    } catch (err) {
      if (id !== seq.current) return;
      const invalid = err?.response?.status === 404 || err?.response?.data?.code === "invalid_account";
      setState({ status: invalid ? "invalid" : "error", name: "", message: errorMessage(err, "We couldn't check that right now.") });
    }
  };

  useEffect(() => {
    seq.current += 1;
    if (!enabled || !provider || digits.length < minLength) {
      setState({ status: "idle", name: "", message: "" });
      return undefined;
    }
    const t = setTimeout(run, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, minLength]);

  return { ...state, recheck: run, digits };
}

const makeReference = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ref_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// Places the order (wallet or Paystack popup) and moves on to the order page.
export function useBillOrder(amount, from) {
  const router = useRouter();
  const pay = usePayWith(amount);
  const { applyBalance, refresh } = useWallet();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const clientRef = useRef(null);

  useEffect(() => {
    const onPageShow = (event) => {
      if (event.persisted) setProcessing(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const submit = async (body) => {
    setError("");
    if (pay.value === "wallet" && !pay.enough) {
      setError("Your wallet balance is too low for this. Fund your wallet or choose card / bank.");
      return;
    }
    if (!clientRef.current) clientRef.current = makeReference();
    setProcessing(true);
    try {
      const data = await createBillTransaction({ ...body, payWith: pay.value, clientReference: clientRef.current });
      clientRef.current = null;
      if (data.wallet) applyBalance(data.wallet.balance);
      const step = await continueAfterOrder(router, data, from);
      if (step === "popup") setProcessing(false);
    } catch (err) {
      clientRef.current = null;
      setError(errorMessage(err, "Purchase could not be completed. Please try again."));
      setProcessing(false);
      if (pay.value === "wallet") refresh();
    }
  };

  return { pay, processing, error, setError, submit };
}
