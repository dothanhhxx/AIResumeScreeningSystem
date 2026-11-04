"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PipelineSteps } from "@/components/pipeline-steps";
import { useI18n } from "@/i18n/provider";
import { ApiError } from "@/lib/api";
import { useAuthSession } from "@/lib/auth-session";
import {
  PROCESSING_STATUSES,
  deleteCv,
  downloadCv,
  getCv,
  parseExtraction,
  reprocessCv,
  type CvDetail,
  type CvSummary,
} from "@/lib/cvs-api";

export function CvDetailPanel({
  cvId,
  initialSummary = null,
  targetJobId = null,
  refreshKey,
  onClose,
  onChanged,
}: {
  cvId: number;
  initialSummary?: CvSummary | null;
  targetJobId?: number | null;
  refreshKey: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const { session } = useAuthSession();
  const canWrite = Boolean(session && session.user.role !== "viewer");
  const [detail, setDetail] = useState<CvDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getCv(cvId, controller.signal)
      .then((value) => {
        if (value && typeof value.file_type === "string") {
          setDetail(value);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 0 && initialSummary) {
          return;
        }
        setError(
          reason instanceof ApiError
            ? reason.message
            : t("Something went wrong. Please try again."),
        );
      });
    return () => controller.abort();
  }, [cvId, initialSummary, refreshKey, t]);

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      after?.();
      onChanged();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : t("Something went wrong. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  const current = detail ?? initialSummary;
  const extraction = detail ? parseExtraction(detail) : null;
  const effectiveJobId = extraction?.target_job_id ?? targetJobId ?? null;
  const processing = current
    ? PROCESSING_STATUSES.includes(current.status)
    : false;

  return (
    <aside className="panel cv-detail-panel" aria-labelledby="cv-detail-title">
      <div className="cv-detail-heading">
        <div>
          <p className="eyebrow">{t("CV DETAILS")}</p>
          <h2 id="cv-detail-title">
            {current?.candidate_name ?? t("Loading…")}
          </h2>
          {current && (
            <p>
              {current.candidate_email
                ? `${current.candidate_email} · ${current.file_name}`
                : `${current.file_type.toUpperCase()} · ${current.file_name}`}
            </p>
          )}
        </div>
        <button className="text-link" type="button" onClick={onClose}>
          {t("Close")}
        </button>
      </div>

      {error && (
        <p className="cv-upload-message cv-upload-message-error" role="alert">
          {error}
        </p>
      )}

      {current?.status === "error" && current.error_message && (
        <p className="cv-upload-message cv-upload-message-error">
          {current.error_message}
        </p>
      )}
      {current && <PipelineSteps status={current.status} />}
      {processing && (
        <p className="ranking-progress" role="status">
          <span className="ranking-spinner" aria-hidden="true" />
          {t("Processing… this view refreshes automatically.")}
        </p>
      )}

      {extraction && (
        <div className="cv-extraction">
          {extraction.summary && (
            <p className="detail-explanation">{extraction.summary}</p>
          )}
          <dl className="cv-facts">
            <div>
              <dt>{t("Experience")}</dt>
              <dd>
                {extraction.years_of_experience !== null
                  ? t("{{years}} years", {
                      years: extraction.years_of_experience,
                    })
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>{t("Extracted by")}</dt>
              <dd>{extraction.extraction_source ?? "—"}</dd>
            </div>
          </dl>

          <section className="detail-section">
            <h3>{t("Skills")}</h3>
            <div className="skill-chips">
              {extraction.skills.length
                ? extraction.skills.map((skill) => (
                    <span key={skill} className="skill-chip">
                      {skill}
                    </span>
                  ))
                : "—"}
            </div>
          </section>

          {extraction.experiences.length > 0 && (
            <section className="detail-section">
              <h3>{t("Work history")}</h3>
              <ul className="cv-timeline">
                {extraction.experiences.map((exp, index) => (
                  <li key={`${exp.title}-${index}`}>
                    <strong>
                      {exp.title}
                      {exp.company ? ` · ${exp.company}` : ""}
                    </strong>
                    <span>
                      {[exp.start_date, exp.end_date]
                        .filter(Boolean)
                        .join(" – ")}
                    </span>
                    {exp.description && <p>{exp.description}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {extraction.education.length > 0 && (
            <section className="detail-section">
              <h3>{t("Education")}</h3>
              <ul className="cv-timeline">
                {extraction.education.map((edu, index) => (
                  <li key={`${edu.institution}-${index}`}>
                    <strong>
                      {[edu.degree, edu.field_of_study]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </strong>
                    <span>
                      {[edu.institution, edu.graduation_year, edu.gpa]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(extraction.certifications.length > 0 ||
            extraction.languages.length > 0) && (
            <section className="detail-section">
              <h3>{t("Certifications & languages")}</h3>
              <div className="skill-chips">
                {[...extraction.certifications, ...extraction.languages].map(
                  (item) => (
                    <span key={item} className="skill-chip skill-chip-muted">
                      {item}
                    </span>
                  ),
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {current && (
        <div className="cv-detail-actions">
          {(current.status === "extracted" || current.status === "scored") && (
            <Link
              className="button button-primary"
              href={
                effectiveJobId
                  ? `/rankings?job=${effectiveJobId}`
                  : "/rankings"
              }
            >
              {t("Score & review against jobs")}
            </Link>
          )}
          <button
            className="button button-secondary"
            type="button"
            disabled={busy}
            onClick={() => run(() => downloadCv(current.id, current.file_name))}
          >
            {t("Download file")}
          </button>
          {canWrite && (
            <button
              className="button button-secondary"
              type="button"
              disabled={busy || processing}
              onClick={() => run(() => reprocessCv(current.id))}
            >
              {t("Reprocess")}
            </button>
          )}
          {session &&
            (session.user.role === "admin" ||
              (canWrite && current.uploaded_by === session.user.id)) &&
            (confirmDelete ? (
              <button
                className="button button-danger"
                type="button"
                disabled={busy}
                onClick={() => run(() => deleteCv(current.id), onClose)}
              >
                {t("Confirm delete")}
              </button>
            ) : (
              <button
                className="button button-secondary"
                type="button"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                {t("Delete")}
              </button>
            ))}
        </div>
      )}
    </aside>
  );
}
