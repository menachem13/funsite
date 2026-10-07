import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useUnreadMessages } from "../context/UnreadMessagesContext";
import "./Inbox.css";

// How often the open conversation polls for new messages. Shorter than the
// sidebar's 20s thread-list poll (UnreadMessagesContext) since this is the
// one place the user is actively looking at — a reply should show up
// promptly without feeling like a manual-refresh app.
const THREAD_POLL_INTERVAL_MS = 6000;
// How close to the bottom (px) still counts as "at the bottom" for deciding
// whether an incoming message should auto-scroll into view.
const NEAR_BOTTOM_THRESHOLD = 80;

export default function Inbox() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { threads, loaded, refresh } = useUnreadMessages();

  useEffect(() => {
    if (!loaded) refresh();
    // Only on mount / if somehow never loaded yet — the shared context
    // already owns its own polling loop, this just covers the case of
    // landing on /inbox before that first fetch has resolved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) {
    return (
      <div className="center-loading">
        <span className="spinner spinner-dark" />
      </div>
    );
  }

  return (
    <div className="inbox-page container">
      <h1>{t("inbox.title")}</h1>
      <div className="inbox-layout">
        <aside className={`thread-list ${threadId ? "hide-on-mobile" : ""}`}>
          {threads.length === 0 ? (
            <div className="empty-state inbox-empty">
              <p>
                <strong>{t("inbox.noConversationsTitle")}</strong>
              </p>
              <p>{user.role === "owner" ? t("inbox.noConversationsBodyOwner") : t("inbox.noConversationsBodyRenter")}</p>
              {user.role === "renter" && (
                <Link className="btn btn-primary btn-sm" to="/browse">
                  {t("common.browseAttractions")}
                </Link>
              )}
            </div>
          ) : (
            <ul>
              {threads.map((th) => (
                <li key={th.id}>
                  <ThreadListItem
                    thread={th}
                    currentUserId={user.id}
                    active={String(th.id) === threadId}
                    onClick={() => navigate(`/inbox/${th.id}`)}
                  />
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className={`thread-detail ${threadId ? "" : "hide-on-mobile"}`}>
          {threadId ? (
            <ThreadDetail
              threadId={threadId}
              currentUserId={user.id}
              onUpdate={refresh}
              listingTitle={threads.find((th) => String(th.id) === threadId)?.listing_title}
            />
          ) : (
            <div className="empty-state">
              <p>{t("inbox.selectConversation")}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function counterpartName(thread, currentUserId) {
  return thread.owner_id === currentUserId ? thread.renter_name : thread.owner_name;
}

function ThreadListItem({ thread, currentUserId, active, onClick }) {
  const { t } = useLanguage();
  const counterpart = counterpartName(thread, currentUserId);

  return (
    <button className={`thread-item ${active ? "active" : ""}`} onClick={onClick} aria-current={active ? "true" : undefined}>
      <div className="thread-item-top">
        <span className="thread-title">{thread.listing_title}</span>
        {thread.unread_count > 0 && (
          <span className="unread-pill">
            {thread.unread_count}
            <span className="sr-only"> {t("inbox.unreadSuffix")}</span>
          </span>
        )}
      </div>
      {counterpart && <p className="thread-counterpart">{counterpart}</p>}
      <div className="thread-item-bottom">
        <p className="thread-preview">{thread.last_message_body || t("inbox.noMessagesYet")}</p>
        {thread.last_message_at && (
          <span className="thread-time">{new Date(thread.last_message_at).toLocaleDateString()}</span>
        )}
      </div>
    </button>
  );
}

function mergeNewMessages(existing, incoming) {
  if (incoming.length === 0) return existing;
  const existingIds = new Set(existing.map((m) => m.id));
  const toAdd = incoming.filter((m) => !existingIds.has(m.id));
  if (toAdd.length === 0) return existing;
  return [...existing, ...toAdd];
}

function ThreadDetail({ threadId, currentUserId, onUpdate, listingTitle }) {
  const { t } = useLanguage();
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const messageListRef = useRef(null);
  const lastMessageIdRef = useRef(0);
  const activeThreadIdRef = useRef(threadId);
  const shouldAutoScrollRef = useRef(false);
  const pollInFlightRef = useRef(false);

  function isNearBottom() {
    const el = messageListRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD;
  }

  function scrollToBottom() {
    const el = messageListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  // Auto-scroll runs as an effect (after the DOM has the new message
  // heights) rather than inline in the poll/send handlers, so it always
  // measures the post-update layout.
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      shouldAutoScrollRef.current = false;
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    activeThreadIdRef.current = threadId;
    setLoading(true);
    setError("");
    setMessages([]);
    lastMessageIdRef.current = 0;

    api
      .get(`/threads/${threadId}`)
      .then((d) => {
        if (activeThreadIdRef.current !== threadId) return; // user already switched threads
        setThread(d.thread);
        setMessages(d.messages);
        lastMessageIdRef.current = d.messages.reduce((max, m) => Math.max(max, m.id), 0);
        shouldAutoScrollRef.current = true;
        // Opening a thread marks its incoming messages read server-side —
        // refresh the sidebar so its unread badge clears to match.
        onUpdate();
      })
      .catch(() => {
        if (activeThreadIdRef.current === threadId) setError(t("inbox.loadThreadError"));
      })
      .finally(() => {
        if (activeThreadIdRef.current === threadId) setLoading(false);
      });
    // onUpdate/t are stable enough in practice; re-running this on every
    // identity change would refetch the whole thread for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Poll the open conversation for new messages — lighter than the sidebar
  // poll since it only asks for messages after the last one already shown.
  useEffect(() => {
    function poll() {
      if (pollInFlightRef.current || document.visibilityState !== "visible") return;
      pollInFlightRef.current = true;
      const polledThreadId = threadId;
      api
        .get(`/threads/${polledThreadId}?afterId=${lastMessageIdRef.current}`)
        .then((d) => {
          if (activeThreadIdRef.current !== polledThreadId || d.messages.length === 0) return;
          const wasNearBottom = isNearBottom();
          setMessages((prev) => mergeNewMessages(prev, d.messages));
          lastMessageIdRef.current = d.messages.reduce((max, m) => Math.max(max, m.id), lastMessageIdRef.current);
          shouldAutoScrollRef.current = wasNearBottom;
          // A new incoming message changes this thread's preview/unread
          // state for the sidebar too — nudge it rather than waiting out
          // the sidebar's own longer poll interval.
          onUpdate();
        })
        .catch(() => {
          // Transient poll failure — stay on the current messages and try
          // again next tick, same as the sidebar poll's own failure handling.
        })
        .finally(() => {
          pollInFlightRef.current = false;
        });
    }

    const timer = setInterval(poll, THREAD_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  async function handleReply(e) {
    e.preventDefault();
    if (sending || !body.trim()) return;
    setSending(true);
    setError("");
    try {
      const { message } = await api.post(`/threads/${threadId}/messages`, { body: body.trim() });
      setMessages((m) => mergeNewMessages(m, [message]));
      lastMessageIdRef.current = Math.max(lastMessageIdRef.current, message.id);
      shouldAutoScrollRef.current = true;
      setBody("");
      onUpdate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("inbox.sendError"));
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(e) {
    // Enter sends; Shift+Enter inserts a newline, as in most chat UIs.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleReply(e);
    }
  }

  if (loading) {
    return (
      <div className="center-loading">
        <span className="spinner spinner-dark" />
      </div>
    );
  }

  if (!thread) return <p className="empty-state" role="alert">{error}</p>;

  const counterpart = counterpartName(thread, currentUserId);

  return (
    <div className="thread-panel">
      <div className="thread-panel-header">
        <Link to="/inbox" className="back-link show-on-mobile">
          {t("inbox.allMessages")}
        </Link>
        <Link to={`/listings/${thread.listing_id}`} className="thread-panel-listing">
          {listingTitle || `${t("inbox.listingPrefix")}${thread.listing_id}`}
        </Link>
        {counterpart && <p className="thread-panel-counterpart">{t("inbox.conversationWith", { name: counterpart })}</p>}
      </div>

      <div className="message-list" ref={messageListRef}>
        {messages.map((m) => (
          <div key={m.id} className={`message-bubble ${m.sender_id === currentUserId ? "mine" : "theirs"}`}>
            <p>{m.body}</p>
            <span className="message-time">{new Date(m.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <form className="reply-form" onSubmit={handleReply}>
        <label htmlFor="reply-body" className="sr-only">
          {t("inbox.replyLabel")}
        </label>
        <textarea
          id="reply-body"
          rows={1}
          placeholder={t("inbox.replyPlaceholder")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleComposerKeyDown}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={sending || !body.trim()}>
          {sending ? <span className="spinner" /> : t("inbox.send")}
        </button>
      </form>
    </div>
  );
}
