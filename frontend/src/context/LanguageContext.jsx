import { createContext, useContext, useEffect, useState } from "react";
import { translations, getPath } from "../i18n/translations";

const LanguageContext = createContext(null);
const STORAGE_KEY = "funall_language";
const RTL_LANGUAGES = new Set(["yi"]);

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "yi" || stored === "en" ? stored : "en";
  } catch {
    return "en";
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = RTL_LANGUAGES.has(language) ? "rtl" : "ltr";
  }, [language]);

  function setLanguage(next) {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled — language choice just won't
      // persist across reloads, which is fine, not worth surfacing an error.
    }
  }

  function t(key, vars) {
    const dict = translations[language] || translations.en;
    let value = getPath(dict, key);
    if (value === undefined) value = getPath(translations.en, key);
    if (value === undefined) return key;
    if (vars) {
      return Object.entries(vars).reduce((str, [k, v]) => str.replaceAll(`{${k}}`, v), value);
    }
    return value;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isRtl: RTL_LANGUAGES.has(language), t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
