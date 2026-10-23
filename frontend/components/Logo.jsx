"use client";

import { useId } from "react";

export default function Logo({ size = 36, withWordmark = true, inverted = false }) {
  // Each logo needs its own gradient id: when ids are shared and the first
  // copy is hidden (e.g. the desktop sidebar on a phone), browsers can't
  // paint the gradient and only the white clip shows.
  const gradientId = `logo-grad-${useId().replace(/:/g, "")}`;
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7c3aed" />
            <stop offset="0.55" stopColor="#6366f1" />
            <stop offset="1" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${gradientId})`} />
        <path
          d="M16 30c2.5 4 7 6.5 12 6.5"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M16 34c2.5 4 7 6.5 12 6.5"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.3"
        />
        <path
          d="M32 14l-13.4 13.4a3.4 3.4 0 004.8 4.8L36.8 18.8a6.6 6.6 0 00-9.3-9.3L13.6 24a9.6 9.6 0 0013.6 13.6"
          stroke="white"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && (
        <span
          className={`font-display text-[1.15rem] font-extrabold tracking-tight ${
            inverted ? "brand-contrast" : "text-ink-900"
          }`}
        >
          Escript<span className="gradient-text">Pay</span>
        </span>
      )}
    </span>
  );
}