import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { setToken as persistToken, getToken } from "../api/client";

const USER_KEY = "funsite_user";
const AuthContext = createContext(null);

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// There's no GET /auth/me on the backend yet, so the logged-in user object
// (returned by /login, /register, or /admin/verify-otp) is persisted
// alongside the JWT rather than re-fetched. Good enough since nothing here
// changes without a fresh login (email, role, name).
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (getToken() ? loadStoredUser() : null));

  const login = useCallback((nextUser, token) => {
    persistToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    persistToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout, isAuthenticated: !!user }), [user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
