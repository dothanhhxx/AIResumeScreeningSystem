"use client";

import styles from "./language-switcher.module.css";
import { useI18n } from "@/i18n/provider";

export function LanguageSwitcher({
  variant = "default",
}: {
  variant?: "default" | "auth";
}) {
  const { language, setLanguage, t } = useI18n();
  const nextLanguage = language === "en" ? "vi" : "en";
  const targetLanguage = t(nextLanguage === "vi" ? "Vietnamese" : "English");

  return (
    <button
      className={`${styles.switcher} ${variant === "auth" ? styles.auth : ""}`}
      type="button"
      aria-label={t("Switch display language to {{language}}", {
        language: targetLanguage,
      })}
      title={t("Switch display language to {{language}}", {
        language: targetLanguage,
      })}
      onClick={() => setLanguage(nextLanguage)}
    >
      <span className={language === "vi" ? styles.active : undefined}>VI</span>
      <span aria-hidden="true">/</span>
      <span className={language === "en" ? styles.active : undefined}>EN</span>
    </button>
  );
}
