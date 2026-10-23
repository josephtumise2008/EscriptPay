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

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const { user: sessionUser } = await apiMe();
        if (active) setUser(sessionUser);
      } catch {
        // Not authenticated or session expired — that's fine.
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSession();

    return () => {
      active = false;
    };
  }, []);

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
      value={{ user, loading, login, register, logout, clearSession, saveProfile, savePassword }}
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