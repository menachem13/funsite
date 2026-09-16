import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LogoMark from "../components/LogoMark";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import "./Auth.css";

export default function AdminLogin() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState("username");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequestOtp(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.post("/auth/admin/request-otp", { username });
      setMessage(data.message);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.post("/auth/admin/verify-otp", { username, code });
      login(data.user, data.token);
      navigate("/admin/coupons", { replace: true });
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
        <h1>{t("auth.adminLoginTitle")}</h1>
        <p className="auth-subtitle">
          {step === "username" ? t("auth.adminLoginSubtitleUsername") : t("auth.adminLoginSubtitleCode")}
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {message && step === "code" && <div className="alert alert-success">{message}</div>}

        {step === "username" ? (
          <form onSubmit={handleRequestOtp}>
            <div className="field">
              <label htmlFor="username">{t("auth.adminUsername")}</label>
              <input
                id="username"
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : t("auth.sendLoginCode")}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <div className="field">
              <label htmlFor="code">{t("auth.codeLabel")}</label>
              <input
                id="code"
                type="text"
                autoComplete="one-time-code"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
              />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : t("auth.verifyAndLogIn")}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => {
                setStep("username");
                setCode("");
                setMessage("");
              }}
            >
              {t("auth.useDifferentUsername")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
