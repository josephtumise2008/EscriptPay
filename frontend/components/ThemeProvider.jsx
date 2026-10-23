"use client";

// Single source of truth for the colour theme.
//
//   preference:    what the user chose — "light" | "dark" | "system"
//   resolvedTheme: what is actually shown — "light" | "dark"
//
// The preference is stored in localStorage under THEME_KEY. The inline script
// in app/layout.js reads the same key before first paint (no flash of the
// wrong theme); this provider then keeps <html class="dark"> in sync, follows
// the OS while "system" is selected, and syncs across browser tabs.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const THEME_KEY = "escriptpay-theme";
export const THEME_OPTIONS = ["light", "dark", "system"];

const ThemeContext = createContext({
  preference: "system",
  resolvedTheme: "light",
  theme: "light",
  setPreference: () => {},
  toggleTheme: () => {},
});

const isPreference = (value) => THEME_OPTIONS.includes(value);

const systemTheme = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

const readPreference = () => {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return isPreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
};

const resolve = (preference) => (preference === "system" ? systemTheme() : preference);

const setDomTheme = (theme) => {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
};

// Switches the theme with one cheap crossfade (View Transitions API: the
// browser snapshots the page once and fades between two images) instead of
// animating colours on every element. Instant where unsupported or when the
// user prefers reduced motion.
const switchTheme = (theme) => {
  const root = document.documentElement;
  if (root.classList.contains("dark") === (theme === "dark")) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce && typeof document.startViewTransition === "function") {
    document.startViewTransition(() => setDomTheme(theme));
  } else {
    setDomTheme(theme);
  }
};

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readPreference);
  const [resolvedTheme, setResolvedTheme] = useState(() => resolve(readPreference()));

  // Safety net: keep the DOM in sync with state (no-op when already applied).
  useEffect(() => {
    setDomTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Follow the operating system while "system" is selected.
  useEffect(() => {
    if (preference !== "system") return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => {
      const next = e.matches ? "dark" : "light";
      switchTheme(next);
      setResolvedTheme(next);
    };
    setResolvedTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  // Another tab changed the preference.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== THEME_KEY) return;
      const next = isPreference(e.newValue) ? e.newValue : "system";
      switchTheme(resolve(next));
      setPreferenceState(next);
      setResolvedTheme(resolve(next));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPreference = useCallback((next) => {
    if (!isPreference(next)) return;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies now.
    }
    // Apply to the DOM immediately (same tick as the click), then let React
    // catch up — the switch never waits for a re-render.
    const resolved = resolve(next);
    switchTheme(resolved);
    setPreferenceState(next);
    setResolvedTheme(resolved);
  }, []);

  // Header toggle: switch to the opposite of what is currently shown.
  const toggleTheme = useCallback(() => {
    setPreference(resolve(readPreference()) === "dark" ? "light" : "dark");
  }, [setPreference]);

  const value = useMemo(
    () => ({ preference, resolvedTheme, theme: resolvedTheme, setPreference, toggleTheme }),
    [preference, resolvedTheme, setPreference, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
