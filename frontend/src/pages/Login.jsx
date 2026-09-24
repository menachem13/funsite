import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LogoMark from "../components/LogoMark";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import "./Auth.css";

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  // Set by api/client.js right before it redirects here on a stale token.
  // Lives in sessionStorage rather than a ?expired= URL param because
  // whichever of two competing redirects (this one, or ProtectedRoute's
  // own) lands last controls the URL — a query string can't be relied on
  // to survive that. The read here is a plain, side-effect-free state
  // initializer (safe under StrictMode's double-invoke-to-check-purity in
  // dev); clearing the flag is a separate effect below, so it shows
  // exactly once and never reappears on a later, unrelated visit.
  const [expired] = useState(() => {
    try {
      return sessionStorage.getItem("funsite_session_expired") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.removeItem("funsite_session_expired");
    } catch {
      // Private browsing / storage disabled — nothing to clear.
    }
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.post("/auth/login", { email, password });
      login(data.user, data.token);
      const redirectTo = location.state?.from?.pathname || (data.user.role === "owner" ? "/dashboard" : "/browse");
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <Link className="logo" to="/">
          <LogoMark />
          fun<span className="logo-accent">all</span>
        </Link>
        <h1>{t("auth.loginTitle")}</h1>
        <p className="auth-subtitle">{t("auth.loginSubtitle")}</p>

        {!error && expired && <div className="alert alert-info">{t("auth.sessionExpired")}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">{t("auth.email")}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <div className="field-label-row">
              <label htmlFor="password">{t("auth.password")}</label>
              <Link className="forgot-password-link" to="/forgot-password">
                {t("auth.forgotPassword")}
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : t("auth.logIn")}
          </button>
        </form>

        <p className="auth-footer-link">
          {t("auth.noAccount")} <Link to="/register">{t("auth.signUp")}</Link>
        </p>
        <p className="auth-footer-link">
          <Link to="/admin/login">{t("auth.adminLogin")}</Link>
        </p>
      </div>
    </div>
  );
}
