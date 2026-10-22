"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  FlaskConical,
} from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { PrimaryButton } from "@/components/ui/Buttons";
import BackgroundGradient from "@/components/BackgroundGradient";
import { resetPassword, errorMessage } from "@/lib/api";
import { passwordStrength } from "@/lib/password";

function ResetPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strength = passwordStrength(password);
  const meterWidth = `${(strength.score / 5) * 100}%`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is missing its token. Use the link from your email.");
      return;
    }
    if (password.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err, "Could not reset your password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <BackgroundGradient />
      <AuthLayout
        title={done ? "Password reset" : "Create a new password"}
        subtitle={
          done
            ? "Your password has been updated."
            : "Choose a strong password you haven't used anywhere else."
        }
        footer={
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-semibold text-cyan-600 hover:text-cyan-700"
          >
            <ArrowLeft size={15} />
            Back to login
          </Link>
        }
      >
        {done ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-8 text-center">
            <CheckCircle2 size={34} className="text-emerald-500" />
            <p className="text-sm leading-relaxed text-emerald-700">
              Your password has been reset successfully. You can now sign in
              with your new password.
            </p>
            <PrimaryButton
              type="button"
              className="mt-1"
              onClick={() => router.push("/login")}
            >
              Sign In
            </PrimaryButton>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {!token && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
              >
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                This reset link is incomplete. Copy the full link you received
                and try again.
              </p>
            )}

            <div>
              <label htmlFor="reset-password" className="mb-1.5 block text-sm font-semibold text-ink-700">
                New password <span className="text-cyan-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="reset-password"
                  name="reset-password"
                  type={visible ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                  aria-invalid={error ? "true" : "false"}
                  className="input-base pr-11"
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => !v)}
                  className="focus-ring absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:text-ink-600"
                  aria-label={visible ? "Hide password" : "Show password"}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: meterWidth }}
                      />
                    </div>
                    <span className={`w-14 shrink-0 text-right text-xs font-semibold ${strength.text}`}>
                      {strength.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-400">{strength.hint}</p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="reset-confirm" className="mb-1.5 block text-sm font-semibold text-ink-700">
                Confirm new password <span className="text-cyan-500">*</span>
              </label>
              <input
                id="reset-confirm"
                name="reset-confirm"
                type={visible ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                required
                className="input-base"
              />
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-2 text-sm font-medium text-red-500">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <PrimaryButton type="submit" loading={loading} className="w-full" disabled={loading}>
              <KeyRound size={16} />
              {loading ? "Resetting..." : "Reset Password"}
            </PrimaryButton>

            <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-ink-500">
              <FlaskConical size={15} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
              <p>
                Reset links are single-use and expire after 60 minutes. In
                staging, links are printed to the backend console.
              </p>
            </div>
          </form>
        )}
      </AuthLayout>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}