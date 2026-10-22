"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck, ArrowLeft, FlaskConical } from "lucide-react";
import AuthLayout, { Field } from "@/components/AuthLayout";
import { PrimaryButton } from "@/components/ui/Buttons";
import BackgroundGradient from "@/components/BackgroundGradient";
import { forgotPassword, errorMessage } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      // The API always returns the same generic message (no user enumeration),
      // whether or not the account exists.
      const data = await forgotPassword(email.trim());
      setSent(true);
      void data;
    } catch (err) {
      setError(errorMessage(err, "Could not process your request. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <BackgroundGradient />
      <AuthLayout
        title="Reset your password"
        subtitle={sent ? "Check your inbox" : "Enter your email to receive a reset link."}
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
        {sent ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-8 text-center">
            <MailCheck size={34} className="text-emerald-500" />
            <p className="text-sm leading-relaxed text-emerald-700">
              If an account exists for <strong>{email}</strong>, a password reset
              link has been sent. It expires in 60 minutes.
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <Field
                id="email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="you@example.com"
                autoComplete="email"
                required
                error={error}
              />
              <PrimaryButton type="submit" loading={loading} className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </PrimaryButton>
            </form>

            <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-ink-500">
              <FlaskConical size={15} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
              <p>
                Email delivery is still set up for staging. Reset links are printed
                to the backend console so you can test the full flow — real email
                dispatch is a future integration.
              </p>
            </div>
          </>
        )}
      </AuthLayout>
    </>
  );
}