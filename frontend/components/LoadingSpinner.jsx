export default function LoadingSpinner({ size = 40, label = "Loading...", className = "" }) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`flex flex-col items-center justify-center gap-4 py-10 ${className}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute inset-0 rounded-full border-2 border-slate-200" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-cyan-500 border-r-sky-400" />
        <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-cyan-100 to-purple-lite-100 opacity-60" />
      </div>
      <p className="text-sm font-medium text-ink-500">{label}</p>
    </div>
  );
}

export function InlineSpinner({ size = 18, className = "" }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`brand-spin inline-block animate-spin rounded-full border-2 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}