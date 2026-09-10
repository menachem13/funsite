import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import "./AdminCoupons.css";

const EMPTY_FORM = { code: "", type: "percent", percentOff: "", amountOff: "", viewThreshold: "", usageLimit: "" };

function describeCoupon(c, t) {
  if (c.type === "percent") return `${c.percent_off}${t("adminCoupons.percentOffSuffix")}`;
  if (c.type === "fixed") return `$${(c.amount_off_cents / 100).toFixed(2)} ${t("adminCoupons.offSuffix")}`;
  return `${t("adminCoupons.freeUntilPrefix")} ${c.view_threshold} ${t("adminCoupons.freeUntilSuffix")}`;
}

export default function AdminCoupons() {
  const { t } = useLanguage();
  const [coupons, setCoupons] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);

  function load() {
    api
      .get("/admin/coupons")
      .then((d) => setCoupons(d.coupons))
      .catch(() => setError(t("adminCoupons.loadError")));
  }

  useEffect(load, []);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setCreating(true);

    const payload = {
      code: form.code.trim(),
      type: form.type,
      usageLimit: form.usageLimit === "" ? undefined : Number(form.usageLimit),
    };
    if (form.type === "percent") payload.percentOff = Number(form.percentOff);
    if (form.type === "fixed") payload.amountOffCents = Math.round(Number(form.amountOff) * 100);
    if (form.type === "views_gate") payload.viewThreshold = Number(form.viewThreshold);

    try {
      await api.post("/admin/coupons", payload);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("adminCoupons.createError"));
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(coupon) {
    setBusyId(coupon.id);
    try {
      await api.patch(`/admin/coupons/${coupon.id}`, { active: !coupon.active });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("adminCoupons.updateError"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(coupon) {
    if (!window.confirm(t("adminCoupons.confirmDelete", { code: coupon.code }))) return;
    setBusyId(coupon.id);
    try {
      await api.del(`/admin/coupons/${coupon.id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("adminCoupons.deleteError"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-page container">
      <h1>{t("adminCoupons.title")}</h1>
      <p>{t("adminCoupons.subtitle")}</p>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="card coupon-form" onSubmit={handleCreate}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="code">{t("adminCoupons.code")}</label>
            <input
              id="code"
              type="text"
              placeholder="SUMMER20"
              required
              value={form.code}
              onChange={(e) => updateField("code", e.target.value.toUpperCase())}
            />
          </div>
          <div className="field">
            <label htmlFor="type">{t("adminCoupons.type")}</label>
            <select id="type" value={form.type} onChange={(e) => updateField("type", e.target.value)}>
              <option value="percent">{t("adminCoupons.typePercent")}</option>
              <option value="fixed">{t("adminCoupons.typeFixed")}</option>
              <option value="views_gate">{t("adminCoupons.typeViewsGate")}</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          {form.type === "percent" && (
            <div className="field">
              <label htmlFor="percentOff">{t("adminCoupons.percentOff")}</label>
              <input
                id="percentOff"
                type="number"
                min="1"
                max="100"
                required
                value={form.percentOff}
                onChange={(e) => updateField("percentOff", e.target.value)}
              />
            </div>
          )}
          {form.type === "fixed" && (
            <div className="field">
              <label htmlFor="amountOff">{t("adminCoupons.dollarsOff")}</label>
              <input
                id="amountOff"
                type="number"
                min="1"
                step="0.01"
                required
                value={form.amountOff}
                onChange={(e) => updateField("amountOff", e.target.value)}
              />
            </div>
          )}
          {form.type === "views_gate" && (
            <div className="field">
              <label htmlFor="viewThreshold">{t("adminCoupons.viewThreshold")}</label>
              <input
                id="viewThreshold"
                type="number"
                min="1"
                required
                value={form.viewThreshold}
                onChange={(e) => updateField("viewThreshold", e.target.value)}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="usageLimit">{t("adminCoupons.usageLimit")}</label>
            <input
              id="usageLimit"
              type="number"
              min="1"
              placeholder={t("adminCoupons.usageLimitPlaceholder")}
              value={form.usageLimit}
              onChange={(e) => updateField("usageLimit", e.target.value)}
            />
            <p className="field-hint">{t("adminCoupons.usageLimitHint")}</p>
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={creating}>
          {creating ? <span className="spinner" /> : t("adminCoupons.createCoupon")}
        </button>
      </form>

      {!coupons ? (
        <div className="center-loading">
          <span className="spinner spinner-dark" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="empty-state">
          <p>{t("adminCoupons.noCouponsYet")}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("adminCoupons.colCode")}</th>
                <th>{t("adminCoupons.colDiscount")}</th>
                <th>{t("adminCoupons.colUsage")}</th>
                <th>{t("adminCoupons.colStatus")}</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td>
                    <code>{c.code}</code>
                  </td>
                  <td>{describeCoupon(c, t)}</td>
                  <td>
                    {c.times_used} / {c.usage_limit ?? "∞"}
                  </td>
                  <td>
                    <span className={`badge ${c.active ? "badge-status-active" : "badge-status-inactive"}`}>
                      {c.active ? t("adminCoupons.active") : t("adminCoupons.inactive")}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => toggleActive(c)}
                      disabled={busyId === c.id}
                    >
                      {c.active ? t("adminCoupons.deactivate") : t("adminCoupons.activate")}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c)} disabled={busyId === c.id}>
                      {t("adminCoupons.delete")}
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
