"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/i18n/provider";
import { useAuthSession } from "@/lib/auth-session";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: "dashboard" as const },
  { href: "/jobs", label: "Job descriptions", icon: "jobs" as const },
  { href: "/cvs", label: "CV library", icon: "cvs" as const },
  { href: "/rankings", label: "Candidate review", icon: "rankings" as const },
] as const;

export function AppShell({
  children,
  activePath,
}: {
  children: ReactNode;
  activePath: string;
}) {
  const { t } = useI18n();
  const { session, signOut } = useAuthSession();
  const router = useRouter();
  const accountName = session?.user.full_name ?? "Jordan Davis";
  const accountRole = session
    ? t(
        session.user.role === "admin"
          ? "Administrator"
          : session.user.role === "viewer"
            ? "Viewer"
            : "Recruiter",
      )
    : t("Recruiter");
  const accountInitials = accountName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  function handleSignOut() {
    signOut();
    router.replace("/login");
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link
          className="brand"
          href="/dashboard"
          aria-label={t("TalentLens home")}
        >
          <span className="brand-mark">T</span>
          <span className="brand-name">
            Talent<span>Lens</span>
          </span>
        </Link>

        <div className="workspace-picker">
          <span className="workspace-avatar">T</span>
          <span className="workspace-copy">
            <strong>{t("Team workspace")}</strong>
            <small>{t("Recruiting team")}</small>
          </span>
        </div>

        <p className="nav-label">{t("WORKSPACE")}</p>
        <nav className="primary-nav" aria-label={t("Main navigation")}>
          {navigation.map((item) => {
            const isActive = activePath === item.href;
            return (
              <Link
                key={item.href}
                className={`nav-link${isActive ? " nav-link-active" : ""}`}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon name={item.icon} size={18} />
                <span>{t(item.label)}</span>
                {item.href === "/rankings" && (
                  <span className="nav-count">8</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="demo-note">
            <span className="demo-dot" />
            <span>
              <strong>{t("Demo workspace")}</strong>
              <small>{t("Synthetic sample data")}</small>
            </span>
          </div>
          <div className="profile-row">
            <span className="profile-avatar">{accountInitials}</span>
            <span className="profile-copy">
              <strong>{accountName}</strong>
              <small>{accountRole}</small>
            </span>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{t("Workspace")}</span>
            <span className="breadcrumb-separator">/</span>
            <strong>
              {t(
                navigation.find((item) => item.href === activePath)?.label ??
                  "Overview",
              )}
            </strong>
          </div>
          <div className="topbar-actions">
            <LanguageSwitcher />
            {session ? (
              <button
                className="avatar-small account-avatar-button"
                type="button"
                aria-label={t("Sign out")}
                title={t("Sign out")}
                onClick={handleSignOut}
              >
                {accountInitials}
              </button>
            ) : (
              <Link
                className="avatar-small"
                href="/login"
                aria-label={t("Account")}
              >
                JD
              </Link>
            )}
          </div>
        </header>
        <main className="page-content">{children}</main>
        <footer className="page-footer">
          <span>
            TalentLens <span className="footer-separator">·</span> AI Resume
            Screening
          </span>
          <span>{t("Human review stays in control")}</span>
        </footer>
      </div>
    </div>
  );
}
