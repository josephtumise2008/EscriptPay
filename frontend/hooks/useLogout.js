"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// One-tap logout: ends the server session, goes to the homepage, then clears
// the local user. If the server can't be reached the user stays signed in and
// `error` explains why (the session cookie can only be cleared by the server).
export function useLogout() {
  const { logout, clearSession } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await logout({ keepLocal: true });
    if (result?.error) {
      setBusy(false);
      setError(result.error);
      setTimeout(() => setError(""), 5000);
      return;
    }
    router.replace("/");
    // Clear after the navigation has started so the dashboard doesn't
    // re-render as "signed out" and redirect to /login.
    // `busy` stays true: this component is on its way out, and keeping it set
    // stops the dashboard from treating the cleared session as "redirect to login".
    setTimeout(clearSession, 150);
  }, [busy, logout, clearSession, router]);

  return { logout: run, busy, error };
}

export function LogoutErrorToast({ message }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-sm animate-fade-up rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-medium text-red-600 shadow-[0_20px_40px_-20px_rgb(15_23_42/0.4)] lg:bottom-6"
    >
      {message}
    </div>
  );
}
