import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./Inbox.css";

export default function Inbox() {
  const { user } = useAuth();
  const { threadId } = useParams();
  const navigate = useNavigate();

  const [threads, setThreads] = useState(null);
  const [error, setError] = useState("");

  function loadThreads() {
    api
      .get("/threads")
      .then((d) => setThreads(d.threads))
      .catch(() => setError("Couldn't load your messages."));
  }

  useEffect(loadThreads, []);

  if (error) {
    return (
      <div className="container empty-state">
        <p>{error}</p>
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
      <h1>Messages</h1>
      <div className="inbox-layout">
        <aside className={`thread-list ${threadId ? "hide-on-mobile" : ""}`}>
          {threads.length === 0 ? (
            <div className="empty-state">
              <p>No conversations yet.</p>
            </div>
          ) : (
            <ul>
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    className={`thread-item ${String(t.id) === threadId ? "active" : ""}`}
                    onClick={() => navigate(`/inbox/${t.id}`)}
                  >
                    <div className="thread-item-top">
                      <span className="thread-title">{t.listing_title}</span>
                      {t.unread_count > 0 && <span className="unread-pill">{t.unread_count}</span>}
                    </div>
                    <p className="thread-preview">{t.last_message_body || "No messages yet"}</p>
                  </button>
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
              listingTitle={threads.find((t) => String(t.id) === threadId)?.listing_title}
            />
          ) : (
            <div className="empty-state">
              <p>Select a conversation to view it.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ThreadDetail({ threadId, currentUserId, onUpdate, listingTitle }) {
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
      .catch(() => setError("Couldn't load this conversation."))
      .finally(() => setLoading(false));
  }, [threadId]);

  async function handleReply(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError("");
    try {
      const { message } = await api.post(`/threads/${threadId}/messages`, { body: body.trim() });
      setMessages((m) => [...m, message]);
      setBody("");
      onUpdate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send that message.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="center-loading">
        <span className="spinner spinner-dark" />
      </div>
    );
  }

  if (!thread) return <div className="empty-state">{error}</div>;

  return (
    <div className="thread-panel">
      <div className="thread-panel-header">
        <Link to="/inbox" className="back-link show-on-mobile">
          ← All messages
        </Link>
        <Link to={`/listings/${thread.listing_id}`}>
          <strong>{listingTitle || `Listing #${thread.listing_id}`}</strong>
        </Link>
      </div>

      <div className="message-list">
        {messages.map((m) => (
          <div key={m.id} className={`message-bubble ${m.sender_id === currentUserId ? "mine" : "theirs"}`}>
            <p>{m.body}</p>
            <span className="message-time">{new Date(m.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="reply-form" onSubmit={handleReply}>
        <input
          type="text"
          placeholder="Type a reply…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label="Reply"
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={sending}>
          {sending ? <span className="spinner" /> : "Send"}
        </button>
      </form>
    </div>
  );
}
