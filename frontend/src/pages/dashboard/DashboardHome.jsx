import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { listingCompletenessCount } from "../../utils/listingCompleteness";
import ConfirmDialog from "../../components/ConfirmDialog";
import Pagination from "../../components/Pagination";
import "./Dashboard.css";

const PAGE_SIZE = 20;

export default function DashboardHome() {
  const { t } = useLanguage();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPage = Math.max(1, parseInt(searchParams.get("page"), 10) || 1);

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  function load() {
    api
      .get(`/owner/dashboard?page=${requestedPage}&pageSize=${PAGE_SIZE}`)
      .then((d) => {
        setData(d);
        // The backend clamps an out-of-range page (e.g. a bookmark from
        // when there were more listings) to the nearest valid one — reflect
        // that back into the URL so Previous/Next and a refresh agree.
        if (d.pagination.page !== requestedPage) {
          setSearchParams((sp) => {
            sp.set("page", String(d.pagination.page));
            return sp;
          }, { replace: true });
        }
      })
      .catch(() => setError(t("dashboard.loadError")));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [requestedPage]);

  function goToPage(page) {
    setSearchParams((sp) => {
      sp.set("page", String(page));
      return sp;
    });
  }

  async function confirmDelete() {
    const { id, title } = pendingDelete;
    setPendingDelete(null);
    setDeletingId(id);
    setActionError("");
    try {
      await api.del(`/listings/${id}`);
      toast.success(t("dashboard.listingDeletedToast", { title }));
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("dashboard.deleteError"));
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

  const { listings, totals, pagination } = data;
  const showGettingStarted = totals.listingCount > 0 && totals.totalActivity === 0;

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

      {actionError && (
        <div className="alert alert-error" role="alert">
          {actionError}
        </div>
      )}

      {showGettingStarted && (
        <div className="card getting-started-panel">
          <p className="getting-started-eyebrow">{t("dashboard.gettingStartedEyebrow")}</p>
          {totals.incompleteListing ? (
            <>
              <h2>{t("dashboard.gettingStartedIncompleteTitle")}</h2>
              <p>{t("dashboard.gettingStartedIncompleteBody")}</p>
              <Link className="btn btn-primary btn-sm" to={`/dashboard/${totals.incompleteListing.id}/edit`}>
                {t("dashboard.gettingStartedIncompleteCta", { title: totals.incompleteListing.title })}
              </Link>
            </>
          ) : (
            <>
              <h2>{t("dashboard.gettingStartedReadyTitle")}</h2>
              <p>{t("dashboard.gettingStartedReadyBody")}</p>
            </>
          )}
        </div>
      )}

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
          <p>
            <strong>{t("dashboard.noListingsTitle")}</strong>
          </p>
          <p>{t("dashboard.noListingsYet")}</p>
          <Link className="btn btn-primary" to="/dashboard/new">
            {t("dashboard.createFirstListing")}
          </Link>
        </div>
      ) : (
        <>
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
                  <th>{t("dashboard.colCompleteness")}</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => {
                  const { done, total } = listingCompletenessCount(l);
                  return (
                    <tr key={l.id}>
                      <td>
                        <Link to={`/dashboard/${l.id}/edit`} className="listing-name-link">
                          {l.title}
                        </Link>
                      </td>
                      <td>
                        <span className={`badge badge-status-${l.status}`}>{l.status}</span>
                        {l.status !== "active" && (
                          <p className="field-hint status-hint">
                            {l.status === "expired" ? t("dashboard.statusHintExpired") : t("dashboard.statusHintInactive")}
                          </p>
                        )}
                      </td>
                      <td>{l.view_count}</td>
                      <td>
                        {l.message_count}
                        {l.unread_message_count > 0 && (
                          <>
                            <span className="unread-dot" aria-hidden="true" />
                            <Link to="/inbox" className="field-hint status-hint unread-hint">
                              {t("dashboard.unreadHint", { count: l.unread_message_count })}
                            </Link>
                          </>
                        )}
                      </td>
                      <td>{l.featured_count}</td>
                      <td>{l.subscription_expires_at ? new Date(l.subscription_expires_at).toLocaleDateString() : "—"}</td>
                      <td>
                        <Link
                          to={`/dashboard/${l.id}/edit`}
                          className={`badge ${done === total ? "badge-status-active" : "badge-status-inactive"}`}
                          title={t("dashboard.completenessCount", { done, total })}
                        >
                          {done}/{total}
                        </Link>
                      </td>
                      <td className="row-actions">
                        <Link className="btn btn-secondary btn-sm" to={`/dashboard/${l.id}/edit`}>
                          {t("dashboard.manage")}
                        </Link>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setPendingDelete({ id: l.id, title: l.title })}
                          disabled={deletingId === l.id}
                        >
                          {t("dashboard.delete")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={goToPage} />
        </>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={t("dashboard.deleteListingTitle")}
        description={pendingDelete ? t("dashboard.confirmDelete", { title: pendingDelete.title }) : ""}
        confirmLabel={t("dashboard.delete")}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
