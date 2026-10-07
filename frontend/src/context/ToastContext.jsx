import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import ToastViewport from "../components/ToastViewport";

const ToastContext = createContext(null);

let nextId = 1;

// Errors need to stay until the user dismisses them (or a generous timeout)
// since they usually mean something needs attention; success/info/warning
// are transient confirmations that shouldn't pile up if left alone.
const DEFAULT_DURATIONS = { success: 3500, info: 4000, warning: 5500, error: 9000 };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    ({ type = "info", message, duration }) => {
      if (!message) return;
      const id = nextId++;
      setToasts((prev) => [...prev, { id, type, message }]);
      const effectiveDuration = duration ?? DEFAULT_DURATIONS[type] ?? DEFAULT_DURATIONS.info;
      if (effectiveDuration > 0) {
        const timer = setTimeout(() => dismiss(id), effectiveDuration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      show: (opts) => showToast(opts),
      success: (message, opts) => showToast({ ...opts, type: "success", message }),
      error: (message, opts) => showToast({ ...opts, type: "error", message }),
      info: (message, opts) => showToast({ ...opts, type: "info", message }),
      warning: (message, opts) => showToast({ ...opts, type: "warning", message }),
    }),
    [showToast]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}
