"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/provider";
import { ApiError, apiRequest } from "@/lib/api";

type AuditLog = {
  id: number;
  user_id: number | null;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  detail: Record<string, unknown> | string | null;
  ip_address: string | null;
  created_at: string;
};

type AuditPage = {
  items: AuditLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

const ACTIONS = [
  "login",
  "register",
  "cv_upload",
  "cv_delete",
  "cv_view",
  "job_create",
  "job_update",
  "job_delete",
  "match_run",
  "match_view",
  "decision_create",
  "decision_update",
];

function formatDetail(detail: AuditLog["detail"]): string {
  if (!detail) return "—";
  if (typeof detail === "string") return detail;
  return Object.entries(detail)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(
      ([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`,
    )
    .join(" · ");
}

export default function AuditPage() {
  const { t, language } = useI18n();
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), page_size: "50" });
    if (action) params.set("action", action);
    apiRequest<AuditPage>(
      `/audit?${params.toString()}`,
      undefined,
      controller.signal,
    )
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof ApiError && reason.status === 403
            ? t("Only administrators can view the audit log.")
            : reason instanceof Error
              ? reason.message
              : t("Something went wrong. Please try again."),
        );
      });
    return () => controller.abort();
  }, [action, page, t]);

  const formatter = new Intl.DateTimeFormat(
    language === "vi" ? "vi-VN" : "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("COMPLIANCE")}</p>
          <h1>{t("Audit log")}</h1>
          <p className="page-subtitle">
            {t(
              "Every sign-in, upload, matching run and decision is recorded here.",
            )}
          </p>
        </div>
        <label className="form-field audit-filter">
          <span>{t("Action")}</span>
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("All actions")}</option>
            {ACTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="cv-upload-message cv-upload-message-error" role="alert">
          {error}
        </p>
      )}

      <section className="panel">
        <div className="table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>{t("TIME")}</th>
                <th>{t("USER")}</th>
                <th>{t("ACTION")}</th>
                <th>{t("RESOURCE")}</th>
                <th>{t("DETAILS")}</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((log) => (
                <tr key={log.id}>
                  <td className="muted-cell">
                    {formatter.format(new Date(log.created_at))}
                  </td>
                  <td>
                    {log.user_email ?? (log.user_id ? `#${log.user_id}` : "—")}
                  </td>
                  <td>
                    <span className="audit-action">{log.action}</span>
                  </td>
                  <td className="muted-cell">
                    {log.resource_type
                      ? `${log.resource_type} #${log.resource_id ?? "—"}`
                      : "—"}
                  </td>
                  <td className="audit-detail">{formatDetail(log.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.items.length === 0 && (
          <p className="cv-library-state dashboard-empty">
            {t("No audit entries yet.")}
          </p>
        )}
        {data && data.total_pages > 1 && (
          <div className="audit-pager">
            <button
              className="button button-secondary"
              type="button"
              disabled={page <= 1}
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
              disabled={page >= data.total_pages}
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
