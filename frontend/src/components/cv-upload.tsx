"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { CvDetailPanel } from "@/components/cv-detail";
import { useI18n } from "@/i18n/provider";
import type { TranslationKey } from "@/i18n/messages";
import { listJobs, type Job } from "@/lib/jobs-api";
import {
  CvsApiError,
  listCvs,
  PROCESSING_STATUSES,
  uploadCv,
  type CvPage,
  type CvStatus,
} from "@/lib/cvs-api";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const CV_PAGE_SIZE = 10;
const POLL_MS = 3000;

type Feedback = {
  kind: "error" | "info";
  key?: TranslationKey;
  values?: Record<string, string | number>;
  text?: string;
};

const statusLabels: Record<CvStatus, TranslationKey> = {
  uploaded: "Uploaded",
  parsing: "Parsing",
  parsed: "Parsed",
  extracting: "Extracting",
  extracted: "Extracted",
  scoring: "Scoring",
  scored: "Scored",
  error: "Error",
};

function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || name.endsWith(".docx");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string, language: "en" | "vi"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
  }).format(date);
}

function getApiErrorFeedback(error: unknown): Feedback {
  if (error instanceof CvsApiError) {
    if (
      error.message === "Set NEXT_PUBLIC_API_BASE_URL to connect the backend."
    ) {
      return {
        kind: "error",
        key: "Backend connection is not configured. Set NEXT_PUBLIC_API_BASE_URL in the frontend environment.",
      };
    }
    if (error.status === 404) {
      return {
        kind: "error",
        key: "The CV API route is not available yet.",
      };
    }
    if (error.status === 401) {
      return { kind: "error", key: "Sign in to access the CV library." };
    }
    if (error.status === 0) {
      return {
        kind: "error",
        key: "Could not reach the backend. Check that it is running.",
      };
    }
    return { kind: "error", text: error.message };
  }

  return { kind: "error", key: "Something went wrong. Please try again." };
}

function renderFeedback(
  feedback: Feedback,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string,
) {
  if (feedback.key) return t(feedback.key, feedback.values);
  return feedback.text ?? t("Something went wrong. Please try again.");
}

export function CvUpload({
  requestedCvId = null,
  requestedJobId = null,
}: {
  requestedCvId?: number | null;
  requestedJobId?: number | null;
}) {
  const { t, language } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [targetJobId, setTargetJobId] = useState<number | null>(requestedJobId);
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<Feedback | null>(null);
  const [cvPage, setCvPage] = useState<CvPage | null>(null);
  const [listFeedback, setListFeedback] = useState<Feedback | null>(null);
  const [loadingCvs, setLoadingCvs] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [selectedCvId, setSelectedCvId] = useState<number | null>(
    requestedCvId,
  );
  const [lastUploadedCv, setLastUploadedCv] = useState<
    CvPage["items"][number] | null
  >(null);
  const pendingSelectCvIdRef = useRef<number | null>(null);

  const hasProcessing =
    cvPage?.items.some((cv) => PROCESSING_STATUSES.includes(cv.status)) ??
    false;

  // Refresh statuses automatically while the pipeline is still working
  useEffect(() => {
    if (!hasProcessing) return;
    const timer = window.setTimeout(
      () => setRefreshVersion((version) => version + 1),
      POLL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [hasProcessing, refreshVersion]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFirstPage() {
      try {
        const result = await listCvs({
          page: 1,
          pageSize: CV_PAGE_SIZE,
          signal: controller.signal,
        });
        setCvPage(result);
        if (pendingSelectCvIdRef.current !== null) {
          setSelectedCvId(pendingSelectCvIdRef.current);
          pendingSelectCvIdRef.current = null;
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setListFeedback(getApiErrorFeedback(error));
      } finally {
        if (!controller.signal.aborted) setLoadingCvs(false);
      }
    }

    void loadFirstPage();
    return () => controller.abort();
  }, [refreshVersion]);

  function ensureJobsLoaded() {
    if (jobsLoaded) return;
    setJobsLoaded(true);
    listJobs({ page: 1, pageSize: 100 })
      .then((page) => {
        setAvailableJobs(
          page.items.filter((job) => job.status !== "archived"),
        );
      })
      .catch(() => {
        // Non-fatal: job selector remains optional if jobs cannot be loaded
      });
  }

  useEffect(() => {
    if (requestedJobId !== null && !jobsLoaded) {
      ensureJobsLoaded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedJobId]);

  function addFiles(incoming: FileList | File[]) {
    const selected = Array.from(incoming);
    if (selected.length === 0) return;
    if (selected.length > 1) {
      setFile(null);
      setUploadFeedback({
        kind: "error",
        key: "Upload one CV per candidate. Select one file at a time.",
      });
      return;
    }

    const nextFile = selected[0];
    if (!isSupportedFile(nextFile)) {
      setFile(null);
      setUploadFeedback({
        kind: "error",
        key: "Choose a PDF or DOCX resume.",
      });
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE_BYTES) {
      setFile(null);
      setUploadFeedback({
        kind: "error",
        key: "The selected file exceeds the 10 MB limit.",
      });
      return;
    }

    setFile(nextFile);
    setUploadFeedback({
      kind: "info",
      key: "Selected {{name}}. It stays in this browser until you upload it.",
      values: { name: nextFile.name },
    });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files) addFiles(event.currentTarget.files);
    event.currentTarget.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    setUploading(true);
    setUploadFeedback(null);
    try {
      const uploaded = await uploadCv({
        candidateName,
        candidateEmail,
        jobId: targetJobId,
        file,
      });
      setUploadFeedback({
        kind: "info",
        key: "Uploaded {{name}} as CV #{{id}}. Current status: {{status}}.",
        values: {
          name: uploaded.candidate_name,
          id: uploaded.id,
          status: t(statusLabels[uploaded.status]),
        },
      });
      setLastUploadedCv(uploaded);
      pendingSelectCvIdRef.current = uploaded.id;
      setFile(null);
      setCandidateName("");
      setCandidateEmail("");
      setLoadingCvs(true);
      setRefreshVersion((version) => version + 1);
    } catch (error) {
      setUploadFeedback(getApiErrorFeedback(error));
    } finally {
      setUploading(false);
    }
  }

  async function handleLoadMore() {
    if (!cvPage || loadingMore) return;
    setLoadingMore(true);
    setListFeedback(null);
    try {
      const nextPage = await listCvs({
        page: cvPage.page + 1,
        pageSize: CV_PAGE_SIZE,
      });
      setCvPage((current) =>
        current
          ? { ...nextPage, items: [...current.items, ...nextPage.items] }
          : nextPage,
      );
    } catch (error) {
      setListFeedback(getApiErrorFeedback(error));
    } finally {
      setLoadingMore(false);
    }
  }

  function handleRefresh() {
    setLoadingCvs(true);
    setListFeedback(null);
    setRefreshVersion((version) => version + 1);
  }

  return (
    <div className="cv-upload-layout">
      <section
        className="panel cv-upload-panel"
        aria-labelledby="cv-upload-title"
      >
        <div className="panel-heading">
          <div>
            <h2 id="cv-upload-title">{t("Add candidate resumes")}</h2>
            <p>
              {t(
                "Drop a PDF or DOCX resume — TalentLens scans and records candidate details automatically.",
              )}
            </p>
          </div>
        </div>

        <form className="cv-upload-form" onSubmit={handleUpload}>
          <label className="form-field">
            <span>{t("Target job description (optional)")}</span>
            <select
              name="job_id"
              value={targetJobId ?? ""}
              onFocus={ensureJobsLoaded}
              onMouseDown={ensureJobsLoaded}
              onChange={(event) =>
                setTargetJobId(Number(event.target.value) || null)
              }
            >
              <option value="">
                {t("General CV library — or choose a job to auto-score")}
              </option>
              {targetJobId !== null &&
                !availableJobs.some((job) => job.id === targetJobId) && (
                  <option value={targetJobId}>
                    {`${t("Job")} #${targetJobId}`}
                  </option>
                )}
              {availableJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                  {job.status !== "active" ? ` (${job.status})` : ""}
                </option>
              ))}
            </select>
          </label>
          {targetJobId !== null && (
            <div className="cv-integration-note" role="status">
              <strong>
                {availableJobs.find((job) => job.id === targetJobId)?.title ??
                  `${t("Job")} #${targetJobId}`}
              </strong>
              <span>
                {t(
                  "Auto-scoring enabled: uploaded CVs are scanned, extracted, and scored directly against this job.",
                )}{" "}
                <Link
                  className="text-link"
                  href={`/rankings?job=${targetJobId}`}
                >
                  {t("Open job rankings")} →
                </Link>
              </span>
            </div>
          )}

          <div className="cv-candidate-fields">
            <label className="form-field">
              <span>{t("Candidate full name")}</span>
              <input
                name="candidate_name"
                type="text"
                autoComplete="name"
                maxLength={255}
                value={candidateName}
                onChange={(event) => setCandidateName(event.target.value)}
                placeholder={t("Leave blank to auto-detect from CV")}
              />
            </label>
            <label className="form-field">
              <span>{t("Candidate email (optional)")}</span>
              <input
                name="candidate_email"
                type="email"
                autoComplete="email"
                maxLength={255}
                value={candidateEmail}
                onChange={(event) => setCandidateEmail(event.target.value)}
                placeholder={t("Leave blank to auto-detect from CV")}
              />
            </label>
          </div>

          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            aria-label={t("Choose resume file")}
          />
          <div
            className={`cv-dropzone${dragging ? " cv-dropzone-active" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              const nextTarget = event.relatedTarget;
              if (
                !(nextTarget instanceof Node) ||
                !event.currentTarget.contains(nextTarget)
              ) {
                setDragging(false);
              }
            }}
            onDrop={handleDrop}
          >
            <span className="cv-upload-icon" aria-hidden="true">
              ↑
            </span>
            <strong>{t("Drop one resume here")}</strong>
            <span>{t("PDF or DOCX · maximum 10 MB")}</span>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => inputRef.current?.click()}
            >
              {t("Browse files")}
            </button>
          </div>

          {file && (
            <div
              className="cv-file-list"
              role="group"
              aria-label={t("Selected resume file")}
            >
              <div className="cv-file-list-heading">
                <strong>{t("Selected resume file")}</strong>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setFile(null)}
                  disabled={uploading}
                >
                  {t("Remove")}
                </button>
              </div>
              <div className="cv-file-row">
                <span className="cv-file-type">
                  {file.name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX"}
                </span>
                <span className="cv-file-name" title={file.name}>
                  {file.name}
                </span>
                <span className="muted-cell">{formatFileSize(file.size)}</span>
              </div>
            </div>
          )}

          {uploadFeedback && (
            <p
              className={`cv-upload-message cv-upload-message-${uploadFeedback.kind}`}
              role={uploadFeedback.kind === "error" ? "alert" : "status"}
              aria-live={
                uploadFeedback.kind === "error" ? "assertive" : "polite"
              }
            >
              {renderFeedback(uploadFeedback, t)}
            </p>
          )}

          <div className="cv-integration-note" role="note">
            <strong>{t("Auto-scan & extract pipeline")}</strong>
            <span>
              {t(
                "When you upload a PDF or DOCX file, TalentLens automatically parses the document, detects the candidate's name and email, extracts skills, work history, and education, and prepares the profile for job scoring.",
              )}
            </span>
          </div>
          {uploading && (
            <div
              className="upload-progress"
              role="progressbar"
              aria-label={t("Uploading…")}
              aria-busy="true"
            >
              <span />
            </div>
          )}
          <div className="cv-upload-footer">
            <span>
              {t(
                "Files are sent only after you choose Upload resume. Use synthetic data while developing.",
              )}
            </span>
            <button
              className="button button-primary"
              type="submit"
              disabled={!file || uploading}
            >
              {uploading ? t("Uploading…") : t("Upload resume")}
            </button>
          </div>
        </form>

        <section className="cv-library" aria-labelledby="cv-library-title">
          <div className="cv-library-heading">
            <div>
              <h3 id="cv-library-title">{t("Uploaded resumes")}</h3>
              {cvPage && (
                <p>
                  {t("{{count}} resumes in this workspace", {
                    count: cvPage.total,
                  })}
                </p>
              )}
            </div>
            <button
              className="text-link"
              type="button"
              onClick={handleRefresh}
              disabled={loadingCvs}
            >
              {loadingCvs ? t("Refreshing…") : t("Refresh")}
            </button>
          </div>

          {loadingCvs && !cvPage && (
            <p className="cv-library-state" role="status">
              {t("Loading resumes…")}
            </p>
          )}
          {listFeedback && (
            <p
              className="cv-upload-message cv-upload-message-error"
              role="alert"
              aria-live="assertive"
            >
              {renderFeedback(listFeedback, t)}
            </p>
          )}
          {!loadingCvs && !listFeedback && cvPage?.items.length === 0 && (
            <p className="cv-library-state">
              {t("No resumes have been uploaded yet.")}
            </p>
          )}
          {cvPage && cvPage.items.length > 0 && (
            <div className="cv-library-list">
              {cvPage.items.map((cv) => (
                <button
                  type="button"
                  className={`cv-library-row cv-library-row-button${selectedCvId === cv.id ? " cv-library-row-active" : ""}`}
                  key={cv.id}
                  aria-pressed={selectedCvId === cv.id}
                  onClick={() => setSelectedCvId(cv.id)}
                >
                  <span className={`cv-status cv-status-${cv.status}`}>
                    {t(statusLabels[cv.status])}
                  </span>
                  <div className="cv-library-copy">
                    <strong>{cv.candidate_name}</strong>
                    <span title={cv.file_name}>{cv.file_name}</span>
                  </div>
                  <span className="cv-library-size">
                    {formatFileSize(cv.file_size)}
                  </span>
                  <time dateTime={cv.created_at}>
                    {formatDate(cv.created_at, language)}
                  </time>
                </button>
              ))}
            </div>
          )}
          {cvPage && cvPage.page < cvPage.total_pages && (
            <button
              className="button button-secondary cv-load-more"
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? t("Loading…") : t("Load more")}
            </button>
          )}
        </section>
      </section>

      {selectedCvId !== null ? (
        <CvDetailPanel
          cvId={selectedCvId}
          initialSummary={
            cvPage?.items.find((item) => item.id === selectedCvId) ??
            (lastUploadedCv?.id === selectedCvId ? lastUploadedCv : null)
          }
          targetJobId={targetJobId}
          refreshKey={refreshVersion}
          onClose={() => setSelectedCvId(null)}
          onChanged={() => setRefreshVersion((version) => version + 1)}
        />
      ) : (
        <aside className="panel cv-privacy-panel">
          <p className="eyebrow">{t("PRIVACY BY DESIGN")}</p>
          <h2>{t("Resumes contain personal information")}</h2>
          <p>
            {t(
              "Use synthetic files while developing. Do not commit resumes or personal data to Git.",
            )}
          </p>
          <ul>
            <li>
              {t(
                "Only PDF and DOCX files up to 10 MB are accepted by this form.",
              )}
            </li>
            <li>
              {t(
                "A file leaves this browser only after you submit the upload form.",
              )}
            </li>
            <li>
              {t(
                "The backend remains responsible for file validation, storage, and access control.",
              )}
            </li>
          </ul>
        </aside>
      )}
    </div>
  );
}
