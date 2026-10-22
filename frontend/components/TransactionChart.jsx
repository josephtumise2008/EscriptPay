"use client";

import { useId } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { formatNaira } from "@/lib/format";

const PERIOD_META = {
  "7d": { title: "Last 7 days", subtitle: "Successful test purchases." },
  "30d": { title: "Last 30 days", subtitle: "Successful test purchases." },
  all: { title: "All time", subtitle: "Successful test purchases by month." },
};

// Line chart of the user's successful transaction amounts for a selected
// range ("7d" | "30d" | "all"). `data` is [{ label, amount }].
export default function TransactionChart({
  data = [],
  loading = false,
  period = "7d",
}) {
  const gradientId = useId().replace(/:/g, "") + "-grad";
  const lineId = useId().replace(/:/g, "") + "-line";

  const width = 640;
  const height = 220;
  const padX = 24;
  const padY = 28;

  const meta = PERIOD_META[period] || PERIOD_META["7d"];

  if (data.length < 2) {
    return (
      <div className="card p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-ink-800">{meta.title}</h2>
        <p className="mt-0.5 text-xs text-ink-400">{meta.subtitle}</p>
        {loading ? (
          <LoadingSpinner size={32} label="Loading chart..." />
        ) : (
          <p className="py-10 text-center text-sm text-ink-400">
            Not enough data to chart yet — your test purchases will appear here.
          </p>
        )}
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.amount), 1);
  const stepX = (width - padX * 2) / (data.length - 1);
  const points = data.map((d, i) => ({
    x: padX + i * stepX,
    y: padY + (1 - d.amount / max) * (height - padY * 2),
    ...d,
  }));

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath =
    points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
      .join(" ") +
    ` L${points[points.length - 1].x},${height - padY} L${points[0].x},${
      height - padY
    } Z`;

  // Thin the x-axis labels when there are many buckets.
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink-800">{meta.title}</h2>
          <p className="mt-0.5 text-xs text-ink-400">{meta.subtitle}</p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-ink-400">
          {formatNaira(max)} peak
        </span>
      </div>

      {loading ? (
        <LoadingSpinner size={32} label="Loading chart..." />
      ) : (
        <>
          <div className="mt-4" role="img" aria-label={`Line chart of transactions, ${meta.title}`}>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-52 w-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                </linearGradient>
              </defs>

              {[0.25, 0.5, 0.75].map((f) => (
                <line
                  key={f}
                  x1={padX}
                  x2={width - padX}
                  y1={padY + f * (height - padY * 2)}
                  y2={padY + f * (height - padY * 2)}
                  stroke="var(--color-slate-200)"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
              ))}

              <path d={areaPath} fill={`url(#${gradientId})`} className="animate-fade-in" />
              <path
                id={lineId}
                d={path}
                fill="none"
                stroke="url(#chartLine)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="600"
                className="animate-draw"
              />
              <linearGradient id="chartLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="60%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>

              {points.map((p, i) => (
                <g key={`${p.label}-${i}`}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill="white"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    className="animate-pop"
                    style={{ animationDelay: `${0.5 + i * 0.05}s` }}
                  />
                </g>
              ))}
            </svg>
          </div>

          <div className="mt-2 grid" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
            {data.map((d, i) => (
              <div key={`${d.label}-${i}`} className="text-center">
                <p className="text-xs font-semibold text-ink-500">
                  {i % labelEvery === 0 ? d.label : "\u00A0"}
                </p>
                <p className="text-[10px] text-ink-400">{formatNaira(d.amount)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}