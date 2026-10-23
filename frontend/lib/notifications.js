// Local-first notification feed for the dashboard bell.
//
// Design note (backend-ready): the UI only talks to this module. Today the
// feed is derived client-side from the transactions API and read-state lives
// in localStorage, but a future backend notifications API can swap the
// internals without touching the UI:
//   - list(userId)  -> GET /api/notifications
//   - markRead...   -> PATCH /api/notifications/:id/read
//   - storage       -> per-user document/collection (with an admin push API)

const STORAGE_PREFIX = "escriptpay:notifications";

const storageKey = (userId) => `${STORAGE_PREFIX}:${userId}:read`;

const KINDS = {
  successful: { title: "Purchase successful" },
  pending: { title: "Purchase in progress" },
  failed: { title: "Purchase failed" },
};

// Wording follows the real order state: only successful orders say "sent".
const describe = (t) => {
  const what = t.type === "airtime" ? `${t.network} airtime of ₦${t.amount}` : `${t.network} ${t.plan}`;
  if (t.status === "successful") return `${what} sent to ${t.phone}`;
  if (t.status === "failed") return `${what} for ${t.phone} was not completed`;
  return `${what} for ${t.phone} is being processed`;
};

// Builds bell items from the transactions feed (newest first).
export const listFromTransactions = (transactions = []) =>
  [...transactions]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20)
    .map((t) => {
      const kind = KINDS[t.status] ? t.status : "pending";
      return {
        id: t._id,
        transactionId: t.transactionId,
        kind,
        title: KINDS[kind].title,
        message: describe(t),
        time: t.updatedAt || t.createdAt,
      };
    });

// ---- read-state persistence (localStorage until a backend API exists) ----

export const getReadIds = (userId) => {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || "[]");
  } catch {
    return [];
  }
};

export const markRead = (userId, id) => {
  if (typeof localStorage === "undefined") return;
  const ids = new Set(getReadIds(userId));
  ids.add(id);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...ids]));
  } catch {}
};

export const markAllRead = (userId, ids) => {
  if (typeof localStorage === "undefined") return;
  const list = [...new Set(ids)];
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list));
  } catch {}
};

export const unreadCount = (userId, items) => {
  const read = new Set(getReadIds(userId));
  return items.filter((i) => !read.has(i.id)).length;
};