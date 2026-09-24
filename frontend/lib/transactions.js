// Shared utilities for interpreting backend Transaction documents.

export const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const isSuccessful = (t) => t.status === "successful";

export const computeStats = (transactions = []) => {
  const successful = transactions.filter(isSuccessful);
  const dataSuccessful = successful.filter((t) => t.type === "data");
  const thisWeek = successful.filter((t) => {
    const date = new Date(t.createdAt);
    const now = new Date();
    return now - date < 7 * 86400000;
  });

  return {
    total: transactions.length,
    successful: successful.length,
    dataPurchased: dataSuccessful.length,
    airtimePurchased: successful.filter((t) => t.type === "airtime").length,
    weekly: thisWeek.length,
    weeklyAmount: thisWeek.reduce((sum, t) => sum + (t.amount || 0), 0),
  };
};

// Per-day sums of successful transaction amounts for the current Mon-Sun week.
export const buildWeeklySeries = (transactions = []) => {
  const byDay = new Map(DAY_KEYS.map((d) => [d, 0]));

  const now = new Date();
  const startOfWeek = new Date(now);
  const dayIndex = (now.getDay() + 6) % 7; // Monday = 0
  startOfWeek.setDate(now.getDate() - dayIndex);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  transactions
    .filter(isSuccessful)
    .forEach((t) => {
      const date = new Date(t.createdAt);
      if (date < startOfWeek || date >= endOfWeek) return;
      const key = DAY_KEYS[(date.getDay() + 6) % 7];
      byDay.set(key, byDay.get(key) + (t.amount || 0));
    });

  return DAY_KEYS.map((day) => ({ day, amount: byDay.get(day) }));
};

export const statusLabel = (status = "") => {
  const map = { successful: "Successful", pending: "Pending", failed: "Failed" };
  return map[status] || status || "Pending";
};

export const statusBadge = (status = "") => {
  const map = {
    successful: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    pending: "bg-amber-50 text-amber-600 ring-amber-100",
    failed: "bg-red-50 text-red-500 ring-red-100",
  };
  return map[status] || map.pending;
};