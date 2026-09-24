import Link from "next/link";
import Logo from "./Logo";

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="animate-fade-up">
            <div className="mb-8 flex justify-center">
              <Link href="/" className="focus-ring rounded-lg" aria-label="EscriptPay home">
                <Logo size={40} />
              </Link>
            </div>

            <div className="card card-hover p-6 sm:p-8">
              <div className="mb-6 text-center">
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-2 text-sm text-ink-500">{subtitle}</p>
                )}
              </div>

              {children}
            </div>

            {footer && <div className="mt-6 text-center text-sm text-ink-500">{footer}</div>}
          </div>
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
        className="input-base"
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-ink-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}