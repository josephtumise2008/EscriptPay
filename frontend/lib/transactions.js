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

  return DAY_KEYS.map((day) => ({ label: day, amount: byDay.get(day) }));
};

const pad2 = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const monthKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

// Scalable chart series: "7d" (last 7 days), "30d" (last 30 days), "all"
// (grouped by month across the whole history). Returns { label, amount }[].
export const buildRangeSeries = (transactions = [], range = "7d") => {
  const successful = transactions.filter(isSuccessful);
  const now = new Date();
  const oldest = successful.length
    ? new Date(Math.min(...successful.map((t) => new Date(t.createdAt).getTime())))
    : new Date();

  const dateLabel = (d) =>
    new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" }).format(d);

  if (range === "30d") {
    const byDay = new Map();
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push(d);
      byDay.set(dayKey(d), 0);
    }
    successful.forEach((t) => {
      const d = new Date(t.createdAt);
      const key = dayKey(d);
      if (byDay.has(key)) byDay.set(key, byDay.get(key) + (t.amount || 0));
    });
    return days.map((d) => ({ label: dateLabel(d), amount: byDay.get(dayKey(d)) }));
  }

  if (range === "all") {
    const byMonth = new Map();
    const months = [];
    let cursor = new Date((oldest && oldest.getTime() < now.getTime() ? oldest : now).getTime());
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    // Cap at 24 months to keep the chart readable on very old accounts.
    const current = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cursor <= current && months.length < 24) {
      months.push(cursor);
      byMonth.set(monthKey(cursor), 0);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    const sameYear = (m) => m.getFullYear() === now.getFullYear();
    successful.forEach((t) => {
      const d = new Date(t.createdAt);
      const key = monthKey(d);
      if (byMonth.has(key)) byMonth.set(key, byMonth.get(key) + (t.amount || 0));
    });
    return months.map((m) => ({
      label: m.toLocaleString("en-NG", { month: "short", year: sameYear(m) ? undefined : "2-digit" }),
      amount: byMonth.get(monthKey(m)),
    }));
  }

  // Default: last 7 days (calendar days, not Mon-Sun week).
  const byDay = new Map();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d);
    byDay.set(dayKey(d), 0);
  }
  successful.forEach((t) => {
    const d = new Date(t.createdAt);
    const key = dayKey(d);
    if (byDay.has(key)) byDay.set(key, byDay.get(key) + (t.amount || 0));
  });
  return days.map((d) => ({
    label: d.toLocaleString("en-NG", { weekday: "short" }),
    amount: byDay.get(dayKey(d)),
  }));
};

// Customer-facing explanation of where an order is. Payment and delivery are
// separate steps, so "pending" can mean either; this keeps them distinct.
export const describeTransaction = (tx = {}) => {
  const what = tx.type === "airtime" ? "airtime" : "data";

  if (tx.status === "successful") {
    return { tone: "success", title: "Purchase Successful!", message: null };
  }
  if (tx.paymentStatus === "pending") {
    return {
      tone: "pending",
      title: "Awaiting payment",
      message:
        "We have not received confirmation of your payment yet. If you have paid, this page updates automatically.",
    };
  }
  if (tx.paymentStatus === "expired") {
    return {
      tone: "failed",
      title: "Payment not completed",
      message: "This checkout expired before payment was confirmed. You have not been charged for this order.",
    };
  }
  if (tx.paymentStatus === "failed") {
    if (tx.failureReason && tx.failureReason.includes("foreign_card")) {
      return {
        tone: "failed",
        title: "Card not accepted",
        message:
          "EscriptPay only accepts cards issued in Nigeria, so nothing was delivered. The payment is being refunded to your card; it can take a few working days to show. Please pay with a Nigerian card, bank transfer or your wallet.",
      };
    }
    if (tx.needsReview) {
      return {
        tone: "failed",
        title: "Payment under review",
        message:
          "Your payment could not be matched to this order, so nothing was delivered. We will review it — if you were debited, it will be refunded.",
      };
    }
    if (tx.failureReason === "payment_init_failed") {
      return {
        tone: "failed",
        title: "Payment not started",
        message: "We could not start the payment. You have not been charged.",
      };
    }
    return {
      tone: "failed",
      title: "Payment failed",
      message: "Your payment was not successful, so nothing was delivered.",
    };
  }

  // Payment is confirmed (or not required in test mode) from here on.
  if (tx.providerStatus === "failed" && tx.paymentProvider === "wallet" && tx.paymentStatus === "successful") {
    return {
      tone: "failed",
      title: "Didn't go through",
      message: `The network connection was poor, so this ${what} wasn't delivered. You weren't charged: the money is back in your EscriptPay wallet. Please try again.`,
    };
  }
  if (tx.providerStatus === "failed") {
    return {
      tone: "failed",
      title: "Delivery failed",
      message:
        tx.paymentStatus !== "successful"
          ? `The ${what} could not be delivered.`
          : tx.paymentProvider === "wallet"
            ? `The network couldn't deliver this ${what}, so the full amount has been returned to your EscriptPay wallet. You can buy again now.`
            : `We received your payment but the ${what} could not be delivered. We'll refund you, and you'll get an email when it's done.`,
    };
  }
  if (tx.providerStatus === "unknown") {
    return {
      tone: "pending",
      title: "Confirming delivery",
      message: `Your payment was received. We are confirming the ${what} delivery with our supplier — please don't buy again for this number until it is resolved.`,
    };
  }
  return {
    tone: "pending",
    title: `Sending your ${what}…`,
    message:
      tx.paymentStatus === "successful"
        ? `Payment received. Your ${what} is on its way.`
        : `Your ${what} is being processed.`,
  };
};

// True while the order may still change on its own (webhook, supplier).
export const isAwaitingUpdate = (tx) =>
  Boolean(
    tx &&
      tx.status === "pending" &&
      (tx.paymentStatus === "pending" || ["pending", "processing"].includes(tx.providerStatus))
  );

export const statusLabel = (status = "") => {
  const map = { successful: "Successful", pending: "Processing", failed: "Failed" };
  return map[status] || status || "Processing";
};

export const statusBadge = (status = "") => {
  const map = {
    successful: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    pending: "bg-amber-50 text-amber-600 ring-amber-100",
    failed: "bg-red-50 text-red-500 ring-red-100",
  };
  return map[status] || map.pending;
};