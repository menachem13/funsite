import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import Reveal from "../components/Reveal";
import ConfettiBurst from "../components/ConfettiBurst";
import Fireworks from "../components/Fireworks";
import ListingCard from "../components/ListingCard";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { todayInputValue } from "../utils/date";
import "./Home.css";

const FAQ_KEYS = ["faq1", "faq2", "faq3", "faq4", "faq5", "faq6", "faq7", "faq8", "faq9"];
const TESTIMONIAL_KEYS = ["testimonial1", "testimonial2", "testimonial3"];
const BENEFIT_KEYS = ["benefit1", "benefit2", "benefit3", "benefit4"];
const PLANNING_OPTIONS = [
  { icon: "⛺", value: "camp", labelKey: "camp" },
  { icon: "🏫", value: "school", labelKey: "school" },
  { icon: "🎉", value: "community", labelKey: "event" },
  { icon: "✨", value: "other", labelKey: "other" },
];
const GROUP_SIZE_BUCKETS = [
  { key: "upTo50", groupSize: "" },
  { key: "size50to100", groupSize: "50" },
  { key: "size100to250", groupSize: "100" },
  { key: "size250to500", groupSize: "250" },
  { key: "size500plus", groupSize: "500" },
];

// (icon, backend category value) pairs — the value is what /browse?category=
// actually filters on, so these must stay in sync with Browse.jsx/ListingForm.jsx.
const CATEGORY_CARDS = [
  { icon: "🏰", value: "inflatable" },
  { icon: "📸", value: "photo booth" },
  { icon: "🎠", value: "carousel" },
  { icon: "💦", value: "dunk tank" },
  { icon: "🎨", value: "face painting" },
  { icon: "🎮", value: "game trailer" },
];

export default function Home() {
  const { user } = useAuth();
  const { t } = useLanguage();
  useDocumentTitle(t("home.heroTitle"));
  const ownerCta = user?.role === "owner" ? "/dashboard" : "/register";
  const heroRef = useRef(null);
  const showStickyCta = useScrolledPast(heroRef);

  return (
    <div className="home-page">
      <section className="hero" ref={heroRef}>
        <div className="hero-bg" aria-hidden="true">
          <span className="blob blob-1" />
          <span className="blob blob-2" />
          <span className="blob blob-3" />
          <Fireworks />
          <ConfettiBurst />
        </div>

        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">{t("home.eyebrow")}</p>
            <h1>{t("home.heroTitle")}</h1>
            <p className="lede">{t("home.heroLede")}</p>

            <FindAttractionPanel />

            <div className="hero-actions">
              <Link to={ownerCta} className="btn btn-secondary">
                {user?.role === "owner" ? t("home.goToDashboard") : t("home.listAttraction")}
              </Link>
            </div>
            <p className="hero-note">{t("home.heroNote")}</p>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="listing-card demo-card hero-card">
              <div className="listing-card-media">
                <span className="badge badge-featured">{t("home.featuredToday")}</span>
                <div className="media-placeholder" />
              </div>
              <div className="listing-card-body">
                <div className="listing-card-top">
                  <h3>{t("home.demoCardTitle")}</h3>
                  <span className="live-view">
                    <span className="live-dot" aria-hidden="true" />
                    <span className="count">27</span> {t("home.demoCardViewing")}
                  </span>
                </div>
                <p className="listing-card-meta">{t("home.demoCardMeta")}</p>
                <div className="tag-row">
                  <span className="tag">{t("home.allGenders")}</span>
                  <span className="tag">{t("home.attendantIncluded")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="categories">
        <div className="container">
          <Reveal as="h2" className="section-title">
            {t("home.categoriesTitle")}
          </Reveal>
          <p className="section-subtitle">{t("home.categoriesSubtitle")}</p>
          <div className="category-grid">
            {CATEGORY_CARDS.map((cat, i) => (
              <Reveal
                as={Link}
                to={`/browse?category=${encodeURIComponent(cat.value)}`}
                className="category-card"
                delay={(i % 3) * 80}
                key={cat.value}
              >
                <span className="category-icon" aria-hidden="true">
                  {cat.icon}
                </span>
                <h3>{t(`browse.categories.${cat.value}`)}</h3>
                <p>{t(`home.categoryDescriptions.${cat.value}`)}</p>
                <span className="category-cta">{t("home.categoryCardCta")} →</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <RecentListings />

      <section className="section section-alt">
        <div className="container">
          <Reveal as="h2" className="section-title">
            {t("home.benefitsTitle")}
          </Reveal>
          <p className="section-subtitle">{t("home.benefitsSubtitle")}</p>
          <div className="bento-grid">
            {BENEFIT_KEYS.map((key, i) => (
              <Reveal className="bento-card" delay={(i % 3) * 80} key={key}>
                <h3>{t(`home.${key}Title`)}</h3>
                <p>{t(`home.${key}Body`)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="container">
          <Reveal as="h2" className="section-title">
            {t("home.howItWorksTitle")}
          </Reveal>
          <div className="two-col">
            <Reveal className="how-card">
              <span className="step-kicker">{t("home.forRenters")}</span>
              <ol className="step-list">
                <li>
                  <strong>{t("home.renterStep1Strong")}</strong> {t("home.renterStep1")}
                </li>
                <li>
                  <strong>{t("home.renterStep2Strong")}</strong> {t("home.renterStep2")}
                </li>
                <li>
                  <strong>{t("home.renterStep3Strong")}</strong> {t("home.renterStep3")}
                </li>
              </ol>
            </Reveal>
            <Reveal className="how-card" delay={120}>
              <span className="step-kicker">{t("home.forOwners")}</span>
              <ol className="step-list">
                <li>
                  <strong>{t("home.ownerStep1Strong")}</strong> {t("home.ownerStep1")}
                </li>
                <li>
                  <strong>{t("home.ownerStep2Strong")}</strong> {t("home.ownerStep2")}
                </li>
                <li>
                  <strong>{t("home.ownerStep3Strong")}</strong> {t("home.ownerStep3")}
                </li>
              </ol>
            </Reveal>
          </div>
        </div>
      </section>

      <Reveal as="section" className="section pricing-section" id="for-providers">
        <div className="container pricing-inner">
          <div className="pricing-copy">
            <span className="step-kicker">{t("home.providerEyebrow")}</span>
            <h2>{t("home.providerTitle")}</h2>
            <p>{t("home.providerSubtitle")}</p>
            <ul className="provider-benefit-list">
              <li>
                <strong>{t("home.providerBenefit1Title")}</strong> {t("home.providerBenefit1Body")}
              </li>
              <li>
                <strong>{t("home.providerBenefit2Title")}</strong> {t("home.providerBenefit2Body")}
              </li>
              <li>
                <strong>{t("home.providerBenefit3Title")}</strong> {t("home.providerBenefit3Body")}
              </li>
              <li>
                <strong>{t("home.providerBenefit4Title")}</strong> {t("home.providerBenefit4Body")}
              </li>
              <li>
                <strong>{t("home.providerBenefit5Title")}</strong> {t("home.providerBenefit5Body")}
              </li>
            </ul>
          </div>
          <div className="price-card">
            <p className="price-amount">
              {t("home.priceAmount")} <span>{t("home.pricePeriod")}</span>
            </p>
            <ul className="price-features">
              <li>{t("home.priceFeature1")}</li>
              <li>{t("home.priceFeature2")}</li>
              <li>{t("home.priceFeature3")}</li>
              <li>{t("home.priceFeature4")}</li>
            </ul>
            <Link to={ownerCta} className="btn btn-primary btn-block">
              {user?.role === "owner" ? t("home.goToDashboard") : t("home.joinAsOwner")}
            </Link>
          </div>
        </div>
      </Reveal>

      <section className="section section-alt">
        <div className="container">
          <Reveal as="h2" className="section-title">
            {t("home.testimonialsTitle")}
          </Reveal>
          <p className="testimonials-note">{t("home.testimonialsNote")}</p>
          <div className="testimonial-grid">
            {TESTIMONIAL_KEYS.map((key, i) => (
              <Reveal as="div" className="testimonial-card" delay={i * 80} key={key}>
                <span className="testimonial-badge">{t("home.testimonialSample")}</span>
                <p className="testimonial-quote">&ldquo;{t(`home.${key}Quote`)}&rdquo;</p>
                <p className="testimonial-role">{t(`home.${key}Role`)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="container">
          <Reveal as="h2" className="section-title">
            {t("home.faqTitle")}
          </Reveal>
          <div className="faq-list">
            {FAQ_KEYS.map((key, i) => (
              <FaqItem key={key} question={t(`home.${key}Q`)} answer={t(`home.${key}A`)} defaultOpen={i === 0} />
            ))}
          </div>
        </div>
      </section>

      <Reveal as="section" className="section cta-section">
        <div className="container cta-inner">
          <h2>{t("home.ctaTitle")}</h2>
          <p>{t("home.ctaBody")}</p>
          <Link to="/browse" className="btn btn-primary">
            {t("home.browseAttractions")}
          </Link>
        </div>
      </Reveal>

      {showStickyCta && (
        <div className="mobile-sticky-cta">
          <Link to="/browse" className="btn btn-primary btn-block">
            {t("home.browseAttractions")}
          </Link>
        </div>
      )}
    </div>
  );
}

function FindAttractionPanel() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [eventType, setEventType] = useState("");
  const [groupSizeBucket, setGroupSizeBucket] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (eventType) params.set("eventType", eventType);
    const bucket = GROUP_SIZE_BUCKETS.find((b) => b.key === groupSizeBucket);
    if (bucket?.groupSize) params.set("groupSize", bucket.groupSize);
    if (category) params.set("category", category);
    if (location.trim()) params.set("location", location.trim());
    if (eventDate) params.set("eventDate", eventDate);
    const qs = params.toString();
    navigate(`/browse${qs ? `?${qs}` : ""}`);
  }

  return (
    <form className="find-panel" onSubmit={handleSubmit}>
      <div className="find-panel-row">
        <span className="find-panel-label">{t("home.findPanel.eventTypeLabel")}</span>
        <div className="pill-group" role="group" aria-label={t("home.findPanel.eventTypeLabel")}>
          {PLANNING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`pill ${eventType === opt.value ? "pill-active" : ""}`}
              aria-pressed={eventType === opt.value}
              onClick={() => setEventType((v) => (v === opt.value ? "" : opt.value))}
            >
              <span aria-hidden="true">{opt.icon}</span> {t(`home.planning.${opt.labelKey}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="find-panel-row">
        <span className="find-panel-label">{t("home.findPanel.groupSizeLabel")}</span>
        <div className="pill-group" role="group" aria-label={t("home.findPanel.groupSizeLabel")}>
          {GROUP_SIZE_BUCKETS.map((b) => (
            <button
              key={b.key}
              type="button"
              className={`pill ${groupSizeBucket === b.key ? "pill-active" : ""}`}
              aria-pressed={groupSizeBucket === b.key}
              onClick={() => setGroupSizeBucket((v) => (v === b.key ? "" : b.key))}
            >
              {t(`home.groupSizeBuckets.${b.key}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="find-panel-row find-panel-selects">
        <div className="find-panel-select">
          <label htmlFor="find-category">{t("home.findPanel.categoryLabel")}</label>
          <select id="find-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t("browse.allCategories")}</option>
            {CATEGORY_CARDS.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {t(`browse.categories.${cat.value}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="find-panel-select">
          <label htmlFor="find-location">{t("home.findPanel.locationLabel")}</label>
          <input
            id="find-location"
            type="text"
            placeholder={t("browse.locationPlaceholder")}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
      </div>

      <div className="find-panel-row">
        <div className="find-panel-select">
          <label htmlFor="find-date">{t("home.findPanel.eventDateLabel")}</label>
          <input
            id="find-date"
            type="date"
            min={todayInputValue()}
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
          <p className="field-hint">{t("home.findPanel.eventDateHint")}</p>
        </div>
      </div>

      <button className="btn btn-primary btn-block find-panel-submit" type="submit">
        {t("home.findPanel.submit")}
      </button>
    </form>
  );
}

function RecentListings() {
  const { t } = useLanguage();
  const [listings, setListings] = useState(null);

  useEffect(() => {
    api
      .get("/listings")
      .then((d) => setListings(d.listings.slice(0, 6)))
      .catch(() => setListings([]));
  }, []);

  return (
    <section className="section section-alt" id="recent-listings">
      <div className="container">
        <Reveal as="h2" className="section-title">
          {t("home.recentTitle")}
        </Reveal>
        <p className="section-subtitle">{t("home.recentSubtitle")}</p>

        {listings === null ? (
          <div className="center-loading">
            <span className="spinner spinner-dark" />
          </div>
        ) : listings.length === 0 ? (
          <div className="empty-state card">
            <p>
              <strong>{t("home.recentEmptyTitle")}</strong>
            </p>
            <p>{t("home.recentEmptyBody")}</p>
            <Link to="/register" className="btn btn-primary">
              {t("home.listAttraction")}
            </Link>
          </div>
        ) : (
          <>
            <div className="recent-grid">
              {listings.map((listing, i) => (
                <Reveal as="div" delay={(i % 3) * 80} key={listing.id}>
                  <ListingCard listing={listing} cover={listing.cover} />
                </Reveal>
              ))}
            </div>
            <div className="recent-view-all">
              <Link to="/browse" className="btn btn-secondary">
                {t("home.recentViewAll")}
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function useScrolledPast(ref) {
  const [scrolledPast, setScrolledPast] = useState(false);

  useEffect(() => {
    function onScroll() {
      if (!ref.current) return;
      setScrolledPast(ref.current.getBoundingClientRect().bottom < 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [ref]);

  return scrolledPast;
}

function FaqItem({ question, answer, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`faq-item ${open ? "faq-open" : ""}`}>
      <button className="faq-question" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {question}
        <span className="faq-icon" aria-hidden="true" />
      </button>
      {open && <p className="faq-answer">{answer}</p>}
    </div>
  );
}
