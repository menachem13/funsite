import { Link } from "react-router-dom";
import { assetUrl } from "../api/client";
import { useLanguage } from "../context/LanguageContext";

function ageLabel(min, max, t) {
  if (min == null && max == null) return null;
  if (min != null && max != null) return t("listingDetail.agesRange", { min, max });
  if (min != null) return t("listingDetail.agesPlus", { min });
  return t("listingDetail.agesUpTo", { max });
}

export default function ListingCard({ listing, featured = false, cover }) {
  const { t } = useLanguage();
  const age = ageLabel(listing.audience_age_min, listing.audience_age_max, t);
  const eventTypes = listing.event_types || [];

  return (
    <Link to={`/listings/${listing.id}`} className="listing-card card card-hover">
      <div className="listing-card-media">
        {featured && <span className="badge badge-featured">{t("listingCard.featuredToday")}</span>}
        {cover ? (
          cover.type === "video" ? (
            <video src={assetUrl(cover.url)} muted playsInline />
          ) : (
            <img src={assetUrl(cover.url)} alt={listing.title} loading="lazy" />
          )
        ) : (
          <div className="media-placeholder" />
        )}
      </div>
      <div className="listing-card-body">
        <div className="listing-card-top">
          <h3>{listing.title}</h3>
          <span className="live-view">
            <span className="live-dot" aria-hidden="true" />
            <span className="count">{listing.view_count ?? 0}</span> {t("listingCard.viewing")}
          </span>
        </div>
        <p className="listing-card-meta">
          {t(`browse.categories.${listing.category}`)}
          {listing.location ? ` · ${listing.location}` : ""}
          {age ? ` · ${age}` : ""}
        </p>
        {eventTypes.length > 0 && (
          <p className="listing-card-suitable">
            {t("listingCard.bestFor")} {eventTypes.map((v) => t(`eventTypes.${v}`)).join(" • ")}
          </p>
        )}
        <div className="tag-row">
          {listing.audience_gender && listing.audience_gender !== "all" && (
            <span className="tag">{listing.audience_gender === "male" ? t("listingCard.boys") : t("listingCard.girls")}</span>
          )}
          {listing.audience_gender === "all" && <span className="tag">{t("listingCard.allGenders")}</span>}
          {listing.attendant_required && <span className="tag">{t("listingCard.attendantIncluded")}</span>}
          {listing.capacity != null && <span className="tag">{t("listingCard.capacity", { count: listing.capacity })}</span>}
        </div>
      </div>
    </Link>
  );
}
