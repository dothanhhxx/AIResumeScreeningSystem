"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { CvDetailPanel } from "@/components/cv-detail";
import { CvUploadQueue, formatFileSize } from "@/components/cv-upload-queue";
import { useI18n } from "@/i18n/provider";
import type { TranslationKey } from "@/i18n/messages";
import { useAuthSession } from "@/lib/auth-session";
import { listJobs, type Job } from "@/lib/jobs-api";
import {
  listCvs,
  PROCESSING_STATUSES,
  type CvPage,
  type CvStatus,
} from "@/lib/cvs-api";
import {
  getApiErrorFeedback,
  MAX_QUEUE_FILES,
  useCvUploadQueue,
  type AddFilesReport,
  type Feedback,
  type RunSummary,
} from "@/lib/use-cv-upload-queue";

const CV_PAGE_SIZE = 10;
const POLL_MS = 3000;

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

function formatDate(value: string, language: "en" | "vi"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
  }).format(date);
}

function renderFeedback(
  feedback: Feedback,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string,
) {
  if (feedback.key) return t(feedback.key, feedback.values);
  return feedback.text ?? t("Something went wrong. Please try again.");
}

function describeAddReport(report: AddFilesReport): Feedback | null {
  const skipped = [...report.unsupported, ...report.oversized];
  if (report.added === 0 && skipped.length === 1) {
    return {
      kind: "error",
      key:
        report.unsupported.length === 1
          ? "Choose a PDF or DOCX resume."
          : "The selected file exceeds the 10 MB limit.",
    };
  }
  if (skipped.length > 0) {
    return {
      kind: "error",
      key: "Skipped {{count}} files (only PDF or DOCX up to 10 MB): {{names}}",
      values: { count: skipped.length, names: skipped.join(", ") },
    };
  }
  if (report.overflow > 0) {
    return {
      kind: "error",
      key: "The queue holds up to {{max}} files. {{count}} files were not added.",
      values: { max: MAX_QUEUE_FILES, count: report.overflow },
    };
  }
  if (report.added === 0 && report.duplicates > 0) {
    return { kind: "info", key: "These files are already in the queue." };
  }
  if (report.added <= 1) return null;
  return {
    kind: "info",
    key: "Added {{count}} resumes to the queue. Files stay in this browser until you upload them.",
    values: { count: report.added },
  };
}

export function CvUpload({
  requestedCvId = null,
  requestedJobId = null,
}: {
  requestedCvId?: number | null;
  requestedJobId?: number | null;
}) {
  const { t, language } = useI18n();
  const { session } = useAuthSession();
  const canUpload = session?.user.role !== "viewer";
  const inputRef = useRef<HTMLInputElement>(null);
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [targetJobId, setTargetJobId] = useState<number | null>(requestedJobId);
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const jobsRequestedRef = useRef(false);
  const [dragging, setDragging] = useState(false);
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

  const handleRunComplete = useCallback(
    ({ succeeded, failed, fatal }: RunSummary) => {
      const first = succeeded[0]?.cv;
      if (fatal) {
        setUploadFeedback(fatal);
      } else if (succeeded.length === 1 && failed === 0 && first) {
        setUploadFeedback(
          succeeded[0].status === "resynced"
            ? {
                kind: "info",
                key: "{{name}} was already in the library, so CV #{{id}} was re-scanned.",
                values: { name: first.candidate_name, id: first.id },
              }
            : {
                kind: "info",
                key: "Uploaded {{name}} as CV #{{id}}. Current status: {{status}}.",
                values: {
                  name: first.candidate_name,
                  id: first.id,
                  status: t(statusLabels[first.status]),
                },
              },
        );
      } else if (failed === 0) {
        setUploadFeedback({
          kind: "info",
          key: "All {{count}} resumes were uploaded and queued for scanning.",
          values: { count: succeeded.length },
        });
      } else {
        setUploadFeedback({
          kind: "error",
          key: "{{ok}} resumes uploaded, {{failed}} failed. Check the highlighted files and retry.",
          values: { ok: succeeded.length, failed },
        });
      }

      if (succeeded.length === 0) return;
      setCandidateName("");
      setCandidateEmail("");
      if (succeeded.length === 1 && first) {
        setLastUploadedCv(first);
        pendingSelectCvIdRef.current = first.id;
      }
      setLoadingCvs(true);
      setRefreshVersion((version) => version + 1);
    },
    [t],
  );

  const queue = useCvUploadQueue(handleRunComplete);
  const pendingCount = queue.items.filter(
    (item) => item.status === "queued",
  ).length;
  const doneCount = queue.items.filter(
    (item) =>
      item.status === "uploaded" ||
      item.status === "resynced" ||
      item.status === "failed",
  ).length;
  // Name/email overrides only make sense when exactly one file is going up.
  const singleFileMode = pendingCount <= 1 && !queue.running;

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
        setListFeedback(null);
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
    if (jobsRequestedRef.current) return;
    jobsRequestedRef.current = true;
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
    if (requestedJobId !== null) {
      ensureJobsLoaded();
    }
  }, [requestedJobId]);

  function addFiles(incoming: FileList | File[]) {
    if (Array.from(incoming).length === 0) return;
    setUploadFeedback(describeAddReport(queue.addFiles(incoming)));
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

  function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingCount === 0 || queue.running) return;
    setUploadFeedback(null);
    void queue.start({
      jobId: targetJobId,
      candidateName: singleFileMode ? candidateName : undefined,
      candidateEmail: singleFileMode ? candidateEmail : undefined,
    });
  }

  function handleRetryFailed() {
    queue.requeueFailed();
    setUploadFeedback(null);
    void queue.start({ jobId: targetJobId });
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

  const submitLabel = queue.running
    ? t("Uploading {{done}}/{{total}}…", {
        done: doneCount,
        total: queue.items.length,
      })
    : pendingCount > 1
      ? t("Upload {{count}} resumes", { count: pendingCount })
      : t("Upload resume");

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
                "Drop one or many PDF/DOCX resumes — TalentLens scans and records each candidate's details automatically.",
              )}
            </p>
          </div>
        </div>

        {!canUpload ? (
          <p className="cv-integration-note" role="note">
            {t(
              "Your role is read-only. Ask an admin or recruiter to upload resumes.",
            )}
          </p>
        ) : (
          <form className="cv-upload-form" onSubmit={handleUpload}>
            <label className="form-field">
              <span>{t("Target job description (optional)")}</span>
              <select
                name="job_id"
                value={targetJobId ?? ""}
                disabled={queue.running}
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
                  {availableJobs.find((job) => job.id === targetJobId)
                    ?.title ?? `${t("Job")} #${targetJobId}`}
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

            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              multiple
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
              <strong>{t("Drop resumes here — select as many as you need")}</strong>
              <span>
                {t("PDF or DOCX · up to 10 MB each · {{max}} files per batch", {
                  max: MAX_QUEUE_FILES,
                })}
              </span>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => inputRef.current?.click()}
              >
                {queue.items.length > 0 ? t("Add more files") : t("Browse files")}
              </button>
            </div>

            <CvUploadQueue
              items={queue.items}
              running={queue.running}
              onRemove={queue.remove}
              onClearFinished={queue.clearFinished}
              onClearAll={() => {
                queue.clearAll();
                setUploadFeedback(null);
              }}
              onRetryFailed={handleRetryFailed}
              onView={setSelectedCvId}
              renderFeedback={(feedback) => renderFeedback(feedback, t)}
            />

            {singleFileMode ? (
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
            ) : (
              <p className="cv-integration-note" role="note">
                <strong>{t("Batch mode")}</strong>
                <span>
                  {t(
                    "Each candidate's name and email are detected from their own CV. Upload a single file if you want to enter them manually.",
                  )}
                </span>
              </p>
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

            <div className="cv-upload-footer">
              <span>
                {queue.running
                  ? t(
                      "Uploading 3 files at a time. You can keep adding files to the queue.",
                    )
                  : t(
                      "Files are sent only after you choose Upload. Use synthetic data while developing.",
                    )}
              </span>
              <div className="cv-upload-actions">
                {queue.running && (
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={queue.stop}
                  >
                    {t("Stop after current")}
                  </button>
                )}
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={pendingCount === 0 || queue.running}
                  aria-busy={queue.running}
                >
                  {submitLabel}
                </button>
              </div>
            </div>

            <div className="cv-integration-note" role="note">
              <strong>{t("Auto-scan & extract pipeline")}</strong>
              <span>
                {t(
                  "When you upload a PDF or DOCX file, TalentLens automatically parses the document, detects the candidate's name and email, extracts skills, work history, and education, and prepares the profile for job scoring.",
                )}
              </span>
            </div>
          </form>
        )}

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
          key={selectedCvId}
          cvId={selectedCvId}
          initialSummary={
            cvPage?.items.find((item) => item.id === selectedCvId) ??
            (lastUploadedCv?.id === selectedCvId ? lastUploadedCv : null) ??
            queue.items.find((item) => item.cv?.id === selectedCvId)?.cv ??
            null
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
