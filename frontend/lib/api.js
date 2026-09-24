import axios from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

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

// Transactions
export const getTransactions = async () => {
  const { data } = await api.get("/api/transactions");
  return data;
};

export const getTransaction = async (id) => {
  const { data } = await api.get(`/api/transactions/${id}`);
  return data;
};

// Test purchase flow (TEST MODE).
// Sends only the planId + phone; the backend reads price/plan/network
// from MongoDB, so frontend values can never override the real amount.
export const createTestTransaction = async ({ planId, phone, clientReference }) => {
  const { data } = await api.post("/api/transactions/test", {
    planId,
    phone,
    clientReference,
  });
  return data;
};

// Test airtime purchase (TEST MODE). Sends network + amount + phone; the
// backend re-validates the network and amount range server-side.
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