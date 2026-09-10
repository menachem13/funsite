import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import Reveal from "../components/Reveal";
import ConfettiBurst from "../components/ConfettiBurst";
import Fireworks from "../components/Fireworks";
import { useCountUp } from "../hooks/useCountUp";
import "./Home.css";

const CATEGORY_KEYS = ["inflatables", "photoBooths", "carousels", "dunkTanks", "facePainting", "gameTrailers"];
const FAQ_KEYS = ["faq1", "faq2", "faq3", "faq4", "faq5", "faq6"];
const TESTIMONIAL_KEYS = ["testimonial1", "testimonial2", "testimonial3"];

export default function Home() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const ownerCta = user?.role === "owner" ? "/dashboard" : "/register";
  const heroRef = useRef(null);
  const showStickyCta = useScrolledPast(heroRef);

  const categories = CATEGORY_KEYS.map((key) => t(`home.categories.${key}`));

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
            <div className="hero-actions">
              <Link to="/browse" className="btn btn-primary">
                {t("home.browseAttractions")}
              </Link>
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

      <Reveal as="section" className="logos-strip">
        <div className="container">
          <p>{t("home.logosStripLabel")}</p>
        </div>
        <div className="marquee">
          <div className="marquee-track">
            {[...categories, ...categories].map((c, i) => (
              <span className="chip" key={`${c}-${i}`}>
                {c}
              </span>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="section trust-section">
        <div className="container">
          <p className="eyebrow trust-eyebrow">{t("home.trustEyebrow")}</p>
          <div className="trust-grid">
            <div className="trust-tile">
              <p className="trust-number">1,200+*</p>
              <p className="trust-label">{t("home.trustListingViews")}</p>
            </div>
            <div className="trust-tile">
              <p className="trust-number">300+*</p>
              <p className="trust-label">{t("home.trustMessagesSent")}</p>
            </div>
            <div className="trust-tile">
              <p className="trust-number">98%*</p>
              <p className="trust-label">{t("home.trustResponseRate")}</p>
            </div>
          </div>
          <p className="trust-footnote">{t("home.trustFootnote")}</p>
        </div>
      </Reveal>

      <section className="section section-alt">
        <div className="container">
          <Reveal as="h2" className="section-title">
            {t("home.benefitsTitle")}
          </Reveal>
          <div className="bento-grid">
            <Reveal as="div" className="bento-card bento-large">
              <h3>{t("home.benefit1Title")}</h3>
              <p>{t("home.benefit1Body")}</p>
              <LiveStatDemo />
            </Reveal>
            <Reveal className="bento-card" delay={80}>
              <h3>{t("home.benefit2Title")}</h3>
              <p>{t("home.benefit2Body")}</p>
            </Reveal>
            <Reveal className="bento-card" delay={160}>
              <h3>{t("home.benefit3Title")}</h3>
              <p>{t("home.benefit3Body")}</p>
            </Reveal>
            <Reveal className="bento-card" delay={80}>
              <h3>{t("home.benefit4Title")}</h3>
              <p>{t("home.benefit4Body")}</p>
            </Reveal>
            <Reveal className="bento-card" delay={160}>
              <h3>{t("home.benefit5Title")}</h3>
              <p>{t("home.benefit5Body")}</p>
            </Reveal>
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

      <Reveal as="section" className="section pricing-section" id="pricing">
        <div className="container pricing-inner">
          <div className="pricing-copy">
            <h2>{t("home.pricingTitle")}</h2>
            <p>{t("home.pricingLede")}</p>
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

function LiveStatDemo() {
  const { t } = useLanguage();
  const [ref, value] = useCountUp(142);
  return (
    <div className="mini-demo" ref={ref}>
      <span className="live-view">
        <span className="live-dot" aria-hidden="true" />
        <span className="count">{value}</span> {t("home.liveStatSuffix")}
      </span>
    </div>
  );
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
