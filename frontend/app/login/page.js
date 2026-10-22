"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import AuthLayout, { Field } from "@/components/AuthLayout";
import { PrimaryButton } from "@/components/ui/Buttons";
import BackgroundGradient from "@/components/BackgroundGradient";
import { useAuth } from "@/lib/auth-context";

const initial = { email: "", password: "" };

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: "" }));
  };

  const validate = () => {
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(values.email)) next.email = "Enter a valid email address.";
    if (!values.password) next.password = "Password is required.";
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    setSubmitError("");
    const { error } = await login(values.email, values.password);
    setSubmitting(false);

    if (error) {
      setSubmitError(error);
      return;
    }

    // Preserve a safe internal redirect target (e.g. /success?ref=...).
    const params = new URLSearchParams(window.location.search);
    const redirectTo = params.get("next");
    // Only same-site paths: "//evil.com" and "/\\evil.com" are protocol-relative
    // URLs that browsers treat as another site.
    const safe =
      redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") && !redirectTo.startsWith("/\\");
    router.replace(safe ? redirectTo : "/dashboard");
  };

  return (
    <>
      <BackgroundGradient />
      <AuthLayout
        title="Welcome back"
        subtitle="Sign in to your EscriptPay account."
        footer={
          <>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-cyan-600 hover:text-cyan-700">
              Sign up
            </Link>
          </>
        }
      >
        {submitError && (
          <div
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
          >
            <AlertCircle size={17} />
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field
            id="email"
            label="Email"
            type="email"
            value={values.email}
            onChange={set("email")}
            placeholder="you@example.com"
            autoComplete="email"
            required
            error={errors.email}
          />
          <div className="relative">
            <Field
              id="password"
              label="Password"
              type={passwordVisible ? "text" : "password"}
              value={values.password}
              onChange={set("password")}
              placeholder="Your password"
              autoComplete="current-password"
              required
              error={errors.password}
            />
            <button
              type="button"
              onClick={() => setPasswordVisible((v) => !v)}
              className="focus-ring absolute right-3 top-9 rounded-md p-1 text-ink-400 hover:text-ink-600"
              aria-label={passwordVisible ? "Hide password" : "Show password"}
            >
              {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-ink-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-400"
              />
              Remember me
            </label>
            <Link
              href="/forgot-password"
              className="font-medium text-cyan-600 transition-colors hover:text-cyan-700"
            >
              Forgot password?
            </Link>
          </div>

          <PrimaryButton type="submit" loading={submitting} className="w-full" disabled={submitting}>
            {submitting ? "Signing in..." : "Login"}
          </PrimaryButton>
        </form>

        <div className="mt-5 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-ink-500">
          Verify builds: sign in with any email you registered on{" "}
          <Link href="/signup" className="font-semibold text-cyan-600">
            Create Account
          </Link>{" "}
          — authentication is local for V1.
        </div>
      </AuthLayout>
    </>
  );
}