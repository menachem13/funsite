import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="container" style={{ padding: "100px 24px", textAlign: "center" }}>
      <h1>{t("notFound.title")}</h1>
      <p>{t("notFound.body")}</p>
      <Link className="btn btn-primary" to="/">
        {t("notFound.backHome")}
      </Link>
    </div>
  );
}
