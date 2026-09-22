import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError, assetUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { formatEventDate, isValidFutureDate } from "../utils/date";
import SaveButton from "../components/SaveButton";
import "./ListingDetail.css";

function ageLabel(min, max, t) {
  if (min == null && max == null) return null;
  if (min != null && max != null) return t("listingDetail.agesRange", { min, max });
  if (min != null) return t("listingDetail.agesPlus", { min });
  return t("listingDetail.agesUpTo", { max });
}

// See the matching helper in ListingCard.jsx — isolates a Latin-script name
// embedded in a Yiddish/RTL sentence so it doesn't visually reorder or split
// oddly when the surrounding text wraps.
function withName(template, name) {
  const [before, after] = template.split("{name}");
  return (
    <>
      {before}
      <bdi>{name}</bdi>
      {after}
    </>
  );
}

// Composes a starting message from whatever discovery context (event type,
// group size, location, event date) the customer actually brought with them
// from search — never inventing fields that weren't provided. Returns "" when
// none apply, so the normal empty/placeholder experience is unchanged for a
// direct visit. A past or malformed date is treated the same as no date.
function buildPrefillMessage(t, language, { eventType, groupSize, location, eventDate }) {
  const dateLabel = isValidFutureDate(eventDate) ? formatEventDate(eventDate, language) : "";
  if (!eventType && !groupSize && !location && !dateLabel) return "";

  const eventLabel = eventType ? t(`eventTypes.${eventType}`).toLowerCase() : "";
  let sentence = eventLabel
    ? t("listingDetail.prefillIntroWithEvent", { eventType: eventLabel })
    : t("listingDetail.prefillIntroGeneric");
  if (groupSize) sentence += t("listingDetail.prefillGroupSize", { count: groupSize });
  if (location) sentence += t("listingDetail.prefillLocation", { location });
  if (dateLabel) sentence += t("listingDetail.prefillDate", { date: dateLabel });
  sentence += t("listingDetail.prefillClosing");

  return `${t("listingDetail.prefillGreeting")} ${sentence}`;
}

function readDiscoveryContext(searchParams) {
  return {
    eventType: searchParams.get("eventType") || "",
    groupSize: searchParams.get("groupSize") || "",
    location: searchParams.get("location") || "",
    eventDate: searchParams.get("eventDate") || "",
  };
}

export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();

  const [listing, setListing] = useState(null);
  const [media, setMedia] = useState([]);
  const [activeMedia, setActiveMedia] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [messageBody, setMessageBody] = useState(() =>
    buildPrefillMessage(t, language, readDiscoveryContext(searchParams))
  );
  const [wasPrefilled, setWasPrefilled] = useState(() => messageBody !== "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");
  const prefilledForId = useRef(id);

  useDocumentTitle(listing?.title || t("browse.title"));

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

  // Re-derive the pre-fill only when navigating to a different listing (the
  // lazy state above already handles the initial one). This keeps an
  // in-progress edit from being overwritten by an unrelated re-render, such
  // as a language toggle.
  useEffect(() => {
    if (prefilledForId.current === id) return;
    prefilledForId.current = id;
    const prefill = buildPrefillMessage(t, language, readDiscoveryContext(searchParams));
    setMessageBody(prefill);
    setWasPrefilled(prefill !== "");
    setSent(false);
    setSendError("");
  }, [id, searchParams, t, language]);

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

  const discoveryContext = readDiscoveryContext(searchParams);
  const requestDateLabel = isValidFutureDate(discoveryContext.eventDate)
    ? formatEventDate(discoveryContext.eventDate, language)
    : "";
  const hasRequestContext =
    !isOwnListing &&
    (discoveryContext.eventType || discoveryContext.groupSize || discoveryContext.location || requestDateLabel);

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
            <div className="detail-top-actions">
              <span className="live-view">
                <span className="live-dot" aria-hidden="true" />
                <span className="count">{listing.view_count}</span> {t("listingDetail.viewing")}
              </span>
              <SaveButton listing={listing} />
            </div>
          </div>

          <p className="detail-meta">{t(`browse.categories.${listing.category}`)}</p>

          {listing.description && <p className="detail-description">{listing.description}</p>}

          <dl className="detail-facts">
            {listing.owner_name && (
              <div className="detail-fact">
                <dt>{t("listingDetail.listedByLabel")}</dt>
                <dd>
                  <bdi>{listing.owner_name}</bdi>
                </dd>
              </div>
            )}
            {listing.capacity != null && (
              <div className="detail-fact">
                <dt>{t("listingDetail.capacityLabel")}</dt>
                <dd>{t("listingDetail.capacity", { count: listing.capacity })}</dd>
              </div>
            )}
            {(listing.event_types || []).length > 0 && (
              <div className="detail-fact">
                <dt>{t("listingDetail.suitableForLabel")}</dt>
                <dd className="detail-fact-chips">
                  {listing.event_types.map((value) => (
                    <span className="tag" key={value}>
                      {t(`eventTypes.${value}`)}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {listing.location && (
              <div className="detail-fact">
                <dt>{t("listingDetail.locationLabel")}</dt>
                <dd>{listing.location}</dd>
              </div>
            )}
          </dl>

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

          {hasRequestContext && (
            <div className="detail-request">
              <h2 className="request-heading">{t("listingDetail.requestHeading")}</h2>
              <dl className="detail-facts">
                {discoveryContext.eventType && (
                  <div className="detail-fact">
                    <dt>{t("listingDetail.requestEventLabel")}</dt>
                    <dd>{t(`eventTypes.${discoveryContext.eventType}`)}</dd>
                  </div>
                )}
                {discoveryContext.groupSize && (
                  <div className="detail-fact">
                    <dt>{t("listingDetail.requestGroupLabel")}</dt>
                    <dd>{discoveryContext.groupSize}+</dd>
                  </div>
                )}
                {discoveryContext.location && (
                  <div className="detail-fact">
                    <dt>{t("listingDetail.locationLabel")}</dt>
                    <dd>{discoveryContext.location}</dd>
                  </div>
                )}
                {requestDateLabel && (
                  <div className="detail-fact">
                    <dt>{t("listingDetail.requestDateLabel")}</dt>
                    <dd>{requestDateLabel}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          <div className="detail-contact card">
            {!isOwnListing && (
              <>
                <h2 className="contact-owner-heading">
                  {listing.owner_name
                    ? withName(t("listingDetail.contactOwnerHeadingNamed"), listing.owner_name)
                    : t("listingDetail.contactOwnerHeading")}
                </h2>
                <p className="contact-owner-subtitle">{t("listingDetail.contactOwnerSubtitle")}</p>
              </>
            )}
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
                  {wasPrefilled && <p className="field-hint">{t("listingDetail.prefillHint")}</p>}
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
