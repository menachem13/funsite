import { Link } from "react-router-dom";
import LogoMark from "./LogoMark";
import "./Logo.css";

/**
 * The funall wordmark lockup (funnel icon + "funall" text), used as the
 * header link back to "/" everywhere it appears: Navbar, Footer, and every
 * auth page. One component instead of each page hand-repeating the same
 * three-line JSX, so the logo only has one place to redesign.
 */
export default function Logo({ className = "", onClick }) {
  return (
    <Link className={`logo ${className}`} to="/" onClick={onClick}>
      <LogoMark />
      <span className="logo-wordmark">funall</span>
    </Link>
  );
}
