"use client";

import { useState } from "react";
import { Camera, Mail, Phone, ShieldCheck, Save, Eye, EyeOff, MapPin } from "lucide-react";
import { PrimaryButton } from "@/components/ui/Buttons";
import { useAuth } from "@/lib/auth-context";
import { initials, formatDate } from "@/lib/format";
import Select from "@/components/ui/Select";
import { NIGERIAN_STATES } from "@/lib/states";
import { passwordStrength } from "@/lib/password";

export default function ProfilePage() {
  const { user, saveProfile, savePassword } = useAuth();
  const [profile, setProfile] = useState({
    fullName: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    state: user?.state || "",
  });
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false });
  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });
  const [pwdMsg, setPwdMsg] = useState({ type: "", text: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  // DashboardShell redirects signed-out visitors; never navigate during render.
  if (!user) return null;

  const updateProfileField = (key) => (e) => {
    setProfile((p) => ({ ...p, [key]: e.target.value }));
    setProfileMsg({ type: "", text: "" });
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    const result = await saveProfile({
      name: profile.fullName,
      phone: profile.phone,
      state: profile.state,
    });
    setSavingProfile(false);
    if (result?.error) {
      setProfileMsg({ type: "error", text: result.error });
      setTimeout(() => setProfileMsg({ type: "", text: "" }), 4000);
      return;
    }
    setProfileMsg({ type: "success", text: "Profile saved." });
    setTimeout(() => setProfileMsg({ type: "", text: "" }), 3000);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdMsg({ type: "", text: "" });

    if (pwd.next.length < 8) {
      setPwdMsg({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    if (pwd.next !== pwd.confirm) {
      setPwdMsg({ type: "error", text: "New passwords do not match." });
      return;
    }

    setSavingPwd(true);
    const { error } = await savePassword(pwd.current, pwd.next);
    setSavingPwd(false);

    if (error) {
      setPwdMsg({ type: "error", text: error });
      return;
    }
    setPwdMsg({ type: "success", text: "Password updated successfully." });
    setPwd({ current: "", next: "", confirm: "" });
    setTimeout(() => setPwdMsg({ type: "", text: "" }), 3000);
  };

  const toggle = (key) => () => setVisible((v) => ({ ...v, [key]: !v[key] }));

  const nextStrength = passwordStrength(pwd.next);

  const pwdField = (id, label, key) => (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible[key] ? "text" : "password"}
          value={pwd[key]}
          onChange={(e) => setPwd((p) => ({ ...p, [key]: e.target.value }))}
          className="input-base pr-11"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={toggle(key)}
          className="focus-ring absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:text-ink-600"
          aria-label={visible[key] ? `Hide ${label}` : `Show ${label}`}
        >
          {visible[key] ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {key === "next" && pwd.next.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-300 ${nextStrength.color}`}
                style={{ width: `${(nextStrength.score / 5) * 100}%` }}
              />
            </div>
            <span className={`w-14 shrink-0 text-right text-xs font-semibold ${nextStrength.text}`}>
              {nextStrength.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-400">{nextStrength.hint}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          Profile
        </h1>
        <p className="mt-1.5 text-sm text-ink-500 sm:text-base">
          Manage your personal information and account security.
        </p>
      </header>

      {/* Identity card */}
      <section className="card card-hover flex flex-col items-center gap-4 p-6 sm:flex-row sm:gap-6 sm:p-7">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-purple-lite-500 font-display text-2xl font-extrabold brand-contrast shadow-[0_10px_25px_-10px_rgb(124_58_237/0.5)]">
            {initials(user.name)}
          </div>
          <button
            type="button"
            className="focus-ring absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-full border border-white bg-white text-cyan-600 shadow-md transition-transform hover:scale-105"
            aria-label="Upload profile picture"
          >
            <Camera size={15} />
          </button>
        </div>
        <div className="text-center sm:text-left">
          <h2 className="font-display text-xl font-bold text-ink-900">{user.name}</h2>
          <p className="mt-0.5 flex items-center justify-center gap-1.5 text-sm text-ink-500 sm:justify-start">
            <Mail size={14} className="text-cyan-500" /> {user.email}
          </p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-ink-500 sm:justify-start">
            <Phone size={14} className="text-purple-lite-500" /> {user.phone || "—"}
          </p>
          {user.state && (
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-ink-500 sm:justify-start">
              <MapPin size={14} className="text-cyan-500" /> {user.state}
            </p>
          )}
          {user.createdAt && (
            <p className="mt-2 text-xs text-ink-400">
              Member since {formatDate(user.createdAt)}
            </p>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Personal information */}
        <section className="card card-hover p-6" aria-labelledby="personal-heading">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-100 to-sky-100 text-cyan-600">
              <Camera size={17} aria-hidden="true" />
            </span>
            <h2 id="personal-heading" className="font-display text-base font-bold text-ink-800">
              Personal Information
            </h2>
          </div>

          <form onSubmit={handleProfileSave} className="space-y-4">
            <div>
              <label htmlFor="pf-name" className="mb-1.5 block text-sm font-semibold text-ink-700">
                Full Name
              </label>
              <input
                id="pf-name"
                type="text"
                value={profile.fullName}
                onChange={updateProfileField("fullName")}
                className="input-base"
              />
            </div>
            <div>
              <label htmlFor="pf-email" className="mb-1.5 block text-sm font-semibold text-ink-700">
                Email
              </label>
              <input
                id="pf-email"
                type="email"
                value={profile.email}
                disabled
                className="input-base cursor-not-allowed bg-slate-50 text-ink-500"
              />
              <p className="mt-1.5 text-xs text-ink-400">Email address cannot be changed.</p>
            </div>
            <div>
              <label htmlFor="pf-phone" className="mb-1.5 block text-sm font-semibold text-ink-700">
                Phone Number
              </label>
              <input
                id="pf-phone"
                type="tel"
                value={profile.phone}
                onChange={updateProfileField("phone")}
                className="input-base"
              />
            </div>
            <div>
              <Select
                id="pf-state"
                label="State of Residence"
                hideLabel={false}
                value={profile.state}
                onChange={(v) => updateProfileField("state")({ target: { value: v } })}
                placeholder="Select your state"
                options={NIGERIAN_STATES.map((st) => ({ value: st, label: st }))}
              />
              <p className="mt-1.5 text-xs text-ink-400">
                Used to show the local time greeting on your dashboard.
              </p>
            </div>

            <PrimaryButton type="submit" loading={savingProfile}>
              <Save size={16} />
              {savingProfile ? "Saving..." : "Save Changes"}
            </PrimaryButton>
            {profileMsg.text && (
              <p
                role={profileMsg.type === "error" ? "alert" : "status"}
                className={`text-sm font-medium ${
                  profileMsg.type === "error" ? "text-red-500" : "text-emerald-600"
                }`}
              >
                {profileMsg.text}
              </p>
            )}
            <p className="text-xs text-ink-400">
              Saved to your account via the API.
            </p>
          </form>
        </section>

        {/* Security */}
        <section className="card card-hover p-6" aria-labelledby="security-heading">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-lite-100 to-indigo-100 text-purple-lite-600">
              <ShieldCheck size={17} aria-hidden="true" />
            </span>
            <h2 id="security-heading" className="font-display text-base font-bold text-ink-800">
              Security
            </h2>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            {pwdField("pwd-current", "Current Password", "current")}
            {pwdField("pwd-next", "New Password", "next")}
            {pwdField("pwd-confirm", "Confirm New Password", "confirm")}

            <PrimaryButton type="submit" loading={savingPwd}>
              {savingPwd ? "Updating..." : "Change Password"}
            </PrimaryButton>

            {pwdMsg.text && (
              <p
                role={pwdMsg.type === "error" ? "alert" : "status"}
                className={`text-sm font-medium ${
                  pwdMsg.type === "error" ? "text-red-500" : "text-emerald-600"
                }`}
              >
                {pwdMsg.text}
              </p>
            )}
            <p className="text-xs text-ink-400">
              Change password securely via the API.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}