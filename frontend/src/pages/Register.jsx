import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LogoMark from "../components/LogoMark";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import "./Auth.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [role, setRole] = useState("renter");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const alertRef = useRef(null);
  const passwordRef = useRef(null);

  const emailValid = EMAIL_PATTERN.test(email);
  const passwordValid = password.length >= 8;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!passwordValid) {
      setPasswordTouched(true);
      setError(t("auth.passwordTooShort"));
      passwordRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      const data = await api.post("/auth/register", { name, email, password, role });
      login(data.user, data.token);
      navigate(role === "owner" ? "/dashboard" : "/browse", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.genericError"));
      // The password-too-short path above moves focus to that field directly
      // since it's field-specific; a server-side failure (e.g. email already
      // registered) isn't tied to one field, so the alert itself gets focus.
      setTimeout(() => alertRef.current?.focus(), 0);
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
        <h1>{t("auth.registerTitle")}</h1>
        <p className="auth-subtitle">{t("auth.registerSubtitle")}</p>

        <div className="role-toggle" role="radiogroup" aria-label={t("auth.iAmA")}>
          <button type="button" className={role === "renter" ? "active" : ""} onClick={() => setRole("renter")}>
            {t("auth.planningEvent")}
          </button>
          <button type="button" className={role === "owner" ? "active" : ""} onClick={() => setRole("owner")}>
            {t("auth.ownAttractions")}
          </button>
        </div>

        {error && (
          <div className="alert alert-error" role="alert" tabIndex={-1} ref={alertRef} id="register-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">{t("auth.fullName")}</label>
            <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email">{t("auth.email")}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className={emailTouched ? (emailValid ? "input-valid" : "input-invalid") : ""}
              aria-invalid={emailTouched && !emailValid ? "true" : undefined}
              aria-describedby={emailTouched ? "email-hint" : undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
            />
            {emailTouched && (
              <p id="email-hint" className={`field-hint ${emailValid ? "hint-valid" : "hint-invalid"}`}>
                {emailValid ? t("auth.emailValid") : t("auth.emailInvalid")}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="password">{t("auth.password")}</label>
            <input
              id="password"
              ref={passwordRef}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className={passwordTouched ? (passwordValid ? "input-valid" : "input-invalid") : ""}
              aria-invalid={passwordTouched && !passwordValid ? "true" : undefined}
              aria-describedby="password-hint"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setPasswordTouched(true)}
            />
            <p id="password-hint" className={`field-hint ${passwordTouched ? (passwordValid ? "hint-valid" : "hint-invalid") : ""}`}>
              {passwordTouched && passwordValid ? "✓ " : ""}
              {t("auth.passwordHint")}
            </p>
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : role === "owner" ? t("auth.signUpAsOwner") : t("auth.signUpAsRenter")}
          </button>
        </form>

        <p className="auth-footer-link">
          {t("auth.alreadyHaveAccount")} <Link to="/login">{t("auth.logIn")}</Link>
        </p>
      </div>
    </div>
  );
}
