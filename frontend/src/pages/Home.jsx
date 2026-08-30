import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Home.css";

export default function Home() {
  const { user } = useAuth();
  const ownerCta = user?.role === "owner" ? "/dashboard" : "/register";

  return (
    <div className="home-page">
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Now booking in your area</p>
            <h1>Rent the fun stuff, straight from the people who own it.</h1>
            <p className="lede">
              Bounce houses, photo booths, carousels, and more — browse local attractions, message
              owners directly, and book your event. No commission, no bidding wars, no middleman
              markup.
            </p>
            <div className="hero-actions">
              <Link to="/browse" className="btn btn-primary">
                Browse attractions
              </Link>
              <Link to={ownerCta} className="btn btn-secondary">
                {user?.role === "owner" ? "Go to your dashboard" : "List your attraction"}
              </Link>
            </div>
            <p className="hero-note">Free for renters. Owners list for a flat $100 / 6 months — no commission, ever.</p>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="listing-card demo-card">
              <div className="listing-card-media">
                <span className="badge badge-featured">Featured Today</span>
                <div className="media-placeholder" />
              </div>
              <div className="listing-card-body">
                <div className="listing-card-top">
                  <h3>Rainbow Castle Bounce House</h3>
                  <span className="live-view">
                    <span className="live-dot" aria-hidden="true" />
                    <span className="count">27</span> viewing
                  </span>
                </div>
                <p className="listing-card-meta">Inflatable · Brooklyn, NY · Ages 3–12</p>
                <div className="tag-row">
                  <span className="tag">All genders</span>
                  <span className="tag">Attendant included</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="logos-strip">
        <div className="container">
          <p>Built for the attractions renters actually search for</p>
          <div className="chip-row">
            {["Inflatables", "Photo booths", "Carousels", "Dunk tanks", "Face painting", "Game trailers"].map(
              (c) => (
                <span className="chip" key={c}>
                  {c}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="container">
          <h2>How Funsite works</h2>
          <div className="two-col">
            <div className="how-card">
              <span className="step-kicker">For renters</span>
              <ol className="step-list">
                <li>
                  <strong>Search &amp; filter.</strong> By category, location, age range, and whether an
                  attendant is included.
                </li>
                <li>
                  <strong>Message the owner.</strong> Ask questions and check availability, directly in
                  the app.
                </li>
                <li>
                  <strong>Book with confidence.</strong> See real view counts and audience details
                  before you commit.
                </li>
              </ol>
            </div>
            <div className="how-card">
              <span className="step-kicker">For owners</span>
              <ol className="step-list">
                <li>
                  <strong>List once, flat fee.</strong> $100 every 6 months — no commission on what you
                  charge.
                </li>
                <li>
                  <strong>Get a fair shot at Featured.</strong> Every paid listing rotates in, based on
                  who's waited longest — not who spent the most.
                </li>
                <li>
                  <strong>See it working.</strong> Real-time views, message counts, and featured
                  history in your dashboard.
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <h2>Everything you need, nothing you don't</h2>
          <div className="bento-grid">
            <div className="bento-card bento-large">
              <h3>Live interest, not guesswork</h3>
              <p>Every listing shows a real-time view count with a pulsing live indicator — owners see demand as it happens.</p>
              <div className="mini-demo">
                <span className="live-view">
                  <span className="live-dot" aria-hidden="true" />
                  <span className="count">142</span> views this week
                </span>
              </div>
            </div>
            <div className="bento-card">
              <h3>Audience filters</h3>
              <p>Age range, gender suitability, and attendant requirements — set once per listing, filterable by every renter.</p>
            </div>
            <div className="bento-card">
              <h3>Fair featured rotation</h3>
              <p>Featured Today goes to whoever's waited longest — never who paid the most. Same flat fee, same shot.</p>
            </div>
            <div className="bento-card">
              <h3>Direct messaging</h3>
              <p>No forms, no phone tag. Renters message owners straight from a listing and get a real inbox.</p>
            </div>
            <div className="bento-card">
              <h3>Owner analytics</h3>
              <p>A 14-day view breakdown, message counts, and featured history for every listing you run.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section pricing-section" id="pricing">
        <div className="container pricing-inner">
          <div className="pricing-copy">
            <h2>Simple pricing. No surprises.</h2>
            <p>Renters always browse and message for free. Owners pay one flat listing fee — that's it.</p>
          </div>
          <div className="price-card">
            <p className="price-amount">
              $100 <span>/ 6 months</span>
            </p>
            <ul className="price-features">
              <li>Unlimited photos &amp; video per listing</li>
              <li>0% commission on what you charge renters</li>
              <li>Full owner analytics dashboard</li>
              <li>Equal shot at the Featured Today rotation</li>
            </ul>
            <Link to={ownerCta} className="btn btn-primary btn-block">
              {user?.role === "owner" ? "Go to your dashboard" : "Join as an owner"}
            </Link>
          </div>
        </div>
      </section>

      <section className="section cta-section">
        <div className="container cta-inner">
          <h2>Ready to see what's available near you?</h2>
          <p>Browse live listings now — no account needed until you're ready to message an owner.</p>
          <Link to="/browse" className="btn btn-primary">
            Browse attractions
          </Link>
        </div>
      </section>
    </div>
  );
}
