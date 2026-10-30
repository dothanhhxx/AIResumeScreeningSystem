"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { session, signOut } = useAuthSession();
  const pathname = usePathname();
  const router = useRouter();
  const activePath = pathname ?? "";
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const accountName = session?.user.full_name ?? t("Demo recruiter");
  const accountRole = session
    ? t(
        session.user.role === "admin"
          ? "Administrator"
          : session.user.role === "viewer"
            ? "Viewer"
            : "Recruiter",
      )
    : t("Preview account");
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

  const closeMobileNav = useCallback(() => {
    setIsMobileNavOpen(false);
    if (window.matchMedia("(max-width: 760px)").matches) {
      mobileMenuButtonRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileCloseButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMobileNav();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements =
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
      if (!focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMobileNav, isMobileNavOpen]);

  if (!navigation.some((item) => item.href === activePath)) {
    return children;
  }

  return (
    <div
      className={`app-frame${isSidebarCollapsed ? " app-frame--sidebar-collapsed" : ""}${isMobileNavOpen ? " app-frame--mobile-nav-open" : ""}`}
    >
      <aside
        ref={sidebarRef}
        className="sidebar"
        id="primary-sidebar"
        aria-label={t("Main navigation")}
        role={isMobileNavOpen ? "dialog" : undefined}
        aria-modal={isMobileNavOpen || undefined}
      >
        <div className="sidebar-header">
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
          <button
            ref={mobileCloseButtonRef}
            className="sidebar-mobile-close"
            type="button"
            aria-label={t("Close navigation")}
            onClick={closeMobileNav}
          >
            <Icon name="close" size={19} />
          </button>
        </div>
        <button
          className="sidebar-toggle sidebar-toggle-desktop"
          type="button"
          aria-label={
            isSidebarCollapsed ? t("Expand sidebar") : t("Collapse sidebar")
          }
          aria-controls="primary-sidebar"
          aria-expanded={!isSidebarCollapsed}
          title={
            isSidebarCollapsed ? t("Expand sidebar") : t("Collapse sidebar")
          }
          onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
        >
          <Icon
            name={isSidebarCollapsed ? "chevron-right" : "chevron-left"}
            size={16}
          />
        </button>
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
                aria-label={t(item.label)}
                title={isSidebarCollapsed ? t(item.label) : undefined}
                onClick={closeMobileNav}
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
      {isMobileNavOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label={t("Close navigation")}
          tabIndex={-1}
          onClick={closeMobileNav}
        />
      )}

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-leading">
            <button
              ref={mobileMenuButtonRef}
              className="sidebar-toggle sidebar-toggle-mobile"
              type="button"
              aria-label={t("Open navigation")}
              aria-controls="primary-sidebar"
              aria-expanded={isMobileNavOpen}
              title={t("Open navigation")}
              onClick={() => setIsMobileNavOpen(true)}
            >
              <Icon name="menu" size={19} />
            </button>
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
                {accountInitials}
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
