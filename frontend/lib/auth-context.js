"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  signup as apiSignup,
  login as apiLogin,
  logout as apiLogout,
  me as apiMe,
  updateProfile as apiUpdateProfile,
  changePassword as apiChangePassword,
  errorMessage,
} from "@/lib/api";
import { readCache, writeCache, clearUserCache } from "@/lib/cache";

const USER_KEY = "u:session";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Show the person who was signed in last time straight away (no waiting
    // on the network), then confirm the session with the server.
    const cached = readCache(USER_KEY, { persist: true });
    if (cached && cached.id) {
      setUser(cached);
      setLoading(false);
    }

    const loadSession = async () => {
      try {
        const { user: sessionUser } = await apiMe();
        if (active) setUser(sessionUser);
      } catch (error) {
        const status = error && error.response && error.response.status;
        // Signed out or session expired. A dropped connection keeps the
        // cached session; the next request will check again.
        if (active && (status === 401 || status === 403 || !cached)) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSession();

    return () => {
      active = false;
    };
  }, []);

  // Remember the signed-in person for an instant start next time; forget
  // them (and anything cached for them) when they sign out.
  useEffect(() => {
    if (loading) return;
    if (user) writeCache(USER_KEY, user, { persist: true });
    else clearUserCache();
  }, [user, loading]);

  const login = useCallback(async (email, password) => {
    try {
      const { user: signedInUser } = await apiLogin(email, password);
      setUser(signedInUser);
      return { user: signedInUser };
    } catch (error) {
      return { error: errorMessage(error, "Login failed. Please try again.") };
    }
  }, []);

  const register = useCallback(async (payload) => {
    try {
      const { user: newUser } = await apiSignup({
        name: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        password: payload.password,
        ...(payload.referralCode ? { referralCode: payload.referralCode } : {}),
      });
      setUser(newUser);
      return { user: newUser };
    } catch (error) {
      return { error: errorMessage(error, "Signup failed. Please try again.") };
    }
  }, []);

  // The session lives in an httpOnly cookie that only the server can clear,
  // so logout only "succeeds" when the server confirms it.
  // keepLocal: let the caller navigate away first, then call clearSession(),
  // so protected pages never flash a "signed out" state on the way out.
  const logout = useCallback(async ({ keepLocal = false } = {}) => {
    try {
      await apiLogout();
    } catch (error) {
      return {
        error: errorMessage(error, "We couldn't reach the server to log you out. Please try again."),
      };
    }
    if (!keepLocal) setUser(null);
    return {};
  }, []);

  const clearSession = useCallback(() => setUser(null), []);

  // Replace the cached user (e.g. after verifying the email).
  const updateUser = useCallback((next) => setUser(next), []);

  const saveProfile = useCallback(async (patch) => {
    try {
      const { user: updated } = await apiUpdateProfile(patch);
      setUser(updated);
      return updated;
    } catch (error) {
      return { error: errorMessage(error, "Failed to update profile.") };
    }
  }, []);

  const savePassword = useCallback(async (current, next) => {
    try {
      await apiChangePassword(current, next);
      return {};
    } catch (error) {
      return { error: errorMessage(error, "Failed to change password.") };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, clearSession, saveProfile, savePassword, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};