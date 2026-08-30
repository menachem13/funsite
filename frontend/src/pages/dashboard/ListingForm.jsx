import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError, assetUrl, getToken, API_URL } from "../../api/client";
import "./Dashboard.css";

const CATEGORIES = ["inflatable", "photo booth", "carousel", "dunk tank", "face painting", "game trailer"];
const EMPTY_FORM = {
  title: "",
  description: "",
  category: CATEGORIES[0],
  location: "",
  audienceAgeMin: "",
  audienceAgeMax: "",
  audienceGender: "all",
  attendantRequired: false,
};

function paymentStorageKey(listingId) {
  return `funsite_payment_${listingId}`;
}

export default function ListingForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [listing, setListing] = useState(null);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/listings/${id}`)
      .then((d) => {
        setListing(d.listing);
        setMedia(d.media || []);
        setForm({
          title: d.listing.title || "",
          description: d.listing.description || "",
          category: d.listing.category || CATEGORIES[0],
          location: d.listing.location || "",
          audienceAgeMin: d.listing.audience_age_min ?? "",
          audienceAgeMax: d.listing.audience_age_max ?? "",
          audienceGender: d.listing.audience_gender || "all",
          attendantRequired: !!d.listing.attendant_required,
        });
      })
      .catch(() => setError("Couldn't load this listing."))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      location: form.location.trim() || null,
      audienceAgeMin: form.audienceAgeMin === "" ? null : Number(form.audienceAgeMin),
      audienceAgeMax: form.audienceAgeMax === "" ? null : Number(form.audienceAgeMax),
      audienceGender: form.audienceGender,
      attendantRequired: form.attendantRequired,
    };

    try {
      if (isEdit) {
        const { listing: updated } = await api.put(`/listings/${id}`, payload);
        setListing(updated);
        setSuccess("Changes saved.");
      } else {
        const { listing: created } = await api.post("/listings", payload);
        navigate(`/dashboard/${created.id}/edit`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this listing.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="center-loading">
        <span className="spinner spinner-dark" />
      </div>
    );
  }

  return (
    <div className="dashboard-page container-narrow">
      <Link className="back-link" to="/dashboard">
        ← Back to dashboard
      </Link>
      <h1>{isEdit ? "Manage listing" : "New listing"}</h1>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit} className="card">
        <div className="field">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            type="text"
            required
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" value={form.category} onChange={(e) => updateField("category", e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="location">Location</label>
            <input
              id="location"
              type="text"
              placeholder="City or area"
              value={form.location}
              onChange={(e) => updateField("location", e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="ageMin">Min age</label>
            <input
              id="ageMin"
              type="number"
              min="0"
              value={form.audienceAgeMin}
              onChange={(e) => updateField("audienceAgeMin", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ageMax">Max age</label>
            <input
              id="ageMax"
              type="number"
              min="0"
              value={form.audienceAgeMax}
              onChange={(e) => updateField("audienceAgeMax", e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="gender">Audience</label>
            <select
              id="gender"
              value={form.audienceGender}
              onChange={(e) => updateField("audienceGender", e.target.value)}
            >
              <option value="all">All genders</option>
              <option value="male">Boys</option>
              <option value="female">Girls</option>
            </select>
          </div>
          <div className="field">
            <label className="checkbox-row" htmlFor="attendantRequired" style={{ marginTop: 30 }}>
              <input
                id="attendantRequired"
                type="checkbox"
                checked={form.attendantRequired}
                onChange={(e) => updateField("attendantRequired", e.target.checked)}
              />
              Attendant required
            </label>
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? <span className="spinner" /> : isEdit ? "Save changes" : "Create listing"}
        </button>
      </form>

      {isEdit && (
        <>
          <MediaManager listingId={id} media={media} onChange={setMedia} />
          <PaymentPanel listing={listing} onListingChange={setListing} />
        </>
      )}
    </div>
  );
}

function MediaManager({ listingId, media, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setError("");
    setUploading(true);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));

    try {
      const res = await fetch(`${API_URL}/listings/${listingId}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      onChange((prev) => [...prev, ...data.media]);
    } catch (err) {
      setError(err.message || "Couldn't upload those files.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <section className="card dashboard-section">
      <h2>Photos &amp; video</h2>
      <p>Unlimited uploads. The first photo is used as the cover on listing cards.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {media.length > 0 && (
        <div className="media-grid">
          {media.map((m) => (
            <div className="media-thumb" key={m.id}>
              {m.type === "video" ? <video src={assetUrl(m.url)} /> : <img src={assetUrl(m.url)} alt="" />}
            </div>
          ))}
        </div>
      )}

      <label className="upload-btn btn btn-secondary btn-sm">
        {uploading ? <span className="spinner spinner-dark" /> : "Upload photos or video"}
        <input type="file" multiple accept="image/*,video/*" hidden onChange={handleFiles} disabled={uploading} />
      </label>
    </section>
  );
}

function PaymentPanel({ listing, onListingChange }) {
  const [couponCode, setCouponCode] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(() => {
    try {
      const raw = listing && localStorage.getItem(paymentStorageKey(listing.id));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [deferredStatus, setDeferredStatus] = useState(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!listing) return;
    try {
      const raw = localStorage.getItem(paymentStorageKey(listing.id));
      setPending(raw ? JSON.parse(raw) : null);
    } catch {
      setPending(null);
    }
  }, [listing]);

  useEffect(() => {
    if (!pending?.isTrial || !pending?.paymentId) return;
    api
      .get(`/payments/${pending.paymentId}/deferred-status`)
      .then(setDeferredStatus)
      .catch(() => setDeferredStatus(null));
  }, [pending]);

  function savePending(next) {
    if (!listing) return;
    if (next) localStorage.setItem(paymentStorageKey(listing.id), JSON.stringify(next));
    else localStorage.removeItem(paymentStorageKey(listing.id));
    setPending(next);
  }

  async function handleCheckout(e) {
    e.preventDefault();
    setError("");
    setCheckoutLoading(true);
    try {
      const res = await api.post(`/payments/listings/${listing.id}/checkout`, {
        couponCode: couponCode.trim() || undefined,
      });
      savePending({
        paymentId: res.payment.id,
        providerRef: res.payment.provider_ref,
        isTrial: !!res.trialActivated,
      });
      if (res.trialActivated) {
        const { listing: fresh } = await api.get(`/listings/${listing.id}`);
        onListingChange(fresh);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Checkout failed.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleCompleteDemoPayment() {
    if (!pending) return;
    setCompleting(true);
    setError("");
    try {
      await api.post("/payments/webhook", { providerRef: pending.providerRef, status: "paid" });
      const { listing: fresh } = await api.get(`/listings/${listing.id}`);
      onListingChange(fresh);
      savePending(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't complete that payment.");
    } finally {
      setCompleting(false);
    }
  }

  async function handleCompleteDeferred() {
    if (!pending) return;
    setCompleting(true);
    setError("");
    try {
      await api.post(`/payments/${pending.paymentId}/complete-deferred`);
      const { listing: fresh } = await api.get(`/listings/${listing.id}`);
      onListingChange(fresh);
      savePending(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Not enough views yet.");
    } finally {
      setCompleting(false);
    }
  }

  if (!listing) return null;

  return (
    <section className="card dashboard-section">
      <h2>Listing plan</h2>
      <p>
        Status: <span className={`badge badge-status-${listing.status}`}>{listing.status}</span>
        {listing.subscription_expires_at && (
          <> · Renews or expires {new Date(listing.subscription_expires_at).toLocaleDateString()}</>
        )}
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      {pending?.isTrial ? (
        <div className="trial-panel">
          <p>
            <strong>Free trial active.</strong> This listing becomes chargeable once it reaches its view
            threshold.
          </p>
          {deferredStatus && (
            <p>
              Progress: {deferredStatus.currentViews} / {deferredStatus.viewThreshold} views
            </p>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={handleCompleteDeferred}
            disabled={completing || !deferredStatus?.thresholdMet}
          >
            {completing ? <span className="spinner" /> : "Complete payment now"}
          </button>
          {deferredStatus && !deferredStatus.thresholdMet && (
            <p className="field-hint">Not chargeable yet — check back once the threshold is met.</p>
          )}
        </div>
      ) : pending ? (
        <div className="trial-panel">
          <p>
            <strong>Payment pending.</strong> No real payment processor is connected yet (see the product
            spec) — this completes the stub flow the same way a real Stripe webhook would.
          </p>
          <button className="btn btn-primary btn-sm" onClick={handleCompleteDemoPayment} disabled={completing}>
            {completing ? <span className="spinner" /> : "Complete demo payment"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleCheckout} className="checkout-form">
          <div className="field">
            <label htmlFor="coupon">Coupon code (optional)</label>
            <input
              id="coupon"
              type="text"
              placeholder="e.g. SAVE25"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" type="submit" disabled={checkoutLoading}>
            {checkoutLoading ? <span className="spinner" /> : "Pay $100 / activate listing"}
          </button>
        </form>
      )}
    </section>
  );
}
