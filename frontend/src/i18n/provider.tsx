"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { translate, type TranslationKey } from "./messages";

const LANGUAGE_STORAGE_KEY = "talentlens-language";
const LANGUAGE_CHANGE_EVENT = "talentlens-language-change";

type Language = "en" | "vi";
type TranslationValues = Record<string, string | number>;
let inMemoryLanguage: Language = "en";

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, values?: TranslationValues) => string;
};

const englishFallback: I18nContextValue = {
  language: "en",
  setLanguage: () => undefined,
  t: (key, values) => translate("en", key, values),
};

const I18nContext = createContext<I18nContextValue>(englishFallback);

function getStoredLanguage(): Language {
  try {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    inMemoryLanguage = storedLanguage === "vi" ? "vi" : "en";
    return inMemoryLanguage;
  } catch {
    return inMemoryLanguage;
  }
}

function subscribeToLanguage(callback: () => void) {
  window.addEventListener(LANGUAGE_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore<Language>(
    subscribeToLanguage,
    getStoredLanguage,
    () => "en",
  );
  const setLanguage = useCallback((nextLanguage: Language) => {
    inMemoryLanguage = nextLanguage;
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // Switching still works in this tab when browser storage is unavailable.
    }
    window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback(
    (key: TranslationKey, values?: TranslationValues) =>
      translate(language, key, values),
    [language],
  );
  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
