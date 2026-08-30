import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LogoMark from "../components/LogoMark";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("renter");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const data = await api.post("/auth/register", { name, email, password, role });
      login(data.user, data.token);
      navigate(role === "owner" ? "/dashboard" : "/browse", { replace: true });
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
        <h1>Create your account</h1>
        <p className="auth-subtitle">Free for renters. Owners list for $100 / 6 months.</p>

        <div className="role-toggle" role="radiogroup" aria-label="I am a">
          <button type="button" className={role === "renter" ? "active" : ""} onClick={() => setRole("renter")}>
            Planning an event
          </button>
          <button type="button" className={role === "owner" ? "active" : ""} onClick={() => setRole("owner")}>
            I own attractions
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="field-hint">At least 8 characters.</p>
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : `Sign up as ${role === "owner" ? "an owner" : "a renter"}`}
          </button>
        </form>

        <p className="auth-footer-link">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
