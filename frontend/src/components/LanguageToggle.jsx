import { useLanguage } from "../context/LanguageContext";
import "./LanguageToggle.css";

/** Switches the whole site between English and Yiddish (see LanguageContext). */
export default function LanguageToggle({ className = "" }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className={`language-toggle ${className}`} role="group" aria-label={t("languageToggle.label")}>
      <button
        type="button"
        className={language === "en" ? "active" : ""}
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
      >
        EN
      </button>
      <button
        type="button"
        className={language === "yi" ? "active" : ""}
        onClick={() => setLanguage("yi")}
        aria-pressed={language === "yi"}
      >
        יי
      </button>
    </div>
  );
}
