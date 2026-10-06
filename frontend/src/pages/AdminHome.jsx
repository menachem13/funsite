import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import "./AdminCoupons.css";

export default function AdminHome() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/admin/summary")
      .then(setData)
      .catch(() => setError(t("adminHome.loadError")));
  }, [t]);

  if (error) {
    return (
      <div className="container empty-state">
        <p role="alert">{error}</p>
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

  const { listings, users, attentionListings } = data;

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

        {attentionListings.length === 0 ? (
          <div className="empty-state card">
            <p>{t("adminHome.attentionEmpty")}</p>
          </div>
        ) : (
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
                {attentionListings.map((l) => (
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
