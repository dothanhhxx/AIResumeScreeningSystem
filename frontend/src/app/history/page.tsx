"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { Skeleton } from "@/components/skeleton";
import { useI18n } from "@/i18n/provider";
import type { TranslationKey } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import {
  DECISION_STATUSES,
  getHistory,
  type DecisionStatus,
  type HistoryPage,
} from "@/lib/insights-api";
import { listJobs, type Job } from "@/lib/jobs-api";
import { scoreTone } from "@/lib/score-tone";
import styles from "./history.module.css";

const PAGE_SIZE = 20;

const decisionLabels: Record<DecisionStatus, TranslationKey> = {
  pending: "Pending review",
  shortlisted: "Shortlisted",
  interview: "Interview",
  rejected: "Rejected",
  hired: "Hired",
};

export default function HistoryPage() {
  const { t, language } = useI18n();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState<number | null>(null);
  const [status, setStatus] = useState<DecisionStatus | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HistoryPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Loading is derived: the request for the current filters has not settled yet.
  const requestKey = `${page}|${jobId ?? ""}|${status}|${search}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const loading = settledKey !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    listJobs({ page: 1, pageSize: 100, signal: controller.signal })
      .then((result) => setJobs(result.items))
      .catch(() => undefined); // the filter simply stays at "All roles"
    return () => controller.abort();
  }, []);

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    const key = `${page}|${jobId ?? ""}|${status}|${search}`;
    getHistory(
      { page, pageSize: PAGE_SIZE, jobId, decisionStatus: status, search },
      controller.signal,
    )
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
      })
      .finally(() => {
        if (!controller.signal.aborted) setSettledKey(key);
      });
    return () => controller.abort();
  }, [page, jobId, status, search, t]);

  const dateFormat = new Intl.DateTimeFormat(
    language === "vi" ? "vi-VN" : "en-US",
    { dateStyle: "medium", timeStyle: "short" },
  );
  const formatDate = (value: string | null) =>
    value ? dateFormat.format(new Date(value)) : "—";
  const filtered = Boolean(jobId || status || search);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("HUMAN REVIEW")}</p>
          <h1>{t("Screening history")}</h1>
          <p className="page-subtitle">
            {t(
              "Every scored candidate, the AI score, and the decision your team recorded.",
            )}
          </p>
        </div>
      </div>

      <section className="panel">
        <div className={styles.filters}>
          <label className="form-field">
            <span>{t("Job")}</span>
            <select
              value={jobId ?? ""}
              onChange={(event) => {
                setJobId(
                  event.target.value ? Number(event.target.value) : null,
                );
                setPage(1);
              }}
            >
              <option value="">{t("All roles")}</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{t("Decision")}</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as DecisionStatus | "");
                setPage(1);
              }}
            >
              <option value="">{t("All decisions")}</option>
              {DECISION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(decisionLabels[value])}
                </option>
              ))}
            </select>
          </label>
          <label className={`form-field ${styles.search}`}>
            <span>{t("Search")}</span>
            <span className={styles.searchInput}>
              <Icon name="search" size={16} />
              <input
                type="search"
                value={searchInput}
                placeholder={t("Candidate or role")}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </span>
          </label>
          {data && (
            <p className={styles.count} aria-live="polite">
              {t("{{count}} results", { count: data.total })}
            </p>
          )}
        </div>

        {error && (
          <p className="cv-upload-message cv-upload-message-error" role="alert">
            {error}
          </p>
        )}

        {!data && loading && (
          <div
            className={styles.skeletonRows}
            role="status"
            aria-label={t("Loading history…")}
          >
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className={styles.skeletonRow}>
                <Skeleton width="70%" />
                <Skeleton width="60%" />
                <Skeleton width={36} height={22} radius={999} />
                <Skeleton width={90} height={22} radius={999} />
                <Skeleton width="50%" />
              </div>
            ))}
          </div>
        )}

        {data && data.items.length > 0 && (
          <div
            className={`table-wrap ${styles.tableWrap}`}
            data-refreshing={loading || undefined}
            aria-busy={loading}
          >
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("Candidate")}</th>
                  <th scope="col">{t("Role")}</th>
                  <th scope="col">{t("Score")}</th>
                  <th scope="col">{t("Decision")}</th>
                  <th scope="col">{t("Decided by")}</th>
                  <th scope="col">{t("Last activity")}</th>
                  <th scope="col">
                    <span className="sr-only">{t("Open review")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => {
                  const adjusted = item.effective_score !== item.ai_score;
                  return (
                    <tr key={item.result_id}>
                      <th scope="row">{item.candidate_name}</th>
                      <td className={styles.role}>{item.job_title}</td>
                      <td>
                        <span
                          className={`${styles.score} score-${scoreTone(item.effective_score)}`}
                          title={
                            adjusted
                              ? t("AI score {{ai}}, adjusted to {{score}}", {
                                  ai: Math.round(item.ai_score),
                                  score: Math.round(item.effective_score),
                                })
                              : undefined
                          }
                        >
                          {Math.round(item.effective_score)}
                          {adjusted && (
                            <span className={styles.adjusted}>*</span>
                          )}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`decision-chip decision-${item.decision_status}`}
                        >
                          {t(decisionLabels[item.decision_status])}
                        </span>
                        {item.decision_reason && (
                          <span
                            className={styles.reason}
                            title={item.decision_reason}
                          >
                            {item.decision_reason}
                          </span>
                        )}
                      </td>
                      <td className="muted-cell">
                        {item.decided_by_name ?? "—"}
                      </td>
                      <td className="muted-cell">
                        {formatDate(item.decided_at ?? item.scored_at)}
                      </td>
                      <td>
                        <Link
                          className="row-arrow"
                          href={`/rankings?job=${item.job_id}`}
                          aria-label={t("Open review for {{name}}", {
                            name: item.candidate_name,
                          })}
                        >
                          <Icon name="arrow" size={16} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className={styles.empty} role="status">
            <span className="empty-icon">
              <Icon name="history" size={20} />
            </span>
            <h2>
              {filtered
                ? t("No results for these filters")
                : t("No screening history yet")}
            </h2>
            <p>
              {filtered
                ? t("Try another role, decision, or search term.")
                : t("Run AI matching for a job to start building the history.")}
            </p>
            {filtered ? (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setJobId(null);
                  setStatus("");
                  setSearchInput("");
                  setPage(1);
                }}
              >
                {t("Clear filters")}
              </button>
            ) : (
              <Link className="button button-primary" href="/rankings">
                {t("Go to candidate review")}
              </Link>
            )}
          </div>
        )}

        {data && data.total_pages > 1 && (
          <div className="audit-pager">
            <button
              className="button button-secondary"
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              {t("Previous")}
            </button>
            <span>
              {t("Page {{page}} of {{total}}", {
                page,
                total: data.total_pages,
              })}
            </span>
            <button
              className="button button-secondary"
              type="button"
              disabled={page >= data.total_pages || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              {t("Next")}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
