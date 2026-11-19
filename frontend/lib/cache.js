// Tiny "show the last answer instantly, then refresh" cache.
//
// Every request from Nigeria to the servers takes half a second or more, so
// pages show what they loaded last time straight away and quietly update when
// the fresh answer arrives. Values live in memory (instant between pages) and,
// when `persist` is set, in localStorage (instant when the app is reopened).
// Only for data the signed-in person already sees; cleared on logout.

const PREFIX = "escriptpay.cache.";
const mem = new Map();

export function readCache(key, { persist = false, maxAgeMs = Infinity } = {}) {
  const now = Date.now();
  let hit = mem.get(key);
  if (!hit && persist) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw) {
        hit = JSON.parse(raw);
        mem.set(key, hit);
      }
    } catch {
      hit = null;
    }
  }
  if (!hit || now - hit.t > maxAgeMs) return undefined;
  return hit.v;
}

export function writeCache(key, value, { persist = false } = {}) {
  const entry = { v: value, t: Date.now() };
  mem.set(key, entry);
  if (persist) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {
      // storage full or blocked: memory still works
    }
  }
}

// Removes everything tied to a signed-in person (keys starting with "u:").
export function clearUserCache() {
  for (const key of [...mem.keys()]) if (key.startsWith("u:")) mem.delete(key);
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${PREFIX}u:`)) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}
