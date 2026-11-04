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
import { BrandLogo, BrandMark } from "@/components/brand-logo";
import { Icon } from "@/components/icon";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/i18n/provider";
import { getAuthAccessToken, useAuthSession } from "@/lib/auth-session";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: "dashboard" as const },
  { href: "/jobs", label: "Job descriptions", icon: "jobs" as const },
  { href: "/cvs", label: "CV library", icon: "cvs" as const },
  { href: "/rankings", label: "Candidate review", icon: "rankings" as const },
  { href: "/history", label: "Screening history", icon: "history" as const },
  { href: "/analytics", label: "Analytics", icon: "analytics" as const },
  {
    href: "/audit",
    label: "Audit log",
    icon: "shield" as const,
    adminOnly: true,
  },
  {
    href: "/users",
    label: "User management",
    icon: "users" as const,
    adminOnly: true,
  },
  { href: "/settings", label: "Settings", icon: "settings" as const },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { session, signOut } = useAuthSession();
  const pathname = usePathname();
  const router = useRouter();
  const activePath = pathname ?? "";
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const accountName = session?.user.full_name;
  const accountRole = session
    ? t(
        session.user.role === "admin"
          ? "Administrator"
          : session.user.role === "viewer"
            ? "Viewer"
            : "Recruiter",
      )
    : null;
  const accountInitials =
    accountName
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() ?? "";

  function handleSignOut() {
    setIsAccountMenuOpen(false);
    signOut();
    router.replace("/login");
  }

  const isAppRoute = navigation.some((item) => item.href === activePath);

  // Workspace pages need a signed-in user; the token lives in sessionStorage.
  useEffect(() => {
    if (isAppRoute && !getAuthAccessToken()) {
      router.replace(`/login?next=${encodeURIComponent(activePath)}`);
    }
  }, [activePath, isAppRoute, router, session]);

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

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsAccountMenuOpen(false);
      accountTriggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  if (!isAppRoute) {
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
            href="/"
            aria-label={t("TalentLens home")}
          >
            <BrandLogo
              variant="dark"
              size="md"
              markOnly={isSidebarCollapsed}
            />
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
          <span className="workspace-avatar">
            <BrandMark size={20} variant="dark" />
          </span>
          <span className="workspace-copy">
            <strong>{t("Team workspace")}</strong>
            <small>{t("Recruiting team")}</small>
          </span>
        </div>

        <p className="nav-label">{t("WORKSPACE")}</p>
        <nav className="primary-nav" aria-label={t("Main navigation")}>
          {navigation
            .filter(
              (item) =>
                !("adminOnly" in item) || session?.user.role === "admin",
            )
            .map((item) => {
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
                </Link>
              );
            })}
        </nav>

        {session && accountName && accountRole && (
          <div className="sidebar-bottom">
            <div className="profile-row">
              <span className="profile-avatar">{accountInitials}</span>
              <span className="profile-copy">
                <strong>{accountName}</strong>
                <small>{accountRole}</small>
              </span>
            </div>
          </div>
        )}
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
              <Link
                href="/"
                className="topbar-brand-pill"
                aria-label={t("TalentLens home")}
              >
                <BrandMark size={20} variant="light" />
                <span>TalentLens</span>
              </Link>
              <span className="breadcrumb-separator">/</span>
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
            <Link href="/demo" className="topbar-quick-link">
              <Icon name="sparkle" size={14} />
              <span>{t("Demo")}</span>
            </Link>
            <LanguageSwitcher />
            {session ? (
              <div className="account-menu-wrap" ref={accountMenuRef}>
                <button
                  ref={accountTriggerRef}
                  className="avatar-small account-avatar-button"
                  type="button"
                  aria-label={t("Account")}
                  aria-expanded={isAccountMenuOpen}
                  aria-controls={
                    isAccountMenuOpen ? "account-menu-panel" : undefined
                  }
                  title={t("Account")}
                  onClick={() => setIsAccountMenuOpen((isOpen) => !isOpen)}
                >
                  {accountInitials}
                </button>
                {isAccountMenuOpen && accountName && accountRole ? (
                  <section
                    className="account-menu-panel"
                    id="account-menu-panel"
                    aria-label={t("Account")}
                  >
                    <p className="account-menu-label">{t("Account")}</p>
                    <div className="account-menu-profile">
                      <span className="account-menu-avatar" aria-hidden="true">
                        {accountInitials}
                      </span>
                      <span className="account-menu-copy">
                        <strong>{accountName}</strong>
                        <small>{accountRole}</small>
                      </span>
                    </div>
                    <div className="account-menu-divider" />
                    <button
                      className="account-menu-signout"
                      type="button"
                      onClick={handleSignOut}
                    >
                      {t("Sign out")}
                    </button>
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        </header>
        <main className="page-content" key={activePath}>
          {children}
        </main>
        <footer className="page-footer">
          <div className="page-footer-brand">
            <Link href="/" aria-label={t("TalentLens home")}>
              <BrandLogo
                variant="light"
                size="sm"
                showTagline
                tagline={t(
                  "From resume noise to explainable hiring clarity.",
                )}
              />
            </Link>
          </div>
          <div className="page-footer-links">
            <Link href="/">{t("Home page")}</Link>
            <span className="footer-separator">·</span>
            <Link href="/demo">{t("Demo")}</Link>
            <span className="footer-separator">·</span>
            <Link href="/rankings">{t("Candidate review")}</Link>
            <span className="footer-separator">·</span>
            <Link href="/settings">{t("Settings")}</Link>
          </div>
          <div className="page-footer-meta">
            <span>{t("Human review stays in control")}</span>
            <span className="footer-separator">·</span>
            <span>{t("© 2026 TalentLens")}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
