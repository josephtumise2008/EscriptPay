import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-screen flex-col pt-[env(safe-area-inset-top)]">
      {/* Always-visible way back to the public site. */}
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="focus-ring inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-slate-100 hover:text-ink-900"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to home
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center sm:px-6 sm:pt-0">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-6 flex justify-center">
            <Link href="/" className="focus-ring rounded-lg" aria-label="EscriptPay home">
              <Logo size={38} />
            </Link>
          </div>

          <div className="card p-6 sm:p-8">
            <div className="mb-6 text-center">
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">{title}</h1>
              {subtitle && <p className="mt-2 text-sm text-ink-500">{subtitle}</p>}
            </div>
            {children}
          </div>

          {footer && <div className="mt-6 text-center text-sm text-ink-500">{footer}</div>}

        </div>
      </main>
    </div>
  );
}

export function Field({ label, id, type = "text", value, onChange, placeholder, error, autoComplete, required = false, hint }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-ink-700">
        {label}
        {required && <span className="text-cyan-500"> *</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`input-base ${error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
      />
      <div className="min-h-[1.125rem]">
        {error ? (
          <p id={`${id}-error`} className="text-xs font-medium text-red-500" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={`${id}-hint`} className="text-xs text-ink-400">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}