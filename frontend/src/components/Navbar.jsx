import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import LogoMark from "./LogoMark";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="logo" to="/" onClick={() => setMenuOpen(false)}>
          <LogoMark />
          fun<span className="logo-accent">all</span>
        </Link>

        <button
          className="nav-toggle"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`site-nav ${menuOpen ? "open" : ""}`} aria-label="Primary">
          <NavLink to="/browse" onClick={() => setMenuOpen(false)}>
            Browse
          </NavLink>

          {user?.role === "owner" && (
            <>
              <NavLink to="/dashboard" onClick={() => setMenuOpen(false)}>
                Dashboard
              </NavLink>
              <NavLink to="/inbox" onClick={() => setMenuOpen(false)}>
                Inbox
              </NavLink>
            </>
          )}

          {user?.role === "renter" && (
            <NavLink to="/inbox" onClick={() => setMenuOpen(false)}>
              Messages
            </NavLink>
          )}

          {user?.role === "admin" && (
            <NavLink to="/admin/coupons" onClick={() => setMenuOpen(false)}>
              Coupons
            </NavLink>
          )}

          <div className="nav-auth">
            {user ? (
              <>
                <span className="nav-user">{user.name}</span>
                <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link className="btn btn-ghost btn-sm" to="/login" onClick={() => setMenuOpen(false)}>
                  Log in
                </Link>
                <Link className="btn btn-primary btn-sm" to="/register" onClick={() => setMenuOpen(false)}>
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
