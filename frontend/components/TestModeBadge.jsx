import { FlaskConical } from "lucide-react";

// Small badge shown across the app so users understand purchases are
// simulated and no real money moves.
export default function TestModeBadge({ className = "" }) {
  return (
    <span
      title="All purchases are simulated — no real money moves."
      className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200 ${className}`}
    >
      <FlaskConical size={13} aria-hidden="true" />
      Test Mode
    </span>
  );
}