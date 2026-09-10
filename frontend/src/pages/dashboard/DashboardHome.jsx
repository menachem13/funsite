import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useLanguage } from "../../context/LanguageContext";
import "./Dashboard.css";

export default function DashboardHome() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  function load() {
    api
      .get("/owner/dashboard")
      .then(setData)
      .catch(() => setError(t("dashboard.loadError")));
  }

  useEffect(load, []);

  async function handleDelete(id, title) {
    if (!window.confirm(t("dashboard.confirmDelete", { title }))) return;
    setDeletingId(id);
    try {
      await api.del(`/listings/${id}`);
      load();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : t("dashboard.deleteError"));
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
          <h1>{t("dashboard.title")}</h1>
          <p>{t("dashboard.subtitle")}</p>
        </div>
        <Link className="btn btn-primary" to="/dashboard/new">
          {t("dashboard.newListing")}
        </Link>
      </div>

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="label">{t("dashboard.totalViews")}</div>
          <div className="value">{totals.totalViews}</div>
        </div>
        <div className="stat-tile">
          <div className="label">{t("dashboard.activeListings")}</div>
          <div className="value">{totals.activeListingCount}</div>
        </div>
        <div className="stat-tile">
          <div className="label">{t("dashboard.unreadMessages")}</div>
          <div className="value">{totals.unreadMessageCount}</div>
        </div>
        <div className="stat-tile">
          <div className="label">{t("dashboard.totalListings")}</div>
          <div className="value">{totals.listingCount}</div>
        </div>
      </div>

      {listings.length === 0 ? (
        <div className="empty-state card">
          <p>{t("dashboard.noListingsYet")}</p>
          <Link className="btn btn-primary" to="/dashboard/new">
            {t("dashboard.createFirstListing")}
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("dashboard.colListing")}</th>
                <th>{t("dashboard.colStatus")}</th>
                <th>{t("dashboard.colViews")}</th>
                <th>{t("dashboard.colMessages")}</th>
                <th>{t("dashboard.colFeatured")}</th>
                <th>{t("dashboard.colExpires")}</th>
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
                  <td>
                    <span className={`badge badge-status-${l.status}`}>{l.status}</span>
                  </td>
                  <td>{l.view_count}</td>
                  <td>
                    {l.message_count}
                    {l.unread_message_count > 0 && <span className="unread-dot" title="Unread messages" />}
                  </td>
                  <td>{l.featured_count}</td>
                  <td>{l.subscription_expires_at ? new Date(l.subscription_expires_at).toLocaleDateString() : "—"}</td>
                  <td className="row-actions">
                    <Link className="btn btn-secondary btn-sm" to={`/dashboard/${l.id}/edit`}>
                      {t("dashboard.manage")}
                    </Link>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(l.id, l.title)}
                      disabled={deletingId === l.id}
                    >
                      {t("dashboard.delete")}
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
