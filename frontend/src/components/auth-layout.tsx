import Link from "next/link";
import type { ReactNode } from "react";

export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="login-page">
      <section className="login-visual">
        <Link
          className="brand login-brand"
          href="/dashboard"
          aria-label="Talent Desk home"
        >
          <span className="brand-mark">t</span>
          <span className="brand-name">
            talent<span>desk</span>
          </span>
        </Link>
        <div className="login-visual-content">
          <span className="login-kicker">
            <span /> PEOPLE-FIRST HIRING
          </span>
          <h1>
            Find the right people.
            <br />
            <span>Keep people</span> in control.
          </h1>
          <p>
            One thoughtful workspace to organize resumes, understand matches,
            and make confident decisions together.
          </p>
          <div className="login-quote">
            <span className="quote-mark">“</span>
            <p>
              Great hiring starts with seeing the person behind the profile.
            </p>
            <span className="quote-author">TALENT DESK PRINCIPLE</span>
          </div>
        </div>
        <span className="login-visual-footer">AI-assisted. Human-decided.</span>
      </section>
      <section className="login-content">
        <div className="login-card">
          <Link className="login-mobile-brand" href="/dashboard">
            <span className="brand-mark">t</span>
            <span className="brand-name">
              talent<span>desk</span>
            </span>
          </Link>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="login-subtitle">{description}</p>
          {children}
        </div>
        <footer className="login-footer">
          <span>© 2026 Talent Desk</span>
          <span>Privacy · Support</span>
        </footer>
      </section>
    </main>
  );
}
