import { Link } from "react-router-dom";
import ListingCard from "../components/ListingCard";
import { useSavedListings } from "../context/SavedListingsContext";
import { useLanguage } from "../context/LanguageContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./Browse.css";

export default function SavedListings() {
  const { t } = useLanguage();
  const { listings, loaded, error } = useSavedListings();
  useDocumentTitle(t("savedListings.title"));

  return (
    <div className="browse-page container">
      <div className="browse-header">
        <h1>{t("savedListings.title")}</h1>
        <p>{t("savedListings.subtitle")}</p>
      </div>

      {error && <div className="alert alert-error">{t("savedListings.loadError")}</div>}

      {!loaded ? (
        <div className="center-loading">
          <span className="spinner spinner-dark" />
        </div>
      ) : error ? null : listings.length === 0 ? (
        <div className="empty-state card">
          <p>
            <strong>{t("savedListings.emptyTitle")}</strong>
          </p>
          <p>{t("savedListings.emptyBody")}</p>
          <Link className="btn btn-primary" to="/browse">
            {t("common.browseAttractions")}
          </Link>
        </div>
      ) : (
        <div className="listing-grid">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} cover={listing.cover} />
          ))}
        </div>
      )}
    </div>
  );
}
