"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { MetricCard } from "@/components/metric-card";
import { useI18n } from "@/i18n/provider";
import type { TranslationKey } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import {
  getDashboardSummary,
  type DashboardSummary,
} from "@/lib/dashboard-api";
import type { JobStatus } from "@/lib/jobs-api";
import { scoreTone } from "@/lib/score-tone";

const jobStatusLabels: Record<JobStatus, TranslationKey> = {
  draft: "Draft",
  active: "Active",
  closed: "Closed",
  archived: "Archived",
};

const jobStatusTone: Record<JobStatus, string> = {
  draft: "neutral",
  active: "green",
  closed: "blue",
  archived: "neutral",
};

function relativeTime(value: string, language: "en" | "vi"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  const format = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return format.format(hours, "hour");
  return format.format(Math.round(hours / 24), "day");
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

const tones = ["mint", "blue", "amber"] as const;

export default function DashboardPage() {
  const { t, language } = useI18n();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getDashboardSummary(controller.signal)
      .then((data) => {
        setSummary(data);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setSummary(null);
        if (reason instanceof ApiError && reason.status === 401) {
          setError(t("Sign in to see your hiring overview."));
        } else if (reason instanceof ApiError && reason.status === 0) {
          setError(t("Could not reach the backend. Check that it is running."));
        } else {
          setError(t("Something went wrong. Please try again."));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadVersion, t]);

  const metrics = summary
    ? ([
        {
          label: t("Active roles"),
          value: String(summary.active_jobs),
          change: t("{{count}} total", { count: summary.total_jobs }),
          tone: "mint",
          icon: "↗",
        },
        {
          label: t("CVs received"),
          value: String(summary.total_cvs),
          change:
            summary.processing_cvs > 0
              ? t("{{count}} processing", { count: summary.processing_cvs })
              : t("All processed"),
          tone: "blue",
          icon: "▤",
        },
        {
          label: t("Needs review"),
          value: String(summary.needs_review),
          change: t("{{count}} scored", { count: summary.scored_matches }),
          tone: "amber",
          icon: "◷",
        },
        {
          label: t("Shortlisted"),
          value: String(summary.shortlisted),
          change: t("incl. interview stage"),
          tone: "violet",
          icon: "✓",
        },
      ] as const)
    : [];

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("RECRUITER OVERVIEW")}</p>
          <h1>{t("Hiring at a glance")}</h1>
          <p className="page-subtitle">
            {t("Here's what's happening across your hiring pipeline.")}
          </p>
        </div>
        <div className="job-row-actions">
          <Link className="button button-secondary" href="/cvs">
            {t("Upload resumes")}
          </Link>
          <Link className="button button-primary" href="/jobs">
            <span className="button-plus">+</span> {t("Create a job")}
          </Link>
        </div>
      </div>

      {error && (
        <div className="dashboard-error-banner" role="alert">
          <span>{error}</span>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              setReloadVersion((version) => version + 1);
            }}
          >
            {t("Retry")}
          </button>
        </div>
      )}
      {summary && summary.error_cvs > 0 && (
        <div className="sample-banner">
          <span className="sample-banner-icon">!</span>
          <span>
            <strong>
              {t("{{count}} CV(s) could not be processed.", {
                count: summary.error_cvs,
              })}
            </strong>{" "}
            {t("Open the CV library to see the error and reprocess them.")}
          </span>
          <Link href="/cvs">
            {t("Open CV library")} <Icon name="arrow" size={15} />
          </Link>
        </div>
      )}

      <section className="metrics-grid" aria-label={t("Hiring overview")}>
        {loading && !summary ? (
          <p className="cv-library-state dashboard-loading" role="status">
            {t("Loading hiring overview…")}
          </p>
        ) : summary ? (
          metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)
        ) : null}
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
          {loading && !summary ? (
            <p className="cv-library-state dashboard-empty" role="status">
              {t("Loading job descriptions…")}
            </p>
          ) : error ? (
            <p className="cv-library-state dashboard-empty">
              {t("Recent job descriptions are unavailable.")}
            </p>
          ) : summary?.recent_jobs.length === 0 ? (
            <p className="cv-library-state dashboard-empty">
              {t("No job descriptions yet. Create one to start matching.")}
            </p>
          ) : summary && summary.recent_jobs.length > 0 ? (
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
                  {summary.recent_jobs.map((role) => (
                    <tr key={role.id}>
                      <td>
                        <div className="role-title">{role.title}</div>
                        <div className="role-department">
                          {[role.department, role.location]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>
                      </td>
                      <td>
                        <span className="applicant-count">
                          {role.candidates}
                        </span>
                        <span className="muted-inline"> {t("candidates")}</span>
                      </td>
                      <td>
                        <span
                          className={`status-pill status-${jobStatusTone[role.status]}`}
                        >
                          <span />
                          {t(jobStatusLabels[role.status])}
                        </span>
                      </td>
                      <td className="muted-cell">
                        {relativeTime(role.updated_at, language)}
                      </td>
                      <td>
                        <div className="job-row-actions">
                          {role.status !== "archived" && (
                            <Link
                              className="icon-button"
                              href={`/cvs?job=${role.id}`}
                              aria-label={`${t("Upload CVs")} ${role.title}`}
                            >
                              {t("Upload CVs")}
                            </Link>
                          )}
                          <Link
                            className="row-arrow"
                            href={`/rankings?job=${role.id}`}
                            aria-label={t("View {{role}}", {
                              role: role.title,
                            })}
                          >
                            <Icon name="arrow" size={17} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
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
            <span className="queue-count">{summary?.needs_review ?? 0}</span>
          </div>
          <div className="queue-list">
            {loading && !summary && (
              <p className="cv-library-state dashboard-empty" role="status">
                {t("Loading review queue…")}
              </p>
            )}
            {error && (
              <p className="cv-library-state dashboard-empty">
                {t("Review queue is unavailable.")}
              </p>
            )}
            {summary?.review_queue.length === 0 && (
              <p className="cv-library-state dashboard-empty">
                {t(
                  "Nothing waiting. Run AI matching on a job to fill the queue.",
                )}
              </p>
            )}
            {summary?.review_queue.map((candidate, index) => (
              <Link
                className="queue-item"
                key={candidate.result_id}
                href={`/rankings?job=${candidate.job_id}`}
              >
                <div
                  className={`candidate-avatar candidate-avatar-${tones[index % tones.length]}`}
                >
                  {initials(candidate.candidate_name)}
                </div>
                <div className="candidate-info">
                  <strong>{candidate.candidate_name}</strong>
                  <span>{candidate.job_title}</span>
                  <small>{candidate.matched_skills.join(", ")}</small>
                </div>
                <div
                  className={`fit-score score-${scoreTone(candidate.score)}`}
                >
                  <strong>{Math.round(candidate.score)}%</strong>
                  <span>{t("fit")}</span>
                </div>
              </Link>
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
    </>
  );
}
