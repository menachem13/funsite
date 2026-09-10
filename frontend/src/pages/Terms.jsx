import { useLanguage } from "../context/LanguageContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./Legal.css";

const SECTION_COUNT = 6;

export default function Terms() {
  const { t } = useLanguage();
  useDocumentTitle(t("terms.title"));
  return (
    <div className="legal-page container">
      <h1>{t("terms.title")}</h1>
      <p className="legal-intro">{t("terms.intro")}</p>
      {Array.from({ length: SECTION_COUNT }, (_, i) => i + 1).map((n) => (
        <section key={n}>
          <h2>{t(`terms.section${n}Title`)}</h2>
          <p>{t(`terms.section${n}Body`)}</p>
        </section>
      ))}
      <p className="legal-disclaimer">{t("terms.disclaimer")}</p>
    </div>
  );
}
