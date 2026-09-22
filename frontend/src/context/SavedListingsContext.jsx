import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

const SavedListingsContext = createContext(null);

// Holds full listing objects (not just ids) so both the heart icon
// everywhere AND the Saved Attractions page read from the same live list —
// saving/unsaving updates both instantly, with no page reload or extra
// fetch. The server (saved_listings table) is the source of truth; this is
// just an in-memory mirror of it for the current session, refetched on
// login/logout so switching accounts never shows the previous user's saves.
export function SavedListingsProvider({ children }) {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (user?.role !== "renter") {
      setListings([]);
      setLoaded(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setError(false);
    api
      .get("/saved-listings")
      .then((d) => {
        if (!cancelled) setListings(d.listings || []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  const savedIds = useMemo(() => new Set(listings.map((l) => l.id)), [listings]);

  const saveListing = useCallback(async (listing) => {
    setListings((prev) => (prev.some((l) => l.id === listing.id) ? prev : [{ ...listing, saved_at: new Date().toISOString() }, ...prev]));
    try {
      await api.post("/saved-listings", { listingId: listing.id });
    } catch (err) {
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
      throw err;
    }
  }, []);

  const unsaveListing = useCallback(async (listingId) => {
    let removed;
    setListings((prev) => {
      removed = prev.find((l) => l.id === listingId);
      return prev.filter((l) => l.id !== listingId);
    });
    try {
      await api.del(`/saved-listings/${listingId}`);
    } catch (err) {
      if (removed) setListings((prev) => (prev.some((l) => l.id === listingId) ? prev : [removed, ...prev]));
      throw err;
    }
  }, []);

  const value = useMemo(
    () => ({ listings, savedIds, loaded, error, saveListing, unsaveListing }),
    [listings, savedIds, loaded, error, saveListing, unsaveListing]
  );

  return <SavedListingsContext.Provider value={value}>{children}</SavedListingsContext.Provider>;
}

export function useSavedListings() {
  const ctx = useContext(SavedListingsContext);
  if (!ctx) throw new Error("useSavedListings must be used within SavedListingsProvider");
  return ctx;
}
