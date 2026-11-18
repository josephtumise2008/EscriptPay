"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Star, X, UserRound, Clock, Pencil, Check } from "lucide-react";
import { getNumbers, saveNumber, removeNumber, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { validateNigerianPhone } from "@/lib/validators";
import { detectNetwork, prefixOf, toLocalNumber } from "@/lib/networks";

// Picks the network from the number's prefix as the customer types, unless
// they chose a network themselves for this number (ported lines).
export function useAutoNetwork(phone, applyNetwork) {
  const manual = useRef(false);
  const lastPrefix = useRef("");
  const apply = useRef(applyNetwork);
  useEffect(() => {
    apply.current = applyNetwork;
  });
  const detected = detectNetwork(phone);
  const prefix = prefixOf(phone);

  useEffect(() => {
    if (prefix !== lastPrefix.current) {
      lastPrefix.current = prefix;
      manual.current = false;
    }
    if (detected && !manual.current) apply.current(detected);
  }, [detected, prefix]);

  const chooseManually = useCallback((network) => {
    manual.current = true;
    apply.current(network);
  }, []);

  // A saved number keeps the network it was saved with (it may be ported).
  const pickNumber = useCallback((value, network) => {
    if (!network) return;
    lastPrefix.current = prefixOf(value);
    manual.current = true;
    apply.current(network);
  }, []);

  return { detected, chooseManually, pickNumber };
}

// One line under the phone box about the detected network.
export function NetworkHint({ detected, network, id }) {
  if (!detected) return null;
  if (detected === network) {
    return (
      <p id={id} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600">
        <Check size={13} aria-hidden="true" />
        {detected} number: network picked for you
      </p>
    );
  }
  return (
    <p id={id} className="mt-1.5 text-xs text-amber-700">
      This looks like a {detected} number, but you picked {network}. That&apos;s fine if the line was moved to {network}.
    </p>
  );
}

const chipBase =
  "focus-ring press inline-flex max-w-[11rem] shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors";

// Tap-to-fill numbers: your own, saved ones (with names) and recent ones.
export default function NumberPicker({ phone, network, onPick }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState([]);
  const [recent, setRecent] = useState([]);
  const [editing, setEditing] = useState(false);
  const [naming, setNaming] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    getNumbers()
      .then((r) => {
        if (!active) return;
        setSaved(r.saved);
        setRecent(r.recent);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const mine = user?.phone ? toLocalNumber(user.phone) : "";
  const current = toLocalNumber(phone);
  const valid = validateNigerianPhone(phone).valid;
  const isSaved = saved.some((n) => n.phone === current);
  const canSave = valid && !isSaved && current !== mine;

  const pick = (n) => {
    setMessage("");
    onPick(n.phone, n.network || detectNetwork(n.phone) || null);
  };

  const doSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const next = await saveNumber({ phone: current, label, network });
      setSaved(next);
      setRecent((r) => r.filter((n) => n.phone !== current));
      setNaming(false);
      setLabel("");
      setMessage("Saved.");
      setTimeout(() => setMessage(""), 2000);
    } catch (err) {
      setMessage(errorMessage(err, "Could not save that number."));
    } finally {
      setBusy(false);
    }
  };

  const doRemove = async (n) => {
    try {
      setSaved(await removeNumber(n.phone));
    } catch (err) {
      setMessage(errorMessage(err, "Could not remove that number."));
    }
  };

  const chips = [
    ...(mine ? [{ key: `me-${mine}`, kind: "me", n: { phone: mine, network: detectNetwork(mine) }, text: "My number" }] : []),
    ...saved.map((n) => ({ key: `s-${n.phone}`, kind: "saved", n, text: n.label || n.phone })),
    ...recent.filter((n) => n.phone !== mine).map((n) => ({ key: `r-${n.phone}`, kind: "recent", n, text: n.phone })),
  ];

  return (
    <div className="mt-3 space-y-2.5">
      {chips.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="list" aria-label="Quick numbers">
            {chips.map(({ key, kind, n, text }) => {
              const active = current === n.phone;
              const Icon = kind === "me" ? UserRound : kind === "saved" ? Star : Clock;
              return (
                <span key={key} role="listitem" className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => pick(n)}
                    title={kind === "saved" && n.label ? `${n.label} · ${n.phone}` : n.phone}
                    className={`${chipBase} ${
                      active
                        ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                        : "border-slate-200 bg-white text-ink-600 hover:border-slate-300"
                    } ${editing && kind === "saved" ? "pr-7" : ""}`}
                  >
                    <Icon size={13} aria-hidden="true" className={kind === "saved" ? "fill-amber-400 text-amber-400" : ""} />
                    <span className="truncate">{text}</span>
                  </button>
                  {editing && kind === "saved" && (
                    <button
                      type="button"
                      onClick={() => doRemove(n)}
                      aria-label={`Remove ${n.label || n.phone}`}
                      className="focus-ring absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-slate-200 text-ink-600 hover:bg-red-100 hover:text-red-600"
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
          {saved.length > 0 && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="focus-ring shrink-0 rounded-md p-1 text-xs font-semibold text-ink-500 hover:text-ink-700"
              aria-pressed={editing}
            >
              {editing ? "Done" : <Pencil size={14} aria-label="Edit saved numbers" />}
            </button>
          )}
        </div>
      )}

      {canSave && !naming && (
        <button
          type="button"
          onClick={() => setNaming(true)}
          className="focus-ring inline-flex items-center gap-1.5 rounded-md text-xs font-semibold text-cyan-600 hover:text-cyan-700"
        >
          <Star size={13} aria-hidden="true" />
          Save this number
        </button>
      )}

      {canSave && naming && (
        <form onSubmit={doSave} className="flex items-center gap-2">
          <label htmlFor="number-label" className="sr-only">
            Name for this number
          </label>
          <input
            id="number-label"
            value={label}
            onChange={(e) => setLabel(e.target.value.slice(0, 30))}
            placeholder="Name, e.g. Mum"
            autoFocus
            className="input-base h-9 min-w-0 flex-1 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="focus-ring press h-9 shrink-0 rounded-lg bg-cyan-600 px-3 text-xs font-bold text-white hover:bg-cyan-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setNaming(false)}
            className="focus-ring shrink-0 rounded-md p-1 text-ink-400 hover:text-ink-600"
            aria-label="Cancel"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </form>
      )}

      {message && <p className="text-xs font-medium text-ink-500" role="status">{message}</p>}
    </div>
  );
}
