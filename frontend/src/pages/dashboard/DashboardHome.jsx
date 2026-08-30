import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import "./Dashboard.css";

function statusBadge(status) {
  return <span className={`badge badge-status-${status}`}>{status}</span>;
}

export default function DashboardHome() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  function load() {
    api
      .get("/owner/dashboard")
      .then(setData)
      .catch(() => setError("Couldn't load your dashboard. Try refreshing."));
  }

  useEffect(load, []);

  async function handleDelete(id, title) {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    setDeletingId(id);
    try {
      await api.del(`/listings/${id}`);
      load();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Couldn't delete that listing.");
    } finally {
      setDeletingId(null);
    }
  }

  if (error) {
    return (
      <div className="container empty-state">
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="center-loading">
        <span className="spinner spinner-dark" />
      </div>
    );
  }

  const { listings, totals } = data;

  return (
    <div className="dashboard-page container">
      <div className="dashboard-header">
        <div>
          <h1>Your dashboard</h1>
          <p>Track views, messages, and manage your listings.</p>
        </div>
        <Link className="btn btn-primary" to="/dashboard/new">
          + New listing
        </Link>
      </div>

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="label">Total views</div>
          <div className="value">{totals.totalViews}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Active listings</div>
          <div className="value">{totals.activeListingCount}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Unread messages</div>
          <div className="value">{totals.unreadMessageCount}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Total listings</div>
          <div className="value">{totals.listingCount}</div>
        </div>
      </div>

      {listings.length === 0 ? (
        <div className="empty-state card">
          <p>You haven't created a listing yet.</p>
          <Link className="btn btn-primary" to="/dashboard/new">
            Create your first listing
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Listing</th>
                <th>Status</th>
                <th>Views</th>
                <th>Messages</th>
                <th>Featured</th>
                <th>Expires</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link to={`/dashboard/${l.id}/edit`} className="listing-name-link">
                      {l.title}
                    </Link>
                  </td>
                  <td>{statusBadge(l.status)}</td>
                  <td>{l.view_count}</td>
                  <td>
                    {l.message_count}
                    {l.unread_message_count > 0 && <span className="unread-dot" title="Unread messages" />}
                  </td>
                  <td>{l.featured_count}</td>
                  <td>{l.subscription_expires_at ? new Date(l.subscription_expires_at).toLocaleDateString() : "—"}</td>
                  <td className="row-actions">
                    <Link className="btn btn-secondary btn-sm" to={`/dashboard/${l.id}/edit`}>
                      Manage
                    </Link>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(l.id, l.title)}
                      disabled={deletingId === l.id}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
