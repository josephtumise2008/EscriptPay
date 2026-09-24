"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`focus-ring inline-flex items-center justify-center rounded-lg p-2 text-ink-500 transition-colors hover:bg-slate-100 hover:text-cyan-600 ${className}`}
    >
      <span className="relative block h-[20px] w-[20px]" aria-hidden="true">
        <Sun
          size={20}
          className={`absolute inset-0 transition-all duration-500 ${
            dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
          }`}
        />
        <Moon
          size={20}
          className={`absolute inset-0 transition-all duration-500 ${
            dark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`}
        />
      </span>
    </button>
  );
}