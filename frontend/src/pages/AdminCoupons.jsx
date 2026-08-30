import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import "./AdminCoupons.css";

const EMPTY_FORM = { code: "", type: "percent", percentOff: "", amountOff: "", viewThreshold: "", usageLimit: "" };

function describeCoupon(c) {
  if (c.type === "percent") return `${c.percent_off}% off`;
  if (c.type === "fixed") return `$${(c.amount_off_cents / 100).toFixed(2)} off`;
  return `Free until ${c.view_threshold} views`;
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);

  function load() {
    api
      .get("/admin/coupons")
      .then((d) => setCoupons(d.coupons))
      .catch(() => setError("Couldn't load coupons."));
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
      setError(err instanceof ApiError ? err.message : "Couldn't create that coupon.");
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
      setError(err instanceof ApiError ? err.message : "Couldn't update that coupon.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(coupon) {
    if (!window.confirm(`Delete coupon "${coupon.code}"?`)) return;
    setBusyId(coupon.id);
    try {
      await api.del(`/admin/coupons/${coupon.id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that coupon.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-page container">
      <h1>Coupons</h1>
      <p>Create discount or free-trial codes owners can redeem at checkout.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="card coupon-form" onSubmit={handleCreate}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="code">Code</label>
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
            <label htmlFor="type">Type</label>
            <select id="type" value={form.type} onChange={(e) => updateField("type", e.target.value)}>
              <option value="percent">Percentage off</option>
              <option value="fixed">Fixed dollar amount off</option>
              <option value="views_gate">Free until N views</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          {form.type === "percent" && (
            <div className="field">
              <label htmlFor="percentOff">Percent off</label>
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
              <label htmlFor="amountOff">Dollars off</label>
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
              <label htmlFor="viewThreshold">View threshold</label>
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
            <label htmlFor="usageLimit">Usage limit</label>
            <input
              id="usageLimit"
              type="number"
              min="1"
              placeholder="Unlimited"
              value={form.usageLimit}
              onChange={(e) => updateField("usageLimit", e.target.value)}
            />
            <p className="field-hint">Leave blank for unlimited uses.</p>
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={creating}>
          {creating ? <span className="spinner" /> : "Create coupon"}
        </button>
      </form>

      {!coupons ? (
        <div className="center-loading">
          <span className="spinner spinner-dark" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="empty-state">
          <p>No coupons yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Usage</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td>
                    <code>{c.code}</code>
                  </td>
                  <td>{describeCoupon(c)}</td>
                  <td>
                    {c.times_used} / {c.usage_limit ?? "∞"}
                  </td>
                  <td>
                    <span className={`badge ${c.active ? "badge-status-active" : "badge-status-inactive"}`}>
                      {c.active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => toggleActive(c)}
                      disabled={busyId === c.id}
                    >
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c)} disabled={busyId === c.id}>
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
