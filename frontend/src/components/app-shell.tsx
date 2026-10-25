import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icon";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: "dashboard" as const },
  { href: "/jobs", label: "Job descriptions", icon: "jobs" as const },
  { href: "/cvs", label: "CV library", icon: "cvs" as const },
  { href: "/rankings", label: "Candidate review", icon: "rankings" as const },
];

export function AppShell({
  children,
  activePath,
}: {
  children: ReactNode;
  activePath: string;
}) {
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard" aria-label="Talent Desk home">
          <span className="brand-mark">t</span>
          <span className="brand-name">
            talent<span>desk</span>
          </span>
        </Link>

        <div className="workspace-picker">
          <span className="workspace-avatar">T</span>
          <span className="workspace-copy">
            <strong>Team workspace</strong>
            <small>Recruiting team</small>
          </span>
          <span className="workspace-chevron">⌄</span>
        </div>

        <p className="nav-label">WORKSPACE</p>
        <nav className="primary-nav" aria-label="Main navigation">
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
                <span>{item.label}</span>
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
              <strong>Demo workspace</strong>
              <small>Synthetic sample data</small>
            </span>
          </div>
          <div className="profile-row">
            <span className="profile-avatar">JD</span>
            <span className="profile-copy">
              <strong>Jordan Davis</strong>
              <small>Recruiter</small>
            </span>
            <span className="profile-menu">···</span>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <strong>
              {navigation.find((item) => item.href === activePath)?.label ??
                "Overview"}
            </strong>
          </div>
          <div className="topbar-actions">
            <div className="search-box">
              <Icon name="search" size={17} />
              <span>Search anything</span>
              <kbd>⌘ K</kbd>
            </div>
            <Link className="avatar-small" href="/login" aria-label="Account">
              JD
            </Link>
          </div>
        </header>
        <main className="page-content">{children}</main>
        <footer className="page-footer">
          <span>
            Talent Desk <span className="footer-separator">·</span> AI Resume
            Screening
          </span>
          <span>Human review stays in control</span>
        </footer>
      </div>
    </div>
  );
}
