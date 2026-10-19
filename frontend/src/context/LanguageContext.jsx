import { createContext, useContext, useMemo } from "react";
import { translations, getPath } from "../i18n/translations";

const LanguageContext = createContext(null);

// English-only now, but kept as a context (rather than a plain imported
// function) so every call site's `const { t } = useLanguage();` keeps
// working unchanged.
export function LanguageProvider({ children }) {
  const value = useMemo(() => {
    function t(key, vars) {
      const value = getPath(translations.en, key);
      if (value === undefined) return key;
      if (vars) {
        return Object.entries(vars).reduce((str, [k, v]) => str.replaceAll(`{${k}}`, v), value);
      }
      return value;
    }
    return { t };
  }, []);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
