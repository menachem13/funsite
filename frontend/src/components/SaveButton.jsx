import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSavedListings } from "../context/SavedListingsContext";
import { useLanguage } from "../context/LanguageContext";
import "./SaveButton.css";

// Reusable save/unsave toggle, used on both ListingCard (inside a card that
// is itself a <Link>) and ListingDetail. A logged-out visitor or an
// owner/admin viewing their own listing simply doesn't get one — saving is a
// renter action, same restriction the backend enforces.
export default function SaveButton({ listing, className = "" }) {
  const { user } = useAuth();
  const { savedIds, saveListing, unsaveListing } = useSavedListings();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);

  if (user && user.role !== "renter") return null;

  const isSaved = savedIds.has(listing.id);

  async function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate("/login", { state: { from: location } });
      return;
    }

    if (busy) return;
    setBusy(true);
    try {
      if (isSaved) await unsaveListing(listing.id);
      else await saveListing(listing);
    } catch {
      // Optimistic update already reverted itself; nothing further to do.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`save-button ${isSaved ? "saved" : ""} ${className}`}
      onClick={handleClick}
      disabled={busy}
      aria-pressed={isSaved}
      aria-label={isSaved ? t("common.saved") : t("common.save")}
      title={isSaved ? t("common.saved") : t("common.save")}
    >
      <span aria-hidden="true">{isSaved ? "♥" : "♡"}</span>
    </button>
  );
}
