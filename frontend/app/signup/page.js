"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import AuthLayout, { Field } from "@/components/AuthLayout";
import { PrimaryButton } from "@/components/ui/Buttons";
import BackgroundGradient from "@/components/BackgroundGradient";
import { useAuth } from "@/lib/auth-context";
import { validateNigerianPhone } from "@/lib/validators";

const initial = { fullName: "", email: "", phone: "", password: "", confirm: "" };

export default function SignupPage() {
  const router = useRouter();
  const { register, user } = useAuth();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  // simpler: guard via useEffect
  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: "" }));
  };

  const validate = () => {
    const next = {};
    if (values.fullName.trim().length < 3)
      next.fullName = "Enter your full name (minimum 3 characters).";
    if (!/^\S+@\S+\.\S+$/.test(values.email)) next.email = "Enter a valid email address.";
    const phone = validateNigerianPhone(values.phone);
    if (!phone.valid) next.phone = phone.message;
    if (values.password.length < 8)
      next.password = "Password must be at least 8 characters.";
    if (values.confirm !== values.password)
      next.confirm = "Passwords do not match.";
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    setSubmitError("");
    const { error } = await register(values);
    setSubmitting(false);

    if (error) {
      setSubmitError(error);
      return;
    }
    router.replace("/dashboard");
  };

  return (
    <>
      <BackgroundGradient />
      <AuthLayout
        title="Create your account"
        subtitle="Start buying data in minutes."
        footer={
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-cyan-600 hover:text-cyan-700">
              Login
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
            id="fullName"
            label="Full Name"
            value={values.fullName}
            onChange={set("fullName")}
            placeholder="Joseph Abimbola"
            autoComplete="name"
            required
            error={errors.fullName}
          />
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
          <Field
            id="phone"
            label="Phone Number"
            type="tel"
            value={values.phone}
            onChange={set("phone")}
            placeholder="08012345678"
            autoComplete="tel"
            required
            error={errors.phone}
          />
          <div className="relative">
            <Field
              id="password"
              label="Password"
              type={passwordVisible ? "text" : "password"}
              value={values.password}
              onChange={set("password")}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
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
          <div className="relative">
            <Field
              id="confirm"
              label="Confirm Password"
              type={showPassword ? "text" : "password"}
              value={values.confirm}
              onChange={set("confirm")}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              required
              error={errors.confirm}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="focus-ring absolute right-3 top-9 rounded-md p-1 text-ink-400 hover:text-ink-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <PrimaryButton type="submit" loading={submitting} className="w-full" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </PrimaryButton>
        </form>
      </AuthLayout>
    </>
  );
}