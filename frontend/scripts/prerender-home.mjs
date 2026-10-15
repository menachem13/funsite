// Post-build step: bakes a real, readable static snapshot of the homepage's
// marketing content into dist/index.html's #root, in place of the empty
// shell the client-rendered app would otherwise ship. A visitor sees real
// text/graphics the instant the HTML arrives (no blank screen while React
// loads), and a crawler that doesn't execute JS indexes real content and
// real <a href> links instead of nothing.
//
// Deliberately NOT a full SSR/hydration setup: this app's interactive bits
// (auth, saved listings, inbox polling, the Browse search form) are all
// genuinely client-only, and none of that is touched here. React still
// mounts via createRoot exactly as before and replaces this snapshot with
// the live page — this only fixes what arrives *before* that happens.
// English only, matching the <html lang="en"> this static shell is served
// under; a returning visitor's saved Yiddish preference still applies
// correctly once the client app takes over.
//
// Zero new dependencies on purpose — translations.js is plain data, safe to
// import directly in this plain Node script, no browser/SSR runtime needed.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { translations } from "../src/i18n/translations.js";
import { CATEGORIES } from "../src/constants/categories.js";

const t = (key) => {
  const value = key.split(".").reduce((obj, k) => obj?.[k], translations.en);
  if (value === undefined) throw new Error(`Missing translation key for prerender: ${key}`);
  return value;
};

const esc = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const RENTER_BENEFIT_KEYS = ["renterBenefit1", "renterBenefit2", "renterBenefit3"];
const OWNER_BENEFIT_KEYS = ["ownerBenefit1", "ownerBenefit2", "ownerBenefit3"];
const TESTIMONIAL_KEYS = ["testimonial1", "testimonial2", "testimonial3"];

function categoryCards() {
  return CATEGORIES.map(
    (cat) => `
      <a class="category-card" href="/browse?category=${encodeURIComponent(cat.value)}">
        <span class="category-icon" aria-hidden="true">${cat.icon}</span>
        <h3>${esc(t(`browse.categories.${cat.value}`))}</h3>
        <p>${esc(t(`home.categoryDescriptions.${cat.value}`))}</p>
        <span class="category-cta">${esc(t("home.categoryCardCta"))} →</span>
      </a>`
  ).join("");
}

function benefitCards(keys) {
  return keys
    .map(
      (key) => `
      <div class="bento-card">
        <h3>${esc(t(`home.${key}Title`))}</h3>
        <p>${esc(t(`home.${key}Body`))}</p>
      </div>`
    )
    .join("");
}

function testimonialCards() {
  return TESTIMONIAL_KEYS.map(
    (key) => `
      <div class="testimonial-card">
        <span class="testimonial-badge">${esc(t("home.testimonialSample"))}</span>
        <p class="testimonial-quote">&ldquo;${esc(t(`home.${key}Quote`))}&rdquo;</p>
        <p class="testimonial-role">${esc(t(`home.${key}Role`))}</p>
      </div>`
  ).join("");
}

function homeSnapshotHtml() {
  return `
<div class="home-page" data-prerendered="true">
  <section class="hero">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">${esc(t("home.eyebrow"))}</p>
        <h1>${esc(t("home.heroTitle"))}</h1>
        <p class="lede">${esc(t("home.heroLede"))}</p>
        <div class="hero-actions">
          <a href="/browse" class="btn btn-primary">${esc(t("home.heroSearchCta"))}</a>
          <a href="/register" class="btn btn-secondary">${esc(t("home.heroListCta"))}</a>
        </div>
        <p class="hero-note">${esc(t("home.heroNote"))}</p>
      </div>
    </div>
  </section>

  <section class="section" id="categories">
    <div class="container">
      <h2 class="section-title">${esc(t("home.categoriesTitle"))}</h2>
      <p class="section-subtitle">${esc(t("home.categoriesSubtitle"))}</p>
      <div class="category-grid">${categoryCards()}</div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container">
      <span class="step-kicker section-kicker">${esc(t("home.rentersSectionKicker"))}</span>
      <h2 class="section-title">${esc(t("home.rentersSectionTitle"))}</h2>
      <p class="section-subtitle">${esc(t("home.rentersSectionSubtitle"))}</p>
      <div class="bento-grid bento-grid-3">${benefitCards(RENTER_BENEFIT_KEYS)}</div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <span class="step-kicker section-kicker">${esc(t("home.ownersSectionKicker"))}</span>
      <h2 class="section-title">${esc(t("home.ownersSectionTitle"))}</h2>
      <p class="section-subtitle">${esc(t("home.ownersSectionSubtitle"))}</p>
      <div class="bento-grid bento-grid-3">${benefitCards(OWNER_BENEFIT_KEYS)}</div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container">
      <h2 class="section-title">${esc(t("home.testimonialsTitle"))}</h2>
      <p class="testimonials-note">${esc(t("home.testimonialsNote"))}</p>
      <div class="testimonial-grid">${testimonialCards()}</div>
    </div>
  </section>

  <section class="section cta-section">
    <div class="container cta-inner">
      <h2>${esc(t("home.ctaTitle"))}</h2>
      <p>${esc(t("home.ctaBody"))}</p>
      <a href="/browse" class="btn btn-primary">${esc(t("home.browseAttractions"))}</a>
    </div>
  </section>
</div>`.trim();
}

async function main() {
  const distDir = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "dist");
  const indexPath = path.join(distDir, "index.html");

  const html = await readFile(indexPath, "utf8");
  if (!html.includes('<div id="root"></div>')) {
    throw new Error('prerender-home: expected an empty <div id="root"></div> in dist/index.html to fill in — build output shape may have changed.');
  }

  const withSnapshot = html.replace('<div id="root"></div>', `<div id="root">${homeSnapshotHtml()}</div>`);
  await writeFile(indexPath, withSnapshot, "utf8");
  console.log("prerender-home: baked static homepage content into dist/index.html");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
