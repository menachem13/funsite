import { useLanguage } from "../context/LanguageContext";
import "./Legal.css";

const SECTION_COUNT = 5;

export default function Privacy() {
  const { t } = useLanguage();
  return (
    <div className="legal-page container">
      <h1>{t("privacy.title")}</h1>
      <p className="legal-intro">{t("privacy.intro")}</p>
      {Array.from({ length: SECTION_COUNT }, (_, i) => i + 1).map((n) => (
        <section key={n}>
          <h2>{t(`privacy.section${n}Title`)}</h2>
          <p>{t(`privacy.section${n}Body`)}</p>
        </section>
      ))}
      <p className="legal-disclaimer">{t("privacy.disclaimer")}</p>
    </div>
  );
}
