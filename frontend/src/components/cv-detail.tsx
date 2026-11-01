"use client";

import { useEffect, useState } from "react";
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
} from "@/lib/cvs-api";

export function CvDetailPanel({
  cvId,
  refreshKey,
  onClose,
  onChanged,
}: {
  cvId: number;
  refreshKey: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const { session } = useAuthSession();
  const canWrite = session?.user.role !== "viewer";
  const [detail, setDetail] = useState<CvDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getCv(cvId, controller.signal)
      .then((value) => {
        setDetail(value);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof ApiError
            ? reason.message
            : t("Something went wrong. Please try again."),
        );
      });
    return () => controller.abort();
  }, [cvId, refreshKey, t]);

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

  const extraction = detail ? parseExtraction(detail) : null;
  const processing = detail
    ? PROCESSING_STATUSES.includes(detail.status)
    : false;

  return (
    <aside className="panel cv-detail-panel" aria-labelledby="cv-detail-title">
      <div className="cv-detail-heading">
        <div>
          <p className="eyebrow">{t("CV DETAILS")}</p>
          <h2 id="cv-detail-title">
            {detail?.candidate_name ?? t("Loading…")}
          </h2>
          {detail && <p>{detail.file_name}</p>}
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

      {detail?.status === "error" && detail.error_message && (
        <p className="cv-upload-message cv-upload-message-error">
          {detail.error_message}
        </p>
      )}
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

      {detail && (
        <div className="cv-detail-actions">
          <button
            className="button button-secondary"
            type="button"
            disabled={busy}
            onClick={() => run(() => downloadCv(detail.id, detail.file_name))}
          >
            {t("Download file")}
          </button>
          {canWrite && (
            <button
              className="button button-secondary"
              type="button"
              disabled={busy || processing}
              onClick={() => run(() => reprocessCv(detail.id))}
            >
              {t("Reprocess")}
            </button>
          )}
          {canWrite &&
            (confirmDelete ? (
              <button
                className="button button-danger"
                type="button"
                disabled={busy}
                onClick={() => run(() => deleteCv(detail.id), onClose)}
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
