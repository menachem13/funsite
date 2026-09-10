import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, assetUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import "./ListingDetail.css";

function ageLabel(min, max, t) {
  if (min == null && max == null) return null;
  if (min != null && max != null) return t("listingDetail.agesRange", { min, max });
  if (min != null) return t("listingDetail.agesPlus", { min });
  return t("listingDetail.agesUpTo", { max });
}

export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [listing, setListing] = useState(null);
  const [media, setMedia] = useState([]);
  const [activeMedia, setActiveMedia] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .get(`/listings/${id}`)
      .then((d) => {
        setListing(d.listing);
        setMedia(d.media || []);
        setActiveMedia(0);
      })
      .catch(() => setError(t("listingDetail.notFound")))
      .finally(() => setLoading(false));
  }, [id, t]);

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!messageBody.trim()) return;
    setSendError("");
    setSending(true);
    try {
      await api.post(`/listings/${id}/messages`, { body: messageBody.trim() });
      setSent(true);
      setMessageBody("");
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : t("listingDetail.sendError"));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="center-loading">
        <span className="spinner spinner-dark" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="container empty-state">
        <p>{error || t("listingDetail.notFound")}</p>
        <Link className="btn btn-secondary" to="/browse">
          {t("listingDetail.backToBrowse")}
        </Link>
      </div>
    );
  }

  const age = ageLabel(listing.audience_age_min, listing.audience_age_max, t);
  const isOwnListing = user?.role === "owner" && user.id === listing.owner_id;
  const current = media[activeMedia];

  return (
    <div className="listing-detail container">
      <Link className="back-link" to="/browse">
        ← {t("listingDetail.backToBrowse")}
      </Link>

      <div className="detail-grid">
        <div className="detail-media">
          <div className="detail-media-main">
            {current ? (
              current.type === "video" ? (
                <video src={assetUrl(current.url)} controls />
              ) : (
                <img src={assetUrl(current.url)} alt={listing.title} />
              )
            ) : (
              <div className="media-placeholder" />
            )}
          </div>
          {media.length > 1 && (
            <div className="detail-media-thumbs">
              {media.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  className={i === activeMedia ? "active" : ""}
                  onClick={() => setActiveMedia(i)}
                  aria-label={`View media ${i + 1}`}
                >
                  {m.type === "video" ? (
                    <video src={assetUrl(m.url)} />
                  ) : (
                    <img src={assetUrl(m.url)} alt="" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <div className="detail-top">
            <h1>{listing.title}</h1>
            <span className="live-view">
              <span className="live-dot" aria-hidden="true" />
              <span className="count">{listing.view_count}</span> {t("listingDetail.viewing")}
            </span>
          </div>

          <p className="detail-meta">
            {listing.category}
            {listing.location ? ` · ${listing.location}` : ""}
          </p>

          <div className="tag-row">
            {age && <span className="tag">{age}</span>}
            <span className="tag">
              {listing.audience_gender === "all"
                ? t("listingDetail.allGenders")
                : listing.audience_gender === "male"
                  ? t("listingDetail.boys")
                  : t("listingDetail.girls")}
            </span>
            {listing.attendant_required && <span className="tag">{t("listingDetail.attendantIncluded")}</span>}
          </div>

          {listing.description && <p className="detail-description">{listing.description}</p>}

          <div className="detail-contact card">
            {isOwnListing ? (
              <>
                <p>{t("listingDetail.yourListing")}</p>
                <Link className="btn btn-secondary btn-block" to={`/dashboard/${listing.id}/edit`}>
                  {t("listingDetail.manageListing")}
                </Link>
              </>
            ) : !user ? (
              <>
                <p>{t("listingDetail.loginToMessage")}</p>
                <Link className="btn btn-primary btn-block" to="/login" state={{ from: { pathname: `/listings/${id}` } }}>
                  {t("listingDetail.loginToMessageBtn")}
                </Link>
              </>
            ) : user.role !== "renter" ? (
              <p>{t("listingDetail.onlyRentersCanMessage")}</p>
            ) : sent ? (
              <div className="alert alert-success">
                {t("listingDetail.messageSentPrefix")} <Link to="/inbox">{t("listingDetail.messageSentInbox")}</Link>{" "}
                {t("listingDetail.messageSentSuffix")}
              </div>
            ) : (
              <form onSubmit={handleSendMessage}>
                <div className="field">
                  <label htmlFor="message">{t("listingDetail.messageLabel")}</label>
                  <textarea
                    id="message"
                    placeholder={t("listingDetail.messagePlaceholder")}
                    required
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                  />
                </div>
                {sendError && <div className="alert alert-error">{sendError}</div>}
                <button className="btn btn-primary btn-block" type="submit" disabled={sending}>
                  {sending ? <span className="spinner" /> : t("listingDetail.sendMessage")}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
