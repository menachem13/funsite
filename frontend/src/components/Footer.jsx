import { Link } from "react-router-dom";
import LogoMark from "./LogoMark";
import { useLanguage } from "../context/LanguageContext";
import "./Footer.css";

export default function Footer() {
  const { language, t } = useLanguage();

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
            {language === "en" ? (
              <>
                as a <span className="tagline-highlight">&ldquo;funnel&rdquo;</span> for your entertainment
              </>
            ) : (
              t("footer.tagline")
            )}
            <span className="dash dash-right" />
          </p>
        </div>
        <p className="footer-copy">
          &copy; {new Date().getFullYear()} Funall. {t("footer.copyright")}
        </p>
      </div>
    </footer>
  );
}
