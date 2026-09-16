import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ListingCard from "../components/ListingCard";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { todayInputValue } from "../utils/date";
import "./Browse.css";

const CATEGORIES = ["inflatable", "photo booth", "carousel", "dunk tank", "face painting", "game trailer"];
const EVENT_TYPES = ["camp", "school", "community", "family", "large", "other"];

const DEFAULT_FILTERS = {
  category: "",
  location: "",
  minAge: "",
  maxAge: "",
  gender: "",
  attendantRequired: "",
  q: "",
  eventType: "",
  groupSize: "",
  eventDate: "",
  sort: "newest",
};

export default function Browse() {
  const { t } = useLanguage();
  useDocumentTitle(t("browse.title"));
  // Seeded from the URL on first render so links like /browse?category=carousel
  // (the homepage category cards) or /browse?q=... (the hero search) actually
  // land with that filter applied, not just a URL that looks right.
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    category: searchParams.get("category") || "",
    q: searchParams.get("q") || "",
    eventType: searchParams.get("eventType") || "",
    location: searchParams.get("location") || "",
    groupSize: searchParams.get("groupSize") || "",
    eventDate: searchParams.get("eventDate") || "",
    sort: searchParams.get("sort") || "newest",
  }));
  // Open "more filters" by default if a link (e.g. the homepage find-an-attraction
  // panel) arrived with one of those filters already set, so the visitor can see
  // why the results are narrowed instead of it looking like a hidden filter.
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(() => !!searchParams.get("groupSize"));
  const [searchInput, setSearchInput] = useState(() => searchParams.get("q") || "");
  const [listings, setListings] = useState([]);
  const [featured, setFeatured] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Light debounce on free-text search so we're not firing a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => ({ ...f, q: searchInput })), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    api.get("/listings/featured").then((d) => setFeatured(d.listing)).catch(() => {});
  }, []);

  useEffect(() => {
    // eventDate is discovery/contact context for the customer's message, not
    // a listing filter — there's no provider availability data to filter on,
    // so it's deliberately left out of the search request.
    const { eventDate: _eventDate, ...filterParams } = filters;
    const params = new URLSearchParams();
    Object.entries(filterParams).forEach(([key, value]) => {
      if (value !== "") params.set(key, value);
    });

    setLoading(true);
    setError("");
    api
      .get(`/listings?${params.toString()}`)
      .then((d) => setListings(d.listings))
      .catch(() => setError(t("browse.loadError")))
      .finally(() => setLoading(false));
  }, [filters, t]);

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
        <h1>{t("browse.title")}</h1>
        <p>{t("browse.subtitle")}</p>
      </div>

      <div className="browse-filters card">
        <div className="field">
          <label htmlFor="q">{t("browse.search")}</label>
          <input
            id="q"
            type="search"
            placeholder={t("browse.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="category">{t("browse.category")}</label>
          <select id="category" value={filters.category} onChange={(e) => updateFilter("category", e.target.value)}>
            <option value="">{t("browse.allCategories")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`browse.categories.${c}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="eventType">{t("browse.eventType")}</label>
          <select id="eventType" value={filters.eventType} onChange={(e) => updateFilter("eventType", e.target.value)}>
            <option value="">{t("browse.anyEventType")}</option>
            {EVENT_TYPES.map((v) => (
              <option key={v} value={v}>
                {t(`eventTypes.${v}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="location">{t("browse.location")}</label>
          <input
            id="location"
            type="text"
            placeholder={t("browse.locationPlaceholder")}
            value={filters.location}
            onChange={(e) => updateFilter("location", e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="eventDate">{t("browse.eventDateLabel")}</label>
          <input
            id="eventDate"
            type="date"
            min={todayInputValue()}
            value={filters.eventDate}
            onChange={(e) => updateFilter("eventDate", e.target.value)}
          />
          <p className="field-hint">{t("browse.eventDateHint")}</p>
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm more-filters-toggle"
          onClick={() => setMoreFiltersOpen((v) => !v)}
          aria-expanded={moreFiltersOpen}
        >
          {moreFiltersOpen ? t("browse.fewerFilters") : t("browse.moreFilters")}
        </button>

        {moreFiltersOpen && (
          <>
            <div className="field">
              <label htmlFor="groupSize">{t("browse.groupSize")}</label>
              <input
                id="groupSize"
                type="number"
                min="1"
                placeholder={t("browse.groupSizePlaceholder")}
                value={filters.groupSize}
                onChange={(e) => updateFilter("groupSize", e.target.value)}
              />
              <p className="field-hint">{t("browse.groupSizeHint")}</p>
            </div>

            <div className="field">
              <label htmlFor="gender">{t("browse.suitableFor")}</label>
              <select id="gender" value={filters.gender} onChange={(e) => updateFilter("gender", e.target.value)}>
                <option value="">{t("browse.any")}</option>
                <option value="all">{t("browse.allGenders")}</option>
                <option value="male">{t("browse.boys")}</option>
                <option value="female">{t("browse.girls")}</option>
              </select>
            </div>

            <div className="field age-range">
              <label>{t("browse.ageRange")}</label>
              <div className="age-inputs">
                <input
                  type="number"
                  min="0"
                  placeholder={t("browse.min")}
                  aria-label={t("browse.min")}
                  value={filters.minAge}
                  onChange={(e) => updateFilter("minAge", e.target.value)}
                />
                <span>–</span>
                <input
                  type="number"
                  min="0"
                  placeholder={t("browse.max")}
                  aria-label={t("browse.max")}
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
                {t("browse.attendantIncluded")}
              </label>
            </div>
          </>
        )}

        <button className="btn btn-ghost btn-sm reset-btn" type="button" onClick={resetFilters}>
          {t("browse.resetFilters")}
        </button>
      </div>

      {featured && !featuredInResults && (
        <div className="featured-banner card">
          <span className="badge badge-featured">{t("browse.featuredToday")}</span>
          <span>
            <strong>{featured.title}</strong> {t("browse.featuredBannerSuffix")}
          </span>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && listings.length > 0 && (
        <div className="browse-results-header">
          <span className="results-count">{t("browse.resultsCount", { count: listings.length })}</span>
          <div className="field sort-field">
            <label htmlFor="sort">{t("browse.sortLabel")}</label>
            <select id="sort" value={filters.sort} onChange={(e) => updateFilter("sort", e.target.value)}>
              <option value="newest">{t("browse.sortNewest")}</option>
              <option value="popular">{t("browse.sortPopular")}</option>
              <option value="az">{t("browse.sortAZ")}</option>
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="center-loading">
          <span className="spinner spinner-dark" />
        </div>
      ) : listings.length === 0 ? (
        <div className="empty-state card">
          <p>
            <strong>{t("browse.noResultsTitle")}</strong>
          </p>
          <p>{t("browse.noResults")}</p>
          <button className="btn btn-primary" type="button" onClick={resetFilters}>
            {t("browse.browseAll")}
          </button>
        </div>
      ) : (
        <div className="listing-grid">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              cover={listing.cover}
              featured={featured?.id === listing.id}
              discoveryContext={{
                eventType: filters.eventType,
                groupSize: filters.groupSize,
                location: filters.location,
                eventDate: filters.eventDate,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
