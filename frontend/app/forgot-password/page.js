"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck, ArrowLeft } from "lucide-react";
import AuthLayout, { Field } from "@/components/AuthLayout";
import { PrimaryButton } from "@/components/ui/Buttons";
import BackgroundGradient from "@/components/BackgroundGradient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    // V1: no email backend yet — simulate the reset request.
    setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 900);
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
              link has been sent. (V1 demo — no email was actually sent.)
            </p>
          </div>
        ) : (
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
        )}
      </AuthLayout>
    </>
  );
}