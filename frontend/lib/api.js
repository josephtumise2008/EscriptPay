import axios from "axios";

// Resolves the API base for the current environment.
//
// - Local development:  http://localhost:5001 (the Express dev server)
// - Production:         "" — same origin. The frontend and the backend share
//   one Vercel domain, so the browser calls `/api/...` on that domain and the
//   Vercel rewrite forwards it to the Express service.
//
// Endpoints below already include the `/api` prefix (e.g. `/api/plans`), so a
// base of `/api` would produce `/api/api/plans`. NEXT_PUBLIC_API_URL=/api is
// therefore normalized to a same-origin relative base.
const resolveApiBase = () => {
  const configured = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (configured) {
    const trimmed = configured.replace(/\/+$/, "");
    return trimmed === "/api" ? "" : trimmed;
  }
  if (process.env.NODE_ENV === "production") return "";
  return "http://localhost:5001";
};

const resolvedBase = resolveApiBase();

// Relative bases only work in the browser. If this module ever executes while
// server-side rendering, resolve the base against the deployment origin.
export const API_BASE_URL =
  !resolvedBase && typeof window === "undefined" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : resolvedBase;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Normalizes any axios/network error into a safe, user-visible message.
export const errorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  return error?.response?.data?.message || error?.message || fallback;
};

// Plans & networks (read-only catalog from MongoDB)
export const getPlans = async () => {
  const { data } = await api.get("/api/plans");
  return data.plans;
};

export const getPlanById = async (id) => {
  const { data } = await api.get(`/api/plans/${id}`);
  return data.plan;
};

export const getNetworks = async () => {
  const { data } = await api.get("/api/networks");
  return data.networks;
};

// Auth (httpOnly cookie session)
export const signup = async (payload) => {
  const { data } = await api.post("/api/auth/signup", payload);
  return data;
};

export const login = async (email, password) => {
  const { data } = await api.post("/api/auth/login", { email, password });
  return data;
};

export const logout = async () => {
  const { data } = await api.post("/api/auth/logout");
  return data;
};

export const me = async () => {
  const { data } = await api.get("/api/auth/me");
  return data;
};

export const updateProfile = async (patch) => {
  const { data } = await api.put("/api/auth/me", patch);
  return data;
};

export const changePassword = async (currentPassword, newPassword) => {
  const { data } = await api.post("/api/auth/change-password", {
    currentPassword,
    newPassword,
  });
  return data;
};

// Password reset. forgotPassword always resolves with the same generic
// message whether or not the account exists (no enumeration).
export const forgotPassword = async (email) => {
  const { data } = await api.post("/api/auth/forgot-password", { email });
  return data;
};

export const resetPassword = async (token, password) => {
  const { data } = await api.post("/api/auth/reset-password", { token, password });
  return data;
};

// Transactions
// Optional query params (all server-side): status, type, network, q,
// from, to, page, limit.
export const getTransactions = async (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== "" && v !== undefined && v !== null)
  );
  const { data } = await api.get("/api/transactions", { params: clean });
  return data;
};

export const getTransaction = async (id) => {
  const { data } = await api.get(`/api/transactions/${id}`);
  return data;
};

// Data purchase. Sends only the planId + phone; the backend reads
// price/plan/network from MongoDB, so frontend values can never override the
// real amount. Resolves to { transaction, checkoutUrl? } — when checkoutUrl is
// present the customer must pay on Paystack before anything is delivered.
export const createDataTransaction = async ({ planId, phone, clientReference }) => {
  const { data } = await api.post("/api/transactions/data", {
    planId,
    phone,
    clientReference,
  });
  return data;
};

// Original name, kept for existing callers.
export const createTestTransaction = createDataTransaction;

// Asks the backend to verify a payment with Paystack after the checkout
// redirect. The redirect itself is never treated as proof of payment.
export const verifyPayment = async (reference) => {
  const { data } = await api.post("/api/transactions/verify", { reference });
  return data;
};

// Public, non-secret runtime mode (test/live) from the backend.
export const getAppConfig = async () => {
  const { data } = await api.get("/api/config");
  return data.config;
};

// Airtime purchase. Sends network + amount + phone; the backend re-validates
// the network and amount range server-side. Same response shape as data.
export const createAirtimeTransaction = async ({ network, amount, phone, clientReference }) => {
  const { data } = await api.post("/api/transactions/airtime", {
    network,
    amount,
    phone,
    clientReference,
  });
  return data;
};

export default api;