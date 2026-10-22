// Lightweight password-strength scoring for the auth/profile forms.
// Returns an object with a 0-4 score and a human label + color class.

export const passwordStrength = (password = "") => {
  let score = 0;

  if (!password) return { score: 0, label: "", color: "", hint: "" };

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  // Warning: over-special-casing. Symmetry with 8-char minimum.
  const map = {
    0: { label: "Very weak", color: "bg-red-500", text: "text-red-500" },
    1: { label: "Weak", color: "bg-orange-400", text: "text-orange-500" },
    2: { label: "Fair", color: "bg-amber-400", text: "text-amber-600" },
    3: { label: "Good", color: "bg-lime-400", text: "text-lime-600" },
    4: { label: "Strong", color: "bg-emerald-500", text: "text-emerald-600" },
    5: { label: "Strong", color: "bg-emerald-500", text: "text-emerald-600" },
  };

  const entry = map[Math.min(score, 5)];
  return {
    score,
    label: entry.label,
    color: entry.color,
    text: entry.text,
    hint:
      score < 3
        ? "Use 8+ characters with upper & lower case, a number and a symbol."
        : "Looks good — don't reuse this password anywhere else.",
  };
};

export const meetMinimum = (password = "") => password.length >= 8;