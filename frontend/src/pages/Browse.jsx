import { useEffect, useMemo, useState } from "react";
import ListingCard from "../components/ListingCard";
import { api } from "../api/client";
import "./Browse.css";

const CATEGORIES = ["inflatable", "photo booth", "carousel", "dunk tank", "face painting", "game trailer"];

const DEFAULT_FILTERS = {
  category: "",
  location: "",
  minAge: "",
  maxAge: "",
  gender: "",
  attendantRequired: "",
  q: "",
};

export default function Browse() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [listings, setListings] = useState([]);
  const [featured, setFeatured] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Light debounce on free-text search so we're not firing a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: searchInput })), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    api.get("/listings/featured").then((d) => setFeatured(d.listing)).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "") params.set(key, value);
    });

    setLoading(true);
    setError("");
    api
      .get(`/listings?${params.toString()}`)
      .then((d) => setListings(d.listings))
      .catch(() => setError("Couldn't load listings. Try again in a moment."))
      .finally(() => setLoading(false));
  }, [filters]);

  const featuredInResults = useMemo(
    () => featured && listings.some((l) => l.id === featured.id),
    [featured, listings]
  );

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setSearchInput("");
  }

  return (
    <div className="browse-page container">
      <div className="browse-header">
        <h1>Browse attractions</h1>
        <p>Filter by category, location, and audience to find the right fit for your event.</p>
      </div>

      <div className="browse-filters card">
        <div className="field">
          <label htmlFor="q">Search</label>
          <input
            id="q"
            type="search"
            placeholder="Bounce house, photo booth…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" value={filters.category} onChange={(e) => updateFilter("category", e.target.value)}>
            <option value="">All categories</option>
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
            value={filters.location}
            onChange={(e) => updateFilter("location", e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="gender">Suitable for</label>
          <select id="gender" value={filters.gender} onChange={(e) => updateFilter("gender", e.target.value)}>
            <option value="">Any</option>
            <option value="all">All genders</option>
            <option value="male">Boys</option>
            <option value="female">Girls</option>
          </select>
        </div>

        <div className="field age-range">
          <label>Age range</label>
          <div className="age-inputs">
            <input
              type="number"
              min="0"
              placeholder="Min"
              aria-label="Minimum age"
              value={filters.minAge}
              onChange={(e) => updateFilter("minAge", e.target.value)}
            />
            <span>–</span>
            <input
              type="number"
              min="0"
              placeholder="Max"
              aria-label="Maximum age"
              value={filters.maxAge}
              onChange={(e) => updateFilter("maxAge", e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="checkbox-row" htmlFor="attendant">
            <input
              id="attendant"
              type="checkbox"
              checked={filters.attendantRequired === "true"}
              onChange={(e) => updateFilter("attendantRequired", e.target.checked ? "true" : "")}
            />
            Attendant included
          </label>
        </div>

        <button className="btn btn-ghost btn-sm reset-btn" type="button" onClick={resetFilters}>
          Reset filters
        </button>
      </div>

      {featured && !featuredInResults && (
        <div className="featured-banner card">
          <span className="badge badge-featured">Featured Today</span>
          <span>
            <strong>{featured.title}</strong> is today's featured listing — clear your filters to see it.
          </span>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="center-loading">
          <span className="spinner spinner-dark" />
        </div>
      ) : listings.length === 0 ? (
        <div className="empty-state">
          <p>No listings match those filters yet.</p>
        </div>
      ) : (
        <div className="listing-grid">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} featured={featured?.id === listing.id} />
          ))}
        </div>
      )}
    </div>
  );
}
