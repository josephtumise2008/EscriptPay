// In-app navigation trail for the dashboard "Back" button.
//
// Records each dashboard page the user visits (path + query) in
// sessionStorage, so "Back" can return to the exact page they came from —
// Buy Data, Buy Airtime, a receipt, the order status page with its ?ref… —
// and name it ("Back to Buy Airtime"). Browser Back/Forward are detected
// (the new page equals the previous entry) and pop the trail instead of
// growing it.

const KEY = "escriptpay:nav-trail";
const LIMIT = 30;

const read = () => {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const write = (trail) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-LIMIT)));
  } catch {
    // Storage unavailable: Back falls back to each page's parent.
  }
};

// Call after every route change. Returns the entry before the current one.
export const recordVisit = (url) => {
  const trail = read();
  const last = trail[trail.length - 1];
  const previous = trail[trail.length - 2];
  if (url === last) {
    // Same page re-rendered or refreshed — nothing to record.
  } else if (url === previous) {
    trail.pop(); // the user went back
  } else {
    trail.push(url);
  }
  write(trail);
  return trail.length > 1 ? trail[trail.length - 2] : null;
};

const LABELS = [
  [/^\/dashboard$/, "Dashboard"],
  [/^\/buy-data$/, "Buy Data"],
  [/^\/buy-airtime$/, "Buy Airtime"],
  [/^\/history$/, "Transactions"],
  [/^\/history\/.+/, "Receipt"],
  [/^\/success$/, "Order status"],
  [/^\/profile$/, "Profile"],
  [/^\/settings$/, "Settings"],
  [/^\/wallet$/, "Wallet"],
  [/^\/admin$/, "Business"],
];

export const labelFor = (url) => {
  const path = (url || "").split("?")[0];
  const hit = LABELS.find(([re]) => re.test(path));
  return hit ? hit[1] : "previous page";
};

// Start a fresh trail when the dashboard is entered (from the website, a
// login, a refresh or a new tab), so Back never points at a stale page.
export const resetTrail = () => write([]);
