import { useLanguage } from "../context/LanguageContext";
import "./ToastViewport.css";

export default function ToastViewport({ toasts, onDismiss }) {
  const { t } = useLanguage();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-viewport">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === "error" ? "alert" : "status"}>
          <p className="toast-message">{toast.message}</p>
          <button type="button" className="toast-close" onClick={() => onDismiss(toast.id)} aria-label={t("toast.dismiss")}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
