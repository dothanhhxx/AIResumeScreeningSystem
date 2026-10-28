"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/i18n/provider";

export function AuthLayout({
  mode,
  children,
}: {
  mode: "login" | "register";
  children: ReactNode;
}) {
  const { t } = useI18n();
  const eyebrow = mode === "login" ? "WELCOME BACK" : "GET STARTED";
  const title =
    mode === "login"
      ? "Sign in to your workspace"
      : "Create your workspace account";
  const description =
    mode === "login"
      ? "Enter your details to continue to your team dashboard."
      : "Set up your profile to collaborate on thoughtful hiring.";

  return (
    <main className="login-page">
      <LanguageSwitcher variant="auth" />
      <section className="login-visual">
        <Link
          className="brand login-brand"
          href="/dashboard"
          aria-label={t("TalentLens home")}
        >
          <span className="brand-mark">T</span>
          <span className="brand-name">
            Talent<span>Lens</span>
          </span>
        </Link>
        <div className="login-visual-content">
          <span className="login-kicker">
            <span /> {t("PEOPLE-FIRST HIRING")}
          </span>
          <h1>
            {t("Find the right people.")}
            <br />
            <span>{t("Keep people")}</span> {t("in control.")}
          </h1>
          <p>
            {t(
              "One thoughtful workspace to organize resumes, understand matches, and make confident decisions together.",
            )}
          </p>
          <div className="login-quote">
            <span className="quote-mark">“</span>
            <p>
              {t(
                "Great hiring starts with seeing the person behind the profile.",
              )}
            </p>
            <span className="quote-author">{t("TALENTLENS PRINCIPLE")}</span>
          </div>
        </div>
        <span className="login-visual-footer">
          {t("AI-assisted. Human-decided.")}
        </span>
      </section>
      <section className="login-content">
        <div className="login-card">
          <Link className="login-mobile-brand" href="/dashboard">
            <span className="brand-mark">T</span>
            <span className="brand-name">
              Talent<span>Lens</span>
            </span>
          </Link>
          <p className="eyebrow">{t(eyebrow)}</p>
          <h2>{t(title)}</h2>
          <p className="login-subtitle">{t(description)}</p>
          {children}
        </div>
        <footer className="login-footer">
          <span>© 2026 TalentLens</span>
          <span>{t("Privacy · Support")}</span>
        </footer>
      </section>
    </main>
  );
}
