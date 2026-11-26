"use client";

import { Bell, Monitor, Moon, Palette, Sun, User, Check } from "lucide-react";
import Link from "next/link";
import { useTheme, THEME_OPTIONS } from "@/components/ThemeProvider";
import { useAuth } from "@/lib/auth-context";
import { usePushAlerts } from "@/lib/push";

// On/off switch for phone notifications (gift box, cashback, referrals).
function PushToggle() {
  const { state, enable, disable } = usePushAlerts();
  const on = state === "on";
  const note =
    state === "install-first"
      ? "On iPhone, add EscriptPay to your Home Screen first."
      : state === "blocked"
        ? "Blocked in your browser settings. Allow notifications for escriptpay.com there."
        : state === "unavailable"
          ? "This browser doesn't support notifications."
          : "Daily gift reminders, cashback and referral rewards.";
  const usable = state === "on" || state === "off";
  return (
    <li className="flex items-start justify-between gap-4">
      <div>
        <p className="font-semibold text-ink-800">Phone notifications</p>
        <p className="mt-0.5 text-ink-500">{note}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Phone notifications"
        disabled={!usable}
        onClick={() => (on ? disable() : enable())}
        className={`focus-ring relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${on ? "bg-emerald-500" : "bg-slate-300"}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-[#ffffff] shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </li>
  );
}

const THEME_META = {
  light: { label: "Light", icon: Sun, hint: "Bright surfaces" },
  dark: { label: "Dark", icon: Moon, hint: "Easier at night" },
  system: { label: "System", icon: Monitor, hint: "Match your device" },
};

export default function SettingsPage() {
  const { preference, resolvedTheme, setPreference } = useTheme();
  const { user } = useAuth();

  // Radio-group keyboard support: arrows move the selection.
  const onThemeKeyDown = (e) => {
    const i = THEME_OPTIONS.indexOf(preference);
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = THEME_OPTIONS[(i + 1) % THEME_OPTIONS.length];
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = THEME_OPTIONS[(i - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length];
    if (next) {
      e.preventDefault();
      setPreference(next);
      document.getElementById(`theme-${next}`)?.focus();
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">Settings</h1>
        <p className="mt-1.5 text-sm text-ink-500 sm:text-base">Manage your preferences and account details.</p>
      </header>

      {/* Theme */}
      <section className="card p-5 sm:p-6" aria-labelledby="s-theme">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-lite-100 text-purple-lite-600">
            <Palette size={17} aria-hidden="true" />
          </span>
          <div>
            <h2 id="s-theme" className="font-display text-base font-bold text-ink-800">Appearance</h2>
            <p className="mt-0.5 text-sm text-ink-500">
              Currently showing the <span className="font-semibold text-ink-700">{resolvedTheme}</span> theme
              {preference === "system" ? " from your device setting." : "."} Saved on this browser.
            </p>
          </div>
        </div>

        <div role="radiogroup" aria-labelledby="s-theme" onKeyDown={onThemeKeyDown} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map((option) => {
            const meta = THEME_META[option];
            const selected = preference === option;
            return (
              <button
                key={option}
                id={`theme-${option}`}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setPreference(option)}
                className={`focus-ring press relative flex items-center gap-3 rounded-xl border p-4 text-left ${
                  selected
                    ? "border-cyan-400 bg-cyan-50 shadow-[0_0_0_1px_var(--color-cyan-400)]"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    selected ? "bg-cyan-500 brand-contrast" : "bg-slate-100 text-ink-500"
                  }`}
                >
                  <meta.icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-900">{meta.label}</span>
                  <span className="block text-xs text-ink-500">{meta.hint}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    selected ? "border-cyan-500 bg-cyan-500 brand-contrast" : "border-slate-300"
                  }`}
                >
                  {selected && <Check size={12} />}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Account */}
        <section className="card p-5 sm:p-6" aria-labelledby="s-account">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
              <User size={17} aria-hidden="true" />
            </span>
            <h2 id="s-account" className="font-display text-base font-bold text-ink-800">Account</h2>
          </div>
          <dl className="divide-y divide-slate-100 text-sm">
            {[
              ["Email", user?.email || "—"],
              ["Currency", "₦ Naira (NGN)"],
              ["Language", "English"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-3 first:pt-0">
                <dt className="text-ink-500">{label}</dt>
                <dd className="truncate font-semibold text-ink-800">{value}</dd>
              </div>
            ))}
          </dl>
          <Link href="/profile" className="focus-ring btn-secondary mt-4 w-full py-2.5 sm:w-auto">
            Edit profile &amp; password
          </Link>
        </section>

        {/* Notifications — describes what actually exists today. */}
        <section className="card p-5 sm:p-6" aria-labelledby="s-notifications">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
              <Bell size={17} aria-hidden="true" />
            </span>
            <h2 id="s-notifications" className="font-display text-base font-bold text-ink-800">Notifications</h2>
          </div>
          <ul className="space-y-3 text-sm">
            <PushToggle />
            <li className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-ink-800">In-app purchase updates</p>
                <p className="mt-0.5 text-ink-500">Shown in the bell at the top of your dashboard.</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">On</span>
            </li>
            <li className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-ink-800">Email and SMS alerts</p>
                <p className="mt-0.5 text-ink-500">Not available yet.</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-ink-500">Unavailable</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
