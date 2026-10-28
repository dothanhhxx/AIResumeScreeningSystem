"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { MetricCard } from "@/components/metric-card";
import { useI18n } from "@/i18n/provider";
import { recentRoles, reviewQueue, sampleMetrics } from "@/lib/sample-data";

export default function DashboardPage() {
  const { t } = useI18n();

  return (
    <AppShell activePath="/dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("RECRUITER OVERVIEW")}</p>
          <h1>{t("Hiring at a glance")}</h1>
          <p className="page-subtitle">
            {t("Here's what's happening across your hiring pipeline.")}
          </p>
        </div>
        <Link className="button button-primary" href="/jobs">
          <span className="button-plus">+</span> {t("Create a job")}
        </Link>
      </div>

      <div className="sample-banner">
        <span className="sample-banner-icon">i</span>
        <span>
          <strong>{t("Preview workspace")}</strong>{" "}
          {t(
            "All candidate and hiring figures below are synthetic sample data.",
          )}
        </span>
        <Link href="/jobs">
          {t("Explore job descriptions")} <Icon name="arrow" size={15} />
        </Link>
      </div>

      <section className="metrics-grid" aria-label={t("Hiring overview")}>
        {sampleMetrics.map((metric) => (
          <MetricCard
            key={metric.label}
            {...metric}
            label={t(metric.label)}
            change={
              metric.change === "8 new" ? t(metric.change) : metric.change
            }
          />
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="panel roles-panel">
          <div className="panel-heading">
            <div>
              <h2>{t("Recent job descriptions")}</h2>
              <p>{t("Track roles and their candidate pipelines.")}</p>
            </div>
            <Link className="text-link" href="/jobs">
              {t("View all")} <Icon name="arrow" size={15} />
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("ROLE")}</th>
                  <th>{t("APPLICANTS")}</th>
                  <th>{t("STATUS")}</th>
                  <th>{t("UPDATED")}</th>
                  <th>
                    <span className="sr-only">{t("Open role")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentRoles.map((role) => (
                  <tr key={role.title}>
                    <td>
                      <div className="role-title">{role.title}</div>
                      <div className="role-department">
                        {t(role.department)}
                      </div>
                    </td>
                    <td>
                      <span className="applicant-count">{role.candidates}</span>
                      <span className="muted-inline"> {t("candidates")}</span>
                    </td>
                    <td>
                      <span className={`status-pill status-${role.tone}`}>
                        <span />
                        {t(role.status)}
                      </span>
                    </td>
                    <td className="muted-cell">{t(role.updated)}</td>
                    <td>
                      <Link
                        className="row-arrow"
                        href="/jobs"
                        aria-label={t("View {{role}}", { role: role.title })}
                      >
                        <Icon name="arrow" size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link className="panel-bottom-link" href="/jobs">
            {t("View all job descriptions")} <Icon name="arrow" size={15} />
          </Link>
        </section>

        <section className="panel queue-panel">
          <div className="panel-heading">
            <div>
              <h2>{t("Review queue")}</h2>
              <p>{t("Strong matches waiting for a human review.")}</p>
            </div>
            <span className="queue-count">8</span>
          </div>
          <div className="queue-list">
            {reviewQueue.map((candidate) => (
              <article className="queue-item" key={candidate.name}>
                <div
                  className={`candidate-avatar candidate-avatar-${candidate.tone}`}
                >
                  {candidate.initials}
                </div>
                <div className="candidate-info">
                  <strong>{candidate.name}</strong>
                  <span>{candidate.role}</span>
                  <small>{candidate.skills}</small>
                </div>
                <div className="fit-score">
                  <strong>{candidate.fit}</strong>
                  <span>{t("fit")}</span>
                </div>
              </article>
            ))}
          </div>
          <Link className="panel-bottom-link" href="/rankings">
            {t("Review candidates")} <Icon name="arrow" size={15} />
          </Link>
        </section>
      </div>

      <section className="human-review-note">
        <span className="human-review-icon">♡</span>
        <div>
          <strong>{t("People make the hiring decisions.")}</strong>
          <span>
            {t(
              "Match indicators help organize review. They do not make or replace hiring decisions.",
            )}
          </span>
        </div>
        <Link href="/rankings">
          {t("How review works")} <Icon name="arrow" size={15} />
        </Link>
      </section>
    </AppShell>
  );
}
