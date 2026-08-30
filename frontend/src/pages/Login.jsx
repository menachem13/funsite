import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LogoMark from "../components/LogoMark";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
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
        <h1>Welcome back</h1>
        <p className="auth-subtitle">Log in to your renter or owner account.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
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
            <label htmlFor="password">Password</label>
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
            {loading ? <span className="spinner" /> : "Log in"}
          </button>
        </form>

        <p className="auth-footer-link">
          Don't have an account? <Link to="/register">Sign up</Link>
        </p>
        <p className="auth-footer-link">
          <Link to="/admin/login">Admin login</Link>
        </p>
      </div>
    </div>
  );
}
