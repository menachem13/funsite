import { Link } from "react-router-dom";
import { assetUrl } from "../api/client";

function ageLabel(min, max) {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `Ages ${min}–${max}`;
  if (min != null) return `Ages ${min}+`;
  return `Up to age ${max}`;
}

export default function ListingCard({ listing, featured = false, cover }) {
  const age = ageLabel(listing.audience_age_min, listing.audience_age_max);

  return (
    <Link to={`/listings/${listing.id}`} className="listing-card card card-hover">
      <div className="listing-card-media">
        {featured && <span className="badge badge-featured">Featured Today</span>}
        {cover ? (
          <img src={assetUrl(cover.url)} alt="" loading="lazy" />
        ) : (
          <div className="media-placeholder" />
        )}
      </div>
      <div className="listing-card-body">
        <div className="listing-card-top">
          <h3>{listing.title}</h3>
          <span className="live-view">
            <span className="live-dot" aria-hidden="true" />
            <span className="count">{listing.view_count ?? 0}</span> viewing
          </span>
        </div>
        <p className="listing-card-meta">
          {listing.category}
          {listing.location ? ` · ${listing.location}` : ""}
          {age ? ` · ${age}` : ""}
        </p>
        <div className="tag-row">
          {listing.audience_gender && listing.audience_gender !== "all" && (
            <span className="tag">{listing.audience_gender === "male" ? "Boys" : "Girls"}</span>
          )}
          {listing.audience_gender === "all" && <span className="tag">All genders</span>}
          {listing.attendant_required && <span className="tag">Attendant included</span>}
        </div>
      </div>
    </Link>
  );
}
