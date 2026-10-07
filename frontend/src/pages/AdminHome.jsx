import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import Pagination from "../components/Pagination";
import "./AdminCoupons.css";

const PAGE_SIZE = 10;

export default function AdminHome() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPage = Math.max(1, parseInt(searchParams.get("page"), 10) || 1);

  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [attention, setAttention] = useState(null);
  const [attentionError, setAttentionError] = useState("");

  useEffect(() => {
    api.get("/admin/summary").then(setSummary).catch(() => setSummaryError(t("adminHome.loadError")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAttentionError("");
    api
      .get(`/admin/attention?page=${requestedPage}&pageSize=${PAGE_SIZE}`)
      .then((d) => {
        setAttention(d);
        if (d.pagination.page !== requestedPage) {
          setSearchParams((sp) => {
            sp.set("page", String(d.pagination.page));
            return sp;
          }, { replace: true });
        }
      })
      .catch(() => setAttentionError(t("adminHome.attentionLoadError")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedPage]);

  function goToPage(page) {
    setSearchParams((sp) => {
      sp.set("page", String(page));
      return sp;
    });
  }

  if (summaryError) {
    return (
      <div className="container empty-state">
        <p role="alert">{summaryError}</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="center-loading">
        <span className="spinner spinner-dark" />
      </div>
    );
  }

  const { listings, users } = summary;

  return (
    <div className="admin-page container">
      <h1>{t("adminHome.title")}</h1>
      <p>{t("adminHome.subtitle")}</p>

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="label">{t("adminHome.activeListings")}</div>
          <div className="value">{listings.active}</div>
        </div>
        <div className="stat-tile">
          <div className="label">{t("adminHome.totalListings")}</div>
          <div className="value">{listings.total}</div>
        </div>
        <div className="stat-tile">
          <div className="label">{t("adminHome.owners")}</div>
          <div className="value">{users.owners}</div>
        </div>
        <div className="stat-tile">
          <div className="label">{t("adminHome.renters")}</div>
          <div className="value">{users.renters}</div>
        </div>
      </div>

      <section className="admin-section">
        <h2>{t("adminHome.attentionTitle")}</h2>
        <p>{t("adminHome.attentionSubtitle")}</p>

        {attentionError ? (
          <div className="alert alert-error" role="alert">
            {attentionError}
          </div>
        ) : !attention ? (
          <div className="center-loading">
            <span className="spinner spinner-dark" />
          </div>
        ) : attention.items.length === 0 ? (
          <div className="empty-state card">
            <p>{t("adminHome.attentionEmpty")}</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("adminHome.colListing")}</th>
                    <th>{t("adminHome.colOwner")}</th>
                    <th>{t("adminHome.colCompleteness")}</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {attention.items.map((l) => (
                    <tr key={l.id}>
                      <td>{l.title}</td>
                      <td>{l.ownerName}</td>
                      <td>
                        <span className="badge badge-status-inactive">
                          {t("adminHome.completenessCount", { done: l.completeness.done, total: l.completeness.total })}
                        </span>
                      </td>
                      <td className="row-actions">
                        <Link className="btn btn-secondary btn-sm" to={`/listings/${l.id}`}>
                          {t("adminHome.viewListing")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={attention.pagination.page} totalPages={attention.pagination.totalPages} onPageChange={goToPage} />
          </>
        )}
      </section>

      <section className="admin-section">
        <h2>{t("adminHome.quickActionsTitle")}</h2>
        <Link className="btn btn-primary" to="/admin/coupons">
          {t("adminHome.manageCoupons")}
        </Link>
      </section>
    </div>
  );
}
