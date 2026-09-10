import { Link } from "react-router-dom";
import LogoMark from "./LogoMark";
import { useLanguage } from "../context/LanguageContext";
import "./Footer.css";

export default function Footer() {
  const { language, t } = useLanguage();

  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-top">
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

          <nav className="footer-col" aria-labelledby="footer-explore-heading">
            <h3 id="footer-explore-heading">{t("footer.exploreHeading")}</h3>
            <Link to="/browse">{t("footer.browse")}</Link>
            <Link to="/#categories">{t("footer.categories")}</Link>
            <Link to="/#how-it-works">{t("footer.howItWorks")}</Link>
          </nav>

          <nav className="footer-col" aria-labelledby="footer-providers-heading">
            <h3 id="footer-providers-heading">{t("footer.providersHeading")}</h3>
            <Link to="/register">{t("footer.listAttraction")}</Link>
            <Link to="/#pricing">{t("footer.pricing")}</Link>
          </nav>

          <nav className="footer-col" aria-labelledby="footer-funall-heading">
            <h3 id="footer-funall-heading">{t("footer.funallHeading")}</h3>
            <Link to="/#faq">{t("footer.faq")}</Link>
            <Link to="/privacy">{t("footer.privacy")}</Link>
            <Link to="/terms">{t("footer.terms")}</Link>
          </nav>
        </div>

        <p className="footer-copy">
          &copy; {new Date().getFullYear()} Funall. {t("footer.copyright")}
        </p>
      </div>
    </footer>
  );
}
