import { useEffect } from "react";

const SITE_NAME = "Funall";

/** Sets the browser tab title for the current page, e.g. "Browse attractions — Funall". */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
  }, [title]);
}
