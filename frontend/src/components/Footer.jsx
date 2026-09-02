import { Link } from "react-router-dom";
import LogoMark from "./LogoMark";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Link className="logo" to="/">
            <LogoMark />
            fun<span className="logo-accent">all</span>
          </Link>
          <p className="tagline">
            <span className="dash dash-left" />
            as a <span className="tagline-highlight">&ldquo;funnel&rdquo;</span> for your entertainment
            <span className="dash dash-right" />
          </p>
        </div>
        <p className="footer-copy">&copy; {new Date().getFullYear()} Funall. All rights reserved.</p>
      </div>
    </footer>
  );
}
