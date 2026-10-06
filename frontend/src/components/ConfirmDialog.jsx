import { useEffect, useId, useRef } from "react";
import { useLanguage } from "../context/LanguageContext";
import "./ConfirmDialog.css";

/**
 * Generic accessible confirmation dialog, built on the native <dialog>
 * element — showModal() gives focus-trapping, a real backdrop, and
 * Escape-to-close for free, without pulling in a UI library for this one
 * thing. Reusable for any destructive action (delete listing, remove
 * media, future ones) rather than a separate dialog per call site.
 */
export default function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel, danger = true, onConfirm, onCancel }) {
  const { t } = useLanguage();
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      triggerRef.current = document.activeElement;
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function handleCancel(e) {
      // Fired by the browser on Escape — route through the same cancel
      // handler as the Cancel button instead of just letting it close.
      e.preventDefault();
      onCancel();
    }
    function handleClose() {
      // Native <dialog> already returns focus to the trigger in most
      // browsers, but doing it explicitly keeps this reliable everywhere
      // and survives the trigger having moved within the same DOM node.
      if (triggerRef.current && document.contains(triggerRef.current)) {
        triggerRef.current.focus();
      }
    }
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);
    };
  }, [onCancel]);

  function handleDialogClick(e) {
    // A click that lands on the <dialog> element itself (not a descendant)
    // is a click on the ::backdrop — native <dialog> has no other way to
    // distinguish the two.
    if (e.target === dialogRef.current) onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      onClick={handleDialogClick}
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <h2 id={titleId}>{title}</h2>
      <p id={descId}>{description}</p>
      <div className="confirm-dialog-actions">
        {/* Cancel gets default focus — a stray Enter press shouldn't be
            able to confirm a destructive action. */}
        <button type="button" className="btn btn-secondary" onClick={onCancel} autoFocus>
          {cancelLabel || t("common.cancel")}
        </button>
        <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
