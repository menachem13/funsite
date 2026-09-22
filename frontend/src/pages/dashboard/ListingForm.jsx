import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError, assetUrl, getToken, API_URL } from "../../api/client";
import { useLanguage } from "../../context/LanguageContext";
import { listingCompletenessChecklist } from "../../utils/listingCompleteness";
import { CATEGORY_VALUES } from "../../constants/categories";
import "./Dashboard.css";

const EVENT_TYPES = ["camp", "school", "community", "family", "large", "other"];
const EMPTY_FORM = {
  title: "",
  description: "",
  category: CATEGORY_VALUES[0],
  locationCity: "",
  locationState: "",
  audienceAgeMin: "",
  audienceAgeMax: "",
  audienceGender: "all",
  attendantRequired: false,
  capacity: "",
  eventTypes: [],
};

function paymentStorageKey(listingId) {
  return `funsite_payment_${listingId}`;
}

// A listing from before structured location existed (or one whose text
// genuinely couldn't be split — see the migration in schema.sql) has
// location_city/location_state both null but still has its original
// combined `location` text. Rather than showing blank fields — which,
// left untouched and saved, would silently blank out that text — the
// City field starts from it, so an untouched save round-trips to the same
// displayed value, and the owner can freely split it further if they want.
function initialCityValue(listing) {
  if (listing.location_city) return listing.location_city;
  if (!listing.location_state && listing.location) return listing.location;
  return "";
}

export default function ListingForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { t } = useLanguage();

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
          category: d.listing.category || CATEGORY_VALUES[0],
          locationCity: initialCityValue(d.listing),
          locationState: d.listing.location_state || "",
          audienceAgeMin: d.listing.audience_age_min ?? "",
          audienceAgeMax: d.listing.audience_age_max ?? "",
          audienceGender: d.listing.audience_gender || "all",
          attendantRequired: !!d.listing.attendant_required,
          capacity: d.listing.capacity ?? "",
          eventTypes: d.listing.event_types || [],
        });
      })
      .catch(() => setError(t("dashboard.loadListingError")))
      .finally(() => setLoading(false));
  }, [id, isEdit, t]);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleEventType(value) {
    setForm((f) => ({
      ...f,
      eventTypes: f.eventTypes.includes(value)
        ? f.eventTypes.filter((v) => v !== value)
        : [...f.eventTypes, value],
    }));
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
      locationCity: form.locationCity.trim() || null,
      locationState: form.locationState.trim() || null,
      audienceAgeMin: form.audienceAgeMin === "" ? null : Number(form.audienceAgeMin),
      audienceAgeMax: form.audienceAgeMax === "" ? null : Number(form.audienceAgeMax),
      audienceGender: form.audienceGender,
      attendantRequired: form.attendantRequired,
      capacity: form.capacity === "" ? null : Number(form.capacity),
      eventTypes: form.eventTypes,
    };

    try {
      if (isEdit) {
        const { listing: updated } = await api.put(`/listings/${id}`, payload);
        setListing(updated);
        setSuccess(t("dashboard.changesSaved"));
      } else {
        const { listing: created } = await api.post("/listings", payload);
        navigate(`/dashboard/${created.id}/edit`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("dashboard.saveError"));
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
        ← {t("dashboard.backToDashboard")}
      </Link>
      <h1>{isEdit ? t("dashboard.manageListingTitle") : t("dashboard.newListingTitle")}</h1>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit} className="card">
        <div className="field">
          <label htmlFor="title">{t("dashboard.formTitle")}</label>
          <input
            id="title"
            type="text"
            required
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="description">{t("dashboard.formDescription")}</label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="category">{t("dashboard.formCategory")}</label>
            <select id="category" value={form.category} onChange={(e) => updateField("category", e.target.value)}>
              {CATEGORY_VALUES.map((c) => (
                <option key={c} value={c}>
                  {t(`browse.categories.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="locationCity">{t("dashboard.formCity")}</label>
            <input
              id="locationCity"
              type="text"
              placeholder={t("dashboard.formCityPlaceholder")}
              value={form.locationCity}
              onChange={(e) => updateField("locationCity", e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="locationState">{t("dashboard.formState")}</label>
            <input
              id="locationState"
              type="text"
              placeholder={t("dashboard.formStatePlaceholder")}
              value={form.locationState}
              onChange={(e) => updateField("locationState", e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="ageMin">{t("dashboard.formMinAge")}</label>
            <input
              id="ageMin"
              type="number"
              min="0"
              value={form.audienceAgeMin}
              onChange={(e) => updateField("audienceAgeMin", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ageMax">{t("dashboard.formMaxAge")}</label>
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
            <label htmlFor="gender">{t("dashboard.formAudience")}</label>
            <select
              id="gender"
              value={form.audienceGender}
              onChange={(e) => updateField("audienceGender", e.target.value)}
            >
              <option value="all">{t("dashboard.allGenders")}</option>
              <option value="male">{t("dashboard.boys")}</option>
              <option value="female">{t("dashboard.girls")}</option>
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
              {t("dashboard.formAttendantRequired")}
            </label>
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="capacity">{t("dashboard.formCapacity")}</label>
            <input
              id="capacity"
              type="number"
              min="1"
              placeholder={t("dashboard.formCapacityPlaceholder")}
              value={form.capacity}
              onChange={(e) => updateField("capacity", e.target.value)}
            />
            <p className="field-hint">{t("dashboard.formCapacityHint")}</p>
          </div>
        </div>

        <div className="field">
          <label>{t("dashboard.formEventTypes")}</label>
          <p className="field-hint">{t("dashboard.formEventTypesHint")}</p>
          <div className="checkbox-grid">
            {EVENT_TYPES.map((value) => (
              <label className="checkbox-row" key={value}>
                <input
                  type="checkbox"
                  checked={form.eventTypes.includes(value)}
                  onChange={() => toggleEventType(value)}
                />
                {t(`eventTypes.${value}`)}
              </label>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? <span className="spinner" /> : isEdit ? t("dashboard.saveChanges") : t("dashboard.createListing")}
        </button>
      </form>

      {isEdit && (
        <>
          <CompletenessChecklist listing={listing} media={media} />
          <MediaManager listingId={id} media={media} onChange={setMedia} />
          <PaymentPanel listing={listing} onListingChange={setListing} />
        </>
      )}
    </div>
  );
}

function CompletenessChecklist({ listing, media }) {
  const { t } = useLanguage();
  if (!listing) return null;

  const checklist = listingCompletenessChecklist({ ...listing, media_count: media.length });
  const done = checklist.filter((c) => c.done).length;

  return (
    <section className="card dashboard-section">
      <h2>{t("dashboard.completenessTitle")}</h2>
      <p>{t("dashboard.completenessSubtitle")}</p>
      <p className="field-hint">{t("dashboard.completenessCount", { done, total: checklist.length })}</p>
      <ul className="completeness-list">
        {checklist.map((item) => (
          <li key={item.key} className={item.done ? "done" : ""}>
            <span className="completeness-mark" aria-hidden="true">
              {item.done ? "✓" : ""}
            </span>
            {t(item.labelKey)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function MediaManager({ listingId, media, onChange }) {
  const { t } = useLanguage();
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
      if (!res.ok) throw new Error(data?.error || t("dashboard.uploadFailed"));
      onChange((prev) => [...prev, ...data.media]);
    } catch (err) {
      setError(err.message || t("dashboard.uploadError"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <section className="card dashboard-section">
      <h2>{t("dashboard.photosVideoTitle")}</h2>
      <p>{t("dashboard.photosVideoBody")}</p>

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
        {uploading ? <span className="spinner spinner-dark" /> : t("dashboard.uploadPhotosVideo")}
        <input type="file" multiple accept="image/*,video/*" hidden onChange={handleFiles} disabled={uploading} />
      </label>
    </section>
  );
}

function PaymentPanel({ listing, onListingChange }) {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [couponCode, setCouponCode] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");
  // Trial-in-progress state only — the ordinary paid checkout never lands
  // here anymore, since the browser leaves entirely for Stripe's hosted
  // page and only real Stripe (via the webhook) can ever mark it paid.
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
  const [paymentNotice, setPaymentNotice] = useState(null);

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

  // Owner's browser returning from Stripe's hosted checkout page. Strip the
  // query param right away so a page refresh doesn't re-trigger this, then
  // either show the "cancelled, no charge" notice or poll briefly for the
  // webhook to land — Stripe calls it almost immediately, but not
  // synchronously with this redirect, so the listing may not be active yet
  // on the very first check.
  useEffect(() => {
    const paymentParam = searchParams.get("payment");
    if (!paymentParam || !listing) return;

    setSearchParams(
      (sp) => {
        sp.delete("payment");
        return sp;
      },
      { replace: true }
    );

    if (paymentParam === "cancelled") {
      setPaymentNotice("cancelled");
      return;
    }
    if (paymentParam !== "success") return;

    setPaymentNotice("pending");
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const { listing: fresh } = await api.get(`/listings/${listing.id}`);
        if (fresh.status === "active") {
          if (!cancelled) {
            onListingChange(fresh);
            setPaymentNotice("active");
          }
          return;
        }
      } catch {
        // Transient failure — keep polling rather than giving up on one miss.
      }
      if (attempts < 8 && !cancelled) setTimeout(poll, 2000);
    };
    poll();
    return () => {
      cancelled = true;
    };
    // Only re-run when the URL's payment param itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("payment")]);

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
      if (res.trialActivated) {
        savePending({ paymentId: res.payment.id, isTrial: true });
        const { listing: fresh } = await api.get(`/listings/${listing.id}`);
        onListingChange(fresh);
        setCheckoutLoading(false);
      } else {
        // Full navigation to Stripe's hosted page — component state below
        // this point never runs, so no need to reset checkoutLoading.
        window.location.href = res.checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("dashboard.checkoutFailed"));
      setCheckoutLoading(false);
    }
  }

  async function handleCompleteDeferred() {
    if (!pending) return;
    setCompleting(true);
    setError("");
    try {
      const { checkoutUrl } = await api.post(`/payments/${pending.paymentId}/complete-deferred`);
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("dashboard.notEnoughViews"));
      setCompleting(false);
    }
  }

  if (!listing) return null;

  return (
    <section className="card dashboard-section">
      <h2>{t("dashboard.listingPlanTitle")}</h2>
      <p>
        {t("dashboard.status")}: <span className={`badge badge-status-${listing.status}`}>{listing.status}</span>
        {listing.subscription_expires_at && (
          <> · {t("dashboard.renewsOrExpires")} {new Date(listing.subscription_expires_at).toLocaleDateString()}</>
        )}
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      {paymentNotice === "pending" && (
        <div className="alert alert-info">
          <span className="spinner" /> {t("dashboard.paymentSuccessPending")}
        </div>
      )}
      {paymentNotice === "active" && <div className="alert alert-success">{t("dashboard.paymentSuccessActive")}</div>}
      {paymentNotice === "cancelled" && <div className="alert alert-info">{t("dashboard.paymentCancelled")}</div>}

      {pending?.isTrial ? (
        <div className="trial-panel">
          <p>
            <strong>{t("dashboard.trialActiveStrong")}</strong> {t("dashboard.trialActiveBody")}
          </p>
          {deferredStatus && (
            <p>{t("dashboard.progressLabel", { current: deferredStatus.currentViews, threshold: deferredStatus.viewThreshold })}</p>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={handleCompleteDeferred}
            disabled={completing || !deferredStatus?.thresholdMet}
          >
            {completing ? <span className="spinner" /> : t("dashboard.completePaymentNow")}
          </button>
          {deferredStatus && !deferredStatus.thresholdMet && (
            <p className="field-hint">{t("dashboard.notChargeableYet")}</p>
          )}
        </div>
      ) : (
        <form onSubmit={handleCheckout} className="checkout-form">
          <div className="field">
            <label htmlFor="coupon">{t("dashboard.couponLabel")}</label>
            <input
              id="coupon"
              type="text"
              placeholder={t("dashboard.couponPlaceholder")}
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" type="submit" disabled={checkoutLoading}>
            {checkoutLoading ? <span className="spinner" /> : t("dashboard.payAndActivate")}
          </button>
        </form>
      )}
    </section>
  );
}
