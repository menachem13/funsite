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
            funsite
          </Link>
          <p className="tagline">
            <span className="dash dash-left" />
            the site for fun
            <span className="dash dash-right" />
          </p>
        </div>
        <p className="footer-copy">&copy; {new Date().getFullYear()} Funsite. All rights reserved.</p>
      </div>
    </footer>
  );
}
