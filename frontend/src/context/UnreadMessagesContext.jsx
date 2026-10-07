import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

const UnreadMessagesContext = createContext(null);

// How often to refresh the thread list in the background. Short enough that
// "automatic updates" actually feels automatic, long enough that it's not a
// meaningful load on a small marketplace's API.
const POLL_INTERVAL_MS = 20000;

// Single shared source for "what are my conversations and how many are
// unread" — reused by the Inbox thread list, the Navbar badge, and (via its
// own totals) the owner dashboard, instead of each maintaining its own copy
// that can drift out of sync with the others. Only owners and renters have
// an Inbox at all; admins simply never poll.
export function UnreadMessagesProvider({ children }) {
  const { user } = useAuth();
  const hasInbox = user?.role === "owner" || user?.role === "renter";

  const [threads, setThreads] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const inFlightRef = useRef(false);
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const d = await api.get("/threads");
      setThreads(d.threads);
      setLoaded(true);
    } catch {
      // Transient failure (network blip, momentary 5xx) — keep whatever
      // threads/unread count we already have rather than blanking the
      // Inbox or the badge; the next interval tick tries again on its own.
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!hasInbox) {
      setThreads([]);
      setLoaded(false);
      return;
    }

    refresh();

    function tick() {
      if (document.visibilityState === "visible") refresh();
    }
    timerRef.current = setInterval(tick, POLL_INTERVAL_MS);

    // Catch up immediately when the tab becomes visible again, instead of
    // waiting out whatever's left of the current interval — a background
    // tab the user just switched back to should look current right away.
    function handleVisibility() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // Re-arm the whole loop on login/logout/role change (user?.id covers a
    // different account logging in on the same tab); refresh is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInbox, user?.id]);

  const unreadCount = useMemo(() => threads.reduce((sum, t) => sum + (t.unread_count || 0), 0), [threads]);

  const value = useMemo(() => ({ threads, unreadCount, loaded, refresh }), [threads, unreadCount, loaded, refresh]);

  return <UnreadMessagesContext.Provider value={value}>{children}</UnreadMessagesContext.Provider>;
}

export function useUnreadMessages() {
  const ctx = useContext(UnreadMessagesContext);
  if (!ctx) throw new Error("useUnreadMessages must be used within UnreadMessagesProvider");
  return ctx;
}
