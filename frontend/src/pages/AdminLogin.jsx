import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LogoMark from "../components/LogoMark";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

export default function AdminLogin() {
  const { login } = useAuth();
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
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
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
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <Link className="logo" to="/">
          <LogoMark />
          funsite
        </Link>
        <h1>Admin login</h1>
        <p className="auth-subtitle">
          {step === "username" ? "Enter the admin username to request a login code." : "Enter the code that was emailed."}
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {message && step === "code" && <div className="alert alert-success">{message}</div>}

        {step === "username" ? (
          <form onSubmit={handleRequestOtp}>
            <div className="field">
              <label htmlFor="username">Admin username</label>
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
              {loading ? <span className="spinner" /> : "Send login code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <div className="field">
              <label htmlFor="code">6-digit code</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : "Verify & log in"}
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
              Use a different username
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
