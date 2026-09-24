export default function EmptyState({
  icon = null,
  title,
  description,
  action = null,
  className = "",
}) {
  return (
    <div
      className={`card card-hover flex flex-col items-center justify-center gap-3 px-6 py-14 text-center ${className}`}
    >
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-100 via-sky-100 to-purple-lite-100 text-cyan-600">
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg font-bold text-ink-800">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm leading-relaxed text-ink-500">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}