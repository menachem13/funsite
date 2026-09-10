import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import LogoMark from "./LogoMark";
import LanguageToggle from "./LanguageToggle";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import "./Navbar.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
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
            {t("nav.browse")}
          </NavLink>

          {user?.role === "owner" && (
            <>
              <NavLink to="/dashboard" onClick={() => setMenuOpen(false)}>
                {t("nav.dashboard")}
              </NavLink>
              <NavLink to="/inbox" onClick={() => setMenuOpen(false)}>
                {t("nav.inbox")}
              </NavLink>
            </>
          )}

          {user?.role === "renter" && (
            <NavLink to="/inbox" onClick={() => setMenuOpen(false)}>
              {t("nav.messages")}
            </NavLink>
          )}

          {user?.role === "admin" && (
            <NavLink to="/admin/coupons" onClick={() => setMenuOpen(false)}>
              {t("nav.coupons")}
            </NavLink>
          )}

          <div className="nav-auth">
            <LanguageToggle />
            {user ? (
              <>
                <span className="nav-user">{user.name}</span>
                <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                  {t("nav.logOut")}
                </button>
              </>
            ) : (
              <>
                <Link className="btn btn-ghost btn-sm" to="/login" onClick={() => setMenuOpen(false)}>
                  {t("nav.logIn")}
                </Link>
                <Link className="btn btn-primary btn-sm" to="/register" onClick={() => setMenuOpen(false)}>
                  {t("nav.signUp")}
                </Link>
              </>
            )}
          </div>
        </nav>

        <Link className="logo logo-he" to="/" onClick={() => setMenuOpen(false)}>
          <LogoMark />
          <img className="logo-wordmark-he" src="/funall-wordmark-he.png" alt="פאנאל" />
        </Link>
      </div>
    </header>
  );
}
