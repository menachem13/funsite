import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(() => (getToken() ? loadStoredUser() : null));
  // Guards against handling the same session expiry twice — e.g. a page
  // that fires two protected requests in parallel with the same stale
  // token gets two 401s, and without this both would independently log out
  // and navigate. Reset on a fresh login so a later, genuine expiry is
  // still handled.
  const expiredHandledRef = useRef(false);

  const login = useCallback((nextUser, token) => {
    persistToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    expiredHandledRef.current = false;
  }, []);

  const logout = useCallback(() => {
    persistToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  // api/client.js dispatches this when a request that carried a token comes
  // back 401 — the token is stale (expired, or the account changed), not a
  // per-page error. Log out and send them back to login with a clear reason,
  // instead of leaving a dead session sitting in localStorage that keeps
  // failing the same way on every subsequent page.
  useEffect(() => {
    function handleExpired() {
      if (expiredHandledRef.current) return;
      expiredHandledRef.current = true;
      logout();
      navigate("/login", { replace: true, state: { from: location } });
    }
    window.addEventListener("funsite:session-expired", handleExpired);
    return () => window.removeEventListener("funsite:session-expired", handleExpired);
  }, [logout, navigate, location]);

  const value = useMemo(() => ({ user, login, logout, isAuthenticated: !!user }), [user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
