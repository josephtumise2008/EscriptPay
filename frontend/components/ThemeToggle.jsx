"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

// Icons are switched purely with CSS (`dark:` variants) so the server-rendered
// markup and the first client render are identical — no hydration mismatch.
export default function ThemeToggle({ className = "" }) {
  const { toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle colour theme"
      title="Toggle light / dark theme"
      className={`focus-ring icon-btn ${className}`}
    >
      <span className="relative block h-5 w-5" aria-hidden="true">
        <Sun
          size={20}
          className="absolute inset-0 -rotate-90 scale-50 opacity-0 transition-[transform,opacity] duration-300 dark:rotate-0 dark:scale-100 dark:opacity-100"
        />
        <Moon
          size={20}
          className="absolute inset-0 rotate-0 scale-100 opacity-100 transition-[transform,opacity] duration-300 dark:rotate-90 dark:scale-50 dark:opacity-0"
        />
      </span>
    </button>
  );
}
