"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BarList,
  ColumnChart,
  DataTable,
  Legend,
  LineChart,
  SegmentedBar,
} from "@/components/ui/charts";
import { MetricCard } from "@/components/ui/metric-card";
import { Skeleton, SkeletonPanel } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/provider";
import type { TranslationKey } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import {
  DECISION_STATUSES,
  getAnalytics,
  type Analytics,
  type DecisionStatus,
} from "@/lib/insights-api";
import { scoreTone } from "@/lib/score-tone";
import styles from "./analytics.module.css";

const ACTIVITY_DAYS = 14;

const decisionLabels: Record<DecisionStatus, TranslationKey> = {
  pending: "Pending review",
  shortlisted: "Shortlisted",
  interview: "Interview",
  rejected: "Rejected",
  hired: "Hired",
};

export function AnalyticsDashboard() {
  const { t, language } = useI18n();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getAnalytics(ACTIVITY_DAYS, controller.signal)
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof ApiError && reason.status === 0
            ? t("Could not reach the backend. Check that it is running.")
            : t("Something went wrong. Please try again."),
        );
      });
    return () => controller.abort();
  }, [t]);

  const locale = language === "vi" ? "vi-VN" : "en-US";
  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const dayFormat = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const formatDay = (iso: string) =>
    dayFormat.format(new Date(`${iso}T00:00:00Z`));

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("INSIGHTS")}</p>
          <h1>{t("Analytics")}</h1>
          <p className="page-subtitle">
            {t(
              "How candidates score, where decisions land, and which skills are hardest to find.",
            )}
          </p>
        </div>
      </div>

      {error && (
        <p className="cv-upload-message cv-upload-message-error" role="alert">
          {error}
        </p>
      )}

      {!data && !error && (
        <div
          className={styles.grid}
          role="status"
          aria-label={t("Loading analytics…")}
        >
          <div className={styles.kpis}>
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="metric-card">
                <Skeleton width="50%" height={12} />
                <Skeleton width="36%" height={30} />
                <Skeleton width="60%" height={11} />
              </div>
            ))}
          </div>
          <SkeletonPanel height={200} />
          <SkeletonPanel height={200} />
          <div className={styles.wide}>
            <SkeletonPanel height={220} />
          </div>
        </div>
      )}

      {data && data.scored_matches === 0 && (
        <section className={`panel ${styles.empty}`}>
          <h2>{t("No scored candidates yet")}</h2>
          <p>
            {t(
              "Analytics appear after the first AI matching run. Upload CVs, then run matching for a job.",
            )}
          </p>
          <Link className="button button-primary" href="/rankings">
            {t("Go to candidate review")}
          </Link>
        </section>
      )}

      {data && data.scored_matches > 0 && (
        <div className={styles.grid}>
          <div className={styles.kpis}>
            <MetricCard
              label={t("Scored matches")}
              value={String(data.scored_matches)}
              change={t("from {{count}} CVs", { count: data.total_cvs })}
              tone="mint"
              icon="◎"
            />
            <MetricCard
              label={t("Average match score")}
              value={
                data.average_score === null
                  ? "—"
                  : String(Math.round(data.average_score))
              }
              change={t("out of 100")}
              tone="blue"
              icon="≈"
            />
            <MetricCard
              label={t("Decisions recorded")}
              value={String(data.decided_matches)}
              change={t("{{count}} awaiting review", {
                count: data.decision_funnel.pending,
              })}
              tone="amber"
              icon="✓"
            />
            <MetricCard
              label={t("Active roles")}
              value={String(
                data.jobs.filter((job) => job.status === "active").length,
              )}
              change={t("{{count}} total", { count: data.total_jobs })}
              tone="violet"
              icon="↗"
            />
          </div>

          <section
            className={`panel ${styles.card}`}
            aria-labelledby="score-title"
          >
            <header className={styles.cardHead}>
              <h2 id="score-title">{t("Match score distribution")}</h2>
              <p>{t("Effective scores, including recruiter adjustments.")}</p>
            </header>
            <SegmentedBar
              label={t("Share of candidates by score band")}
              formatShare={(share) => percent.format(share)}
              describe={(segment, share) =>
                `${segment.label}: ${segment.value} (${share})`
              }
              segments={[
                {
                  key: "high",
                  label: t("Strong (75+)"),
                  value: data.score_bands.high,
                  color: "var(--score-high)",
                },
                {
                  key: "mid",
                  label: t("Partial (50–74)"),
                  value: data.score_bands.mid,
                  color: "var(--score-mid)",
                },
                {
                  key: "low",
                  label: t("Weak (under 50)"),
                  value: data.score_bands.low,
                  color: "var(--score-low)",
                },
              ]}
            />
            <div className={styles.spacer} />
            <ColumnChart
              label={t("Candidates per 10-point score range")}
              columns={data.score_distribution.map((bucket) => ({
                key: String(bucket.start),
                label: `${bucket.start}`,
                tooltip: `${bucket.start}–${bucket.end}`,
                value: bucket.count,
                color: "var(--chart-1)",
                description: t("{{range}}: {{count}} candidates", {
                  range: `${bucket.start}–${bucket.end}`,
                  count: bucket.count,
                }),
              }))}
            />
            <DataTable
              summary={t("Show data table")}
              headers={[t("Score range"), t("Candidates")]}
              rows={data.score_distribution.map((b) => [
                `${b.start}–${b.end}`,
                b.count,
              ])}
            />
          </section>

          <section
            className={`panel ${styles.card}`}
            aria-labelledby="funnel-title"
          >
            <header className={styles.cardHead}>
              <h2 id="funnel-title">{t("Decision outcomes")}</h2>
              <p>{t("Where every scored candidate stands today.")}</p>
            </header>
            <BarList
              label={t("Decision outcomes")}
              rows={DECISION_STATUSES.map((status) => ({
                key: status,
                label: t(decisionLabels[status]),
                value: data.decision_funnel[status],
              }))}
            />
            <p className={styles.note}>
              {t("{{share}} of scored candidates have a recorded decision.", {
                share: percent.format(
                  data.decided_matches / data.scored_matches,
                ),
              })}
            </p>
          </section>

          <section
            className={`panel ${styles.card} ${styles.wide}`}
            aria-labelledby="activity-title"
          >
            <header className={styles.cardHead}>
              <h2 id="activity-title">
                {t("Activity, last {{days}} days", { days: ACTIVITY_DAYS })}
              </h2>
              <p>
                {t("Daily counts. Hover or use the arrow keys to read a day.")}
              </p>
            </header>
            <Legend
              items={[
                {
                  label: t("CVs uploaded"),
                  color: "var(--chart-1)",
                  shape: "line",
                },
                {
                  label: t("Matches scored"),
                  color: "var(--chart-2)",
                  shape: "line",
                },
                {
                  label: t("Decisions made"),
                  color: "var(--chart-3)",
                  shape: "line",
                },
              ]}
            />
            <LineChart
              label={t("Activity, last {{days}} days", { days: ACTIVITY_DAYS })}
              xLabels={data.activity.map((day) => formatDay(day.date))}
              series={[
                {
                  key: "cvs",
                  label: t("CVs uploaded"),
                  color: "var(--chart-1)",
                  values: data.activity.map((d) => d.cvs_uploaded),
                },
                {
                  key: "scored",
                  label: t("Matches scored"),
                  color: "var(--chart-2)",
                  values: data.activity.map((d) => d.matches_scored),
                },
                {
                  key: "decided",
                  label: t("Decisions made"),
                  color: "var(--chart-3)",
                  values: data.activity.map((d) => d.decisions_made),
                },
              ]}
            />
            <DataTable
              summary={t("Show data table")}
              headers={[
                t("Date"),
                t("CVs uploaded"),
                t("Matches scored"),
                t("Decisions made"),
              ]}
              rows={data.activity.map((d) => [
                formatDay(d.date),
                d.cvs_uploaded,
                d.matches_scored,
                d.decisions_made,
              ])}
            />
          </section>

          <section
            className={`panel ${styles.card} ${styles.jobsCard} ${styles.wide}`}
            aria-labelledby="jobs-title"
          >
            <header className={styles.cardHead}>
              <h2 id="jobs-title">{t("By job description")}</h2>
              <p>
                {t("Candidates scored per role and how far they progressed.")}
              </p>
            </header>
            <div className="table-wrap">
              <table className={styles.jobsTable}>
                <thead>
                  <tr>
                    <th scope="col">{t("Role")}</th>
                    <th scope="col">{t("Candidates")}</th>
                    <th scope="col">{t("Average")}</th>
                    <th scope="col">{t("Top")}</th>
                    <th scope="col">{t("Advanced")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.jobs.map((job) => (
                    <tr key={job.id}>
                      <th scope="row">
                        <Link
                          className={styles.jobLink}
                          href={`/rankings?job=${job.id}`}
                        >
                          {job.title}
                        </Link>
                      </th>
                      <td>{job.candidates}</td>
                      <td>
                        {job.average_score === null ? (
                          "—"
                        ) : (
                          <span className={styles.meterCell}>
                            <span>{Math.round(job.average_score)}</span>
                            <span
                              className={`${styles.meter} score-${scoreTone(job.average_score)}`}
                              aria-hidden="true"
                            >
                              <span
                                style={{ width: `${job.average_score}%` }}
                              />
                            </span>
                          </span>
                        )}
                      </td>
                      <td>
                        {job.top_score === null
                          ? "—"
                          : Math.round(job.top_score)}
                      </td>
                      <td>{job.advanced}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section
            className={`panel ${styles.card} ${styles.wide}`}
            aria-labelledby="gaps-title"
          >
            <header className={styles.cardHead}>
              <h2 id="gaps-title">{t("Most common skill gaps")}</h2>
              <p>
                {t(
                  "Required skills with no evidence in the CV, by number of candidates.",
                )}
              </p>
            </header>
            {data.top_missing_skills.length ? (
              <BarList
                label={t("Most common skill gaps")}
                color="var(--chart-2)"
                rows={data.top_missing_skills.map((gap) => ({
                  key: gap.skill,
                  label: gap.skill,
                  value: gap.candidates,
                }))}
              />
            ) : (
              <p className={styles.note}>{t("No skill gaps recorded yet.")}</p>
            )}
            <p className={styles.note}>
              {t(
                "Not found in the CV does not mean the candidate lacks the skill.",
              )}
            </p>
          </section>
        </div>
      )}
    </>
  );
}
