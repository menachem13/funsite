import { useLanguage } from "../context/LanguageContext";
import "./Pagination.css";

/**
 * Reusable Previous/Next pager. Deliberately not a full page-number strip —
 * Prev/Next plus "page X of Y" covers every list in this app (dashboard,
 * admin attention) without needing to handle large page-count ellipsis
 * layouts that don't apply at this data scale.
 */
export default function Pagination({ page, totalPages, onPageChange, disabled = false }) {
  const { t } = useLanguage();

  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label={t("pagination.navLabel")}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || page <= 1}
      >
        {t("pagination.previous")}
      </button>
      <span className="pagination-status" aria-live="polite">
        {t("pagination.pageOf", { page, totalPages })}
      </span>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || page >= totalPages}
      >
        {t("pagination.next")}
      </button>
    </nav>
  );
}
