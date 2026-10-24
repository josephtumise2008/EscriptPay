"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck, AlertCircle, CheckCircle2, LogOut } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/lib/auth-context";
import { useLogout } from "@/hooks/useLogout";
import { sendEmailCode, verifyEmailCode, errorMessage } from "@/lib/api";

const LENGTH = 6;

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user, loading, updateUser } = useAuth();
  const { logout, busy: loggingOut } = useLogout();
  const [digits, setDigits] = useState(Array(LENGTH).fill(""));
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputs = useRef([]);
  const requested = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!user.needsEmailVerification && !done) router.replace("/dashboard");
  }, [user, loading, done, router]);

  // Countdown for "Send a new code".
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const requestCode = async ({ silent = false } = {}) => {
    setError("");
    try {
      const data = await sendEmailCode();
      if (data.alreadyVerified) {
        router.replace("/dashboard");
        return;
      }
      setCooldown(data.retryAfter || 60);
      if (!silent) setInfo(`We sent a new code to ${user.email}.`);
    } catch (err) {
      const retry = err?.response?.data?.retryAfter;
      if (retry) setCooldown(retry);
      else if (!silent) setError(errorMessage(err, "We couldn't send the code. Please try again."));
    }
  };

  // Signup already sent a code; this only sends one if none is recent (the
  // server refuses repeats within a minute, which we treat as "already sent").
  useEffect(() => {
    if (!user || !user.needsEmailVerification || requested.current) return;
    requested.current = true;
    requestCode({ silent: true });
    inputs.current[0]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const submit = async (code) => {
    if (code.length !== LENGTH || busy) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const data = await verifyEmailCode(code);
      setDone(true);
      updateUser(data.user);
      setTimeout(() => router.replace("/dashboard"), 900);
    } catch (err) {
      setError(errorMessage(err, "That code didn't work. Please try again."));
      setDigits(Array(LENGTH).fill(""));
      inputs.current[0]?.focus();
      setBusy(false);
    }
  };

  const setDigit = (index, value) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length > 1) {
      // Pasted the whole code.
      const next = clean.slice(0, LENGTH).split("");
      const filled = [...next, ...Array(LENGTH - next.length).fill("")];
      setDigits(filled);
      inputs.current[Math.min(next.length, LENGTH - 1)]?.focus();
      if (next.length === LENGTH) submit(next.join(""));
      return;
    }
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    setError("");
    if (clean && index < LENGTH - 1) inputs.current[index + 1]?.focus();
    if (next.every(Boolean)) submit(next.join(""));
  };

  const onKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner label="Loading…" />
      </div>
    );
  }

  return (
    <AuthLayout title="Verify your email" subtitle="One quick step to protect your account and payments.">
      {done ? (
        <div role="status" className="flex flex-col items-center gap-3 py-4 text-center animate-page-in">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={28} aria-hidden="true" />
          </span>
          <p className="font-display text-lg font-bold text-ink-900">Email verified</p>
          <p className="text-sm text-ink-500">Taking you to your dashboard…</p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(digits.join(""));
          }}
        >
          <div className="mb-5 flex items-start gap-3 rounded-2xl bg-cyan-50 px-4 py-3">
            <MailCheck size={20} className="mt-0.5 shrink-0 text-cyan-600" aria-hidden="true" />
            <p className="text-sm text-ink-700">
              We sent a 6-digit code to <span className="font-semibold text-ink-900">{user.email}</span>. Check your inbox (and spam).
            </p>
          </div>

          <fieldset>
            <legend className="sr-only">Verification code</legend>
            <div className="flex justify-between gap-2">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (inputs.current[i] = el)}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  maxLength={i === 0 ? LENGTH : 1}
                  aria-label={`Digit ${i + 1}`}
                  disabled={busy}
                  className={`input-base h-14 w-full max-w-[3.25rem] px-0 text-center font-display text-2xl font-bold ${
                    error ? "border-red-300" : ""
                  }`}
                />
              ))}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm font-medium text-red-500">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          {info && !error && <p role="status" className="mt-3 text-sm text-emerald-600">{info}</p>}

          <button
            type="submit"
            disabled={busy || digits.some((d) => !d)}
            className="gradient-btn focus-ring mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold brand-contrast disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <span aria-hidden="true" className="brand-spin inline-block h-4 w-4 animate-spin rounded-full" />}
            {busy ? "Verifying…" : "Verify email"}
          </button>

          <div className="mt-5 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => requestCode()}
              disabled={cooldown > 0}
              className="focus-ring rounded font-semibold text-cyan-700 hover:underline disabled:cursor-not-allowed disabled:text-ink-400 disabled:no-underline"
            >
              {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
            </button>
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="focus-ring inline-flex items-center gap-1.5 rounded text-ink-500 hover:text-ink-800"
            >
              <LogOut size={14} aria-hidden="true" />
              Wrong email? Log out
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
