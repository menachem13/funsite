// The single source of truth for Funall's attraction categories. Every
// place that needs the list of categories — the provider's listing form,
// Browse's filter, the homepage's category grid, and anywhere a listing's
// own category is displayed — imports from here instead of keeping its own
// copy. The `value` is the exact string stored in listings.category and
// used in ?category= query params; it's stable and language-neutral. The
// display label lives in translations.js under `browse.categories.<value>`,
// looked up with useLanguage()'s t(), never stored here or in the database.
export const CATEGORIES = [
  { value: "inflatable", icon: "🏰" },
  { value: "photo booth", icon: "📸" },
  { value: "carousel", icon: "🎠" },
  { value: "dunk tank", icon: "💦" },
  { value: "face painting", icon: "🎨" },
  { value: "game trailer", icon: "🎮" },
];

export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value);
