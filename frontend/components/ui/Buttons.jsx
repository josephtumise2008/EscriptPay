import Link from "next/link";

export function PrimaryButton({
  children,
  type = "button",
  className = "",
  disabled = false,
  loading = false,
  onClick,
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`gradient-btn focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold brand-contrast disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="brand-spin inline-block h-4 w-4 animate-spin rounded-full border-2"
        />
      )}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  type = "button",
  className = "",
  disabled = false,
  onClick,
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 transition-all duration-200 hover:border-cyan-300 hover:text-cyan-700 hover:shadow-[var(--shadow-card)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({ href, children, className = "", kind = "primary" }) {
  const base =
    "focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200";
  const styles =
    kind === "primary"
      ? "gradient-btn brand-contrast"
      : "border border-slate-200 bg-white text-ink-700 hover:border-cyan-300 hover:text-cyan-700 hover:shadow-[var(--shadow-card)]";

  return (
    <Link href={href} className={`${base} ${styles} ${className}`}>
      {children}
    </Link>
  );
}