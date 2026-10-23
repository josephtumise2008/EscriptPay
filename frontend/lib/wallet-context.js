"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getWalletBalance } from "@/lib/api";

// Wallet balance shared by the header, account menu, wallet page and
// checkout. The server is the only source of truth: this just caches the
// last value it returned and refreshes it when the tab regains focus.

const HIDE_KEY = "escriptpay-hide-balance";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null); // { balance, currency, mode, limits }
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(HIDE_KEY) === "1");
    } catch {
      // storage unavailable — balance stays visible
    }
  }, []);

  const toggleHidden = useCallback(() => {
    setHidden((value) => {
      const next = !value;
      try {
        localStorage.setItem(HIDE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return null;
    const id = ++requestId.current;
    setLoading(true);
    try {
      const next = await getWalletBalance();
      if (id === requestId.current) setWallet(next);
      return next;
    } catch {
      return null;
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [user]);

  // Apply a balance the server just returned (after a purchase or top-up).
  const applyBalance = useCallback((balance) => {
    if (typeof balance !== "number") return;
    requestId.current += 1; // a slower in-flight refresh must not overwrite it
    setWallet((current) => ({ ...(current || {}), balance }));
  }, []);

  useEffect(() => {
    if (!user) {
      setWallet(null);
      return undefined;
    }
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user, refresh]);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        balance: wallet ? wallet.balance : null,
        loading,
        hidden,
        toggleHidden,
        refresh,
        applyBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

const FALLBACK = {
  wallet: null,
  balance: null,
  loading: false,
  hidden: false,
  toggleHidden: () => {},
  refresh: async () => null,
  applyBalance: () => {},
};

export const useWallet = () => useContext(WalletContext) || FALLBACK;
