"use client";

import { useId } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { formatNaira } from "@/lib/format";

// Weekly chart computed from the authenticated user's transactions.
export default function TransactionChart({ data = [], loading = false }) {
  const gradientId = useId().replace(/:/g, "") + "-grad";
  const lineId = useId().replace(/:/g, "") + "-line";

  const width = 640;
  const height = 220;
  const padX = 24;
  const padY = 28;

  if (data.length < 2) {
    return (
      <div className="card p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-ink-800">Weekly Transactions</h2>
        <p className="mt-0.5 text-xs text-ink-400">Successful test purchases this week.</p>
        {loading ? (
          <LoadingSpinner size={32} label="Loading chart..." />
        ) : (
          <p className="py-10 text-center text-sm text-ink-400">
            No weekly data yet — your test purchases will be charted here.
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

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-ink-800">
            Weekly Transactions
          </h2>
          <p className="mt-0.5 text-xs text-ink-400">
            Successful test purchases this week.
          </p>
        </div>
        <span className="text-xs font-semibold text-ink-400">{formatNaira(max)} peak</span>
      </div>

      {loading ? (
        <LoadingSpinner size={32} label="Loading chart..." />
      ) : (
        <>
          <div className="mt-4" role="img" aria-label="Line chart of transactions across the week">
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
                <g key={p.day}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill="white"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    className="animate-pop"
                    style={{ animationDelay: `${0.5 + i * 0.08}s` }}
                  />
                </g>
              ))}
            </svg>
          </div>

          <div className="mt-2 grid" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
            {data.map((d) => (
              <div key={d.day} className="text-center">
                <p className="text-xs font-semibold text-ink-500">{d.day}</p>
                <p className="text-[10px] text-ink-400">{formatNaira(d.amount)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}