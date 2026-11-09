"use client";

import { useI18n } from "@/i18n/provider";
import type { TranslationKey } from "@/i18n/messages";
import type {
  Feedback,
  QueueItem,
  QueueStatus,
} from "@/hooks/use-cv-upload-queue";
import styles from "./cv-upload-queue.module.css";

const statusLabels: Record<QueueStatus, TranslationKey> = {
  queued: "Queued",
  uploading: "Uploading…",
  uploaded: "Uploaded",
  resynced: "Re-synced",
  failed: "Upload failed",
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusGlyph({ status }: { status: QueueStatus }) {
  if (status === "uploading") {
    return <span className={styles.spinner} aria-hidden="true" />;
  }
  const path =
    status === "uploaded"
      ? "M5 12.5l4.2 4.2L19 7"
      : status === "resynced"
        ? "M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"
        : status === "failed"
          ? "M12 7.5v5.5M12 16.5v.01"
          : "M12 7v5l3 2";
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {(status === "queued" || status === "failed") && (
        <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
      )}
      <path d={path} />
    </svg>
  );
}

export function CvUploadQueue({
  items,
  running,
  onRemove,
  onClearFinished,
  onClearAll,
  onRetryFailed,
  onView,
  renderFeedback,
}: {
  items: QueueItem[];
  running: boolean;
  onRemove: (key: string) => void;
  onClearFinished: () => void;
  onClearAll: () => void;
  onRetryFailed: () => void;
  onView: (cvId: number) => void;
  renderFeedback: (feedback: Feedback) => string;
}) {
  const { t } = useI18n();
  if (items.length === 0) return null;

  const count = (status: QueueStatus) =>
    items.filter((item) => item.status === status).length;
  const uploaded = count("uploaded");
  const resynced = count("resynced");
  const failed = count("failed");
  const done = uploaded + resynced + failed;
  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);
  const showProgress = running || done > 0;
  const percent = Math.round((done / items.length) * 100);

  return (
    <section className={styles.queue} aria-labelledby="cv-queue-title">
      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 id="cv-queue-title">{t("Upload queue")}</h3>
          <span>
            {t("{{count}} files · {{size}}", {
              count: items.length,
              size: formatFileSize(totalBytes),
            })}
          </span>
        </div>
        <div className={styles.headerActions}>
          {failed > 0 && !running && (
            <button
              type="button"
              className={styles.ghostButton}
              onClick={onRetryFailed}
            >
              {t("Retry failed ({{count}})", { count: failed })}
            </button>
          )}
          {uploaded + resynced > 0 && (
            <button
              type="button"
              className={styles.ghostButton}
              onClick={onClearFinished}
            >
              {t("Clear uploaded")}
            </button>
          )}
          {!running && (
            <button
              type="button"
              className={styles.ghostButton}
              onClick={onClearAll}
            >
              {t("Clear all")}
            </button>
          )}
        </div>
      </header>

      {showProgress && (
        <div className={styles.progressBlock}>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label={t("Upload progress")}
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={done}
            aria-valuetext={t("{{done}} of {{total}} processed", {
              done,
              total: items.length,
            })}
          >
            <span
              className={styles.progressFill}
              style={{ transform: `scaleX(${percent / 100})` }}
            />
          </div>
          <p className={styles.progressMeta} aria-live="polite">
            <span>
              {t("{{done}} of {{total}} processed", {
                done,
                total: items.length,
              })}
            </span>
            <span className={styles.tallies}>
              {uploaded > 0 && (
                <span className={styles.tallyOk}>
                  {t("{{count}} uploaded", { count: uploaded })}
                </span>
              )}
              {resynced > 0 && (
                <span className={styles.tallyInfo}>
                  {t("{{count}} re-synced", { count: resynced })}
                </span>
              )}
              {failed > 0 && (
                <span className={styles.tallyError}>
                  {t("{{count}} failed", { count: failed })}
                </span>
              )}
            </span>
          </p>
        </div>
      )}

      <ul className={styles.list} aria-label={t("Selected resume files")}>
        {items.map((item) => {
          const isPdf = item.file.name.toLowerCase().endsWith(".pdf");
          const canRemove =
            item.status === "queued" || item.status === "failed";
          const cvId = item.cv?.id;
          return (
            <li
              key={item.key}
              className={`${styles.row} ${styles[`row_${item.status}`]}`}
            >
              <span
                className={`${styles.fileType} ${isPdf ? styles.pdf : styles.docx}`}
                aria-hidden="true"
              >
                {isPdf ? "PDF" : "DOCX"}
              </span>
              <div className={styles.fileCopy}>
                <span className={styles.fileName} title={item.file.name}>
                  {item.file.name}
                </span>
                <span className={styles.fileMeta}>
                  {formatFileSize(item.file.size)}
                  {item.cv && item.cv.candidate_name
                    ? ` · ${item.cv.candidate_name}`
                    : ""}
                </span>
                {item.status === "failed" && item.error && (
                  <span className={styles.rowError}>
                    {renderFeedback(item.error)}
                  </span>
                )}
              </div>
              <span className={`${styles.status} ${styles[item.status]}`}>
                <StatusGlyph status={item.status} />
                {t(statusLabels[item.status])}
                {cvId !== undefined && ` · #${cvId}`}
              </span>
              <div className={styles.rowAction}>
                {cvId !== undefined ? (
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => onView(cvId)}
                    aria-label={t("View {{name}}", { name: item.file.name })}
                  >
                    {t("View CV")}
                  </button>
                ) : canRemove ? (
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => onRemove(item.key)}
                    aria-label={t("Remove {{name}}", { name: item.file.name })}
                  >
                    <svg
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
