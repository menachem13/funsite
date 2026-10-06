import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import "./Inbox.css";

export default function Inbox() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { threadId } = useParams();
  const navigate = useNavigate();

  const [threads, setThreads] = useState(null);
  const [error, setError] = useState("");

  function loadThreads() {
    api
      .get("/threads")
      .then((d) => setThreads(d.threads))
      .catch(() => setError(t("inbox.loadError")));
  }

  useEffect(loadThreads, []);

  if (error) {
    return (
      <div className="container empty-state">
        <p role="alert">{error}</p>
      </div>
    );
  }

  if (!threads) {
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
              onUpdate={loadThreads}
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

function ThreadDetail({ threadId, currentUserId, onUpdate, listingTitle }) {
  const { t } = useLanguage();
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .get(`/threads/${threadId}`)
      .then((d) => {
        setThread(d.thread);
        setMessages(d.messages);
        // Opening a thread marks its incoming messages read server-side —
        // refresh the sidebar so its unread badge clears to match.
        onUpdate();
      })
      .catch(() => setError(t("inbox.loadThreadError")))
      .finally(() => setLoading(false));
  }, [threadId]);

  async function handleReply(e) {
    e.preventDefault();
    if (sending || !body.trim()) return;
    setSending(true);
    setError("");
    try {
      const { message } = await api.post(`/threads/${threadId}/messages`, { body: body.trim() });
      setMessages((m) => [...m, message]);
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

      <div className="message-list">
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
