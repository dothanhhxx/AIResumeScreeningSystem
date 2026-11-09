"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { BrandLogo, BrandMark } from "@/components/ui/brand-logo";
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
    mode === "login" ? "Sign in to your workspace" : "Workspace access";
  const description =
    mode === "login"
      ? "Enter your details to continue to your team dashboard."
      : "Accounts are issued by your workspace administrator.";

  return (
    <main className="login-page">
      <LanguageSwitcher variant="auth" />
      <section className="login-visual">
        <Link
          className="brand login-brand"
          href="/"
          aria-label={t("TalentLens home")}
        >
          <BrandLogo
            variant="dark"
            size="lg"
            showTagline
            tagline={t("From resume noise to explainable hiring clarity.")}
          />
        </Link>
        <div className="login-visual-content">
          <h1>
            {t("Find the right people.")}
            <br />
            <span>{t("Keep people")}</span> {t("in control.")}
          </h1>
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
      </section>
      <section className="login-content">
        <div className="login-card">
          <Link className="login-mobile-brand" href="/">
            <BrandLogo
              variant="light"
              size="md"
              showTagline
              tagline={t("From resume noise to explainable hiring clarity.")}
            />
          </Link>
          <p className="eyebrow">{t(eyebrow)}</p>
          <h2>{t(title)}</h2>
          <p className="login-subtitle">{t(description)}</p>
          {children}
          {mode === "login" && (
            <Link
              className="button button-secondary login-demo-cta"
              href="/demo"
            >
              {t("Explore the read-only demo")}
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
        <footer className="login-footer">
          <span className="login-footer-brand">
            <BrandMark size={18} variant="light" />
            <span>{t("© 2026 TalentLens")}</span>
          </span>
          <span className="login-footer-links">
            <Link href="/">{t("Home page")}</Link>
            <span>·</span>
            <Link href="/demo">{t("Demo")}</Link>
            <span>·</span>
            <span>{t("Privacy · Support")}</span>
          </span>
        </footer>
      </section>
    </main>
  );
}
