"use client";

import { useState } from "react";
import { Bell, Palette, User } from "lucide-react";

const TOGGLES = [
  { id: "email-tx", label: "Transaction emails", description: "Receive an email every time you buy data or airtime." },
  { id: "sms-tx", label: "SMS confirmations", description: "Get SMS alerts when a purchase goes through." },
  { id: "promo", label: "Promotions & offers", description: "Be the first to know about data deals and bonuses." },
];

export default function SettingsPage() {
  const [toggles, setToggles] = useState(() =>
    Object.fromEntries(TOGGLES.map((t) => [t.id, true]))
  );

  const [theme, setTheme] = useState("light");
  const [themeNote, setThemeNote] = useState(false);

  const toggle = (id) => () => setToggles((t) => ({ ...t, [id]: !t[id] }));

  const handleTheme = (value) => {
    setTheme(value);
    if (value === "light") {
      setThemeNote(true);
      setTimeout(() => setThemeNote(false), 2500);
    }
  };

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1.5 text-sm text-ink-500 sm:text-base">
          Manage your account, notifications and preferences.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Account */}
        <section className="card card-hover animate-fade-up p-6" aria-labelledby="s-account">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-100 to-sky-100 text-cyan-600">
              <User size={17} aria-hidden="true" />
            </span>
            <h2 id="s-account" className="font-display text-base font-bold text-ink-800">
              Account Settings
            </h2>
          </div>
          <ul className="space-y-3 text-sm text-ink-600">
            <li className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
              <span className="font-medium text-ink-700">Currency</span>
              <span className="font-semibold text-ink-800">&#8358; Naira (NGN)</span>
            </li>
            <li className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
              <span className="font-medium text-ink-700">Language</span>
              <span className="font-semibold text-ink-800">English</span>
            </li>
            <li className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
              <span className="font-medium text-ink-700">Account status</span>
              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-100">
                Active
              </span>
            </li>
          </ul>
        </section>

        {/* Notifications */}
        <section className="card card-hover animate-fade-up p-6" aria-labelledby="s-notifications">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-100 to-indigo-100 text-sky-600">
              <Bell size={17} aria-hidden="true" />
            </span>
            <h2 id="s-notifications" className="font-display text-base font-bold text-ink-800">
              Notification Preferences
            </h2>
          </div>
          <ul className="space-y-2">
            {TOGGLES.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-ink-700">{t.label}</p>
                  <p className="mt-0.5 text-xs text-ink-400">{t.description}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={toggles[t.id]}
                    onChange={toggle(t.id)}
                    className="peer sr-only"
                    aria-label={`Toggle ${t.label}`}
                  />
                  <span className="h-6 w-11 rounded-full bg-slate-200 transition-colors duration-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-gradient-to-r peer-checked:from-cyan-500 peer-checked:to-purple-lite-500 peer-checked:after:translate-x-5" />
                </label>
              </li>
            ))}
          </ul>
        </section>

        {/* Theme */}
        <section className="card card-hover animate-fade-up p-6 lg:col-span-2" aria-labelledby="s-theme">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-lite-100 to-indigo-100 text-purple-lite-600">
              <Palette size={17} aria-hidden="true" />
            </span>
            <h2 id="s-theme" className="font-display text-base font-bold text-ink-800">
              Theme Preference
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {["light", "dark", "system"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTheme(t)}
                aria-pressed={theme === t}
                className={`focus-ring rounded-xl border px-5 py-2.5 text-sm font-semibold capitalize transition-all duration-200 ${
                  theme === t
                    ? "border-cyan-300 bg-gradient-to-r from-cyan-50 to-purple-lite-100 text-cyan-800 shadow-sm"
                    : "border-slate-200 bg-white text-ink-600 hover:border-cyan-300 hover:text-cyan-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {themeNote && (
            <p role="status" className="mt-3 text-sm font-medium text-cyan-700">
              Light theme is active for now — dark mode ships in a later update.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}