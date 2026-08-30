import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, assetUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./ListingDetail.css";

function ageLabel(min, max) {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `Ages ${min}–${max}`;
  if (min != null) return `Ages ${min}+`;
  return `Up to age ${max}`;
}

export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();

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
      .catch(() => setError("This listing couldn't be found."))
      .finally(() => setLoading(false));
  }, [id]);

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
      setSendError(err instanceof ApiError ? err.message : "Couldn't send that message. Try again.");
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
        <p>{error || "This listing couldn't be found."}</p>
        <Link className="btn btn-secondary" to="/browse">
          Back to browse
        </Link>
      </div>
    );
  }

  const age = ageLabel(listing.audience_age_min, listing.audience_age_max);
  const isOwnListing = user?.role === "owner" && user.id === listing.owner_id;
  const current = media[activeMedia];

  return (
    <div className="listing-detail container">
      <Link className="back-link" to="/browse">
        ← Back to browse
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
              <span className="count">{listing.view_count}</span> viewing
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
                ? "All genders"
                : listing.audience_gender === "male"
                  ? "Boys"
                  : "Girls"}
            </span>
            {listing.attendant_required && <span className="tag">Attendant included</span>}
          </div>

          {listing.description && <p className="detail-description">{listing.description}</p>}

          <div className="detail-contact card">
            {isOwnListing ? (
              <>
                <p>This is your listing.</p>
                <Link className="btn btn-secondary btn-block" to={`/dashboard/${listing.id}/edit`}>
                  Manage this listing
                </Link>
              </>
            ) : !user ? (
              <>
                <p>Log in as a renter to message the owner.</p>
                <Link className="btn btn-primary btn-block" to="/login" state={{ from: { pathname: `/listings/${id}` } }}>
                  Log in to message
                </Link>
              </>
            ) : user.role !== "renter" ? (
              <p>Only renter accounts can message owners.</p>
            ) : sent ? (
              <div className="alert alert-success">
                Message sent! Check your <Link to="/inbox">inbox</Link> for the owner's reply.
              </div>
            ) : (
              <form onSubmit={handleSendMessage}>
                <div className="field">
                  <label htmlFor="message">Message the owner</label>
                  <textarea
                    id="message"
                    placeholder="Hi! Is this available for..."
                    required
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                  />
                </div>
                {sendError && <div className="alert alert-error">{sendError}</div>}
                <button className="btn btn-primary btn-block" type="submit" disabled={sending}>
                  {sending ? <span className="spinner" /> : "Send message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
