export const formatNaira = (amount) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateString) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

export const formatDateTime = (dateString) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export const maskPhone = (phone = "") => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 11) return phone;
  return `${digits.slice(0, 4)}••••${digits.slice(-3)}`;
};

export const extractSummary = (plan = {}) => {
  const name = plan.name || "";
  return {
    network: plan.network || "",
    name,
    price: plan.price ?? 0,
    validity: plan.validity || "",
    share: /share/i.test(name),
    upper: name.toUpperCase(),
  };
};