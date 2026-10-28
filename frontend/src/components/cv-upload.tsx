"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useI18n } from "@/i18n/provider";
import type { TranslationKey } from "@/i18n/messages";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];
type UploadMessage = {
  key: TranslationKey;
  values?: Record<string, string | number>;
};

function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CvUpload() {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState<UploadMessage | null>(null);

  function addFiles(incoming: FileList | File[]) {
    const selected = Array.from(incoming);
    const supported = selected.filter(isSupportedFile);
    const rejected = selected.length - supported.length;

    setFiles((current) => {
      const known = new Set(
        current.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
      );
      return [
        ...current,
        ...supported.filter(
          (file) =>
            !known.has(`${file.name}:${file.size}:${file.lastModified}`),
        ),
      ];
    });
    setMessage(
      rejected
        ? {
            key:
              rejected === 1
                ? "{{count}} file was skipped. Choose PDF or DOCX files."
                : "{{count}} files were skipped. Choose PDF or DOCX files.",
            values: { count: rejected },
          }
        : supported.length
          ? {
              key: "Files are selected in this browser only. They have not been uploaded.",
            }
          : { key: "Choose at least one PDF or DOCX file." },
    );
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
                "Choose PDF or DOCX files to prepare them for the CV pipeline.",
              )}
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          onChange={handleFileChange}
          aria-label={t("Choose resume files")}
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
          <strong>{t("Drop resume files here")}</strong>
          <span>PDF or DOCX</span>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            {t("Browse files")}
          </button>
        </div>

        {message && (
          <p className="cv-upload-message" role="status">
            {t(message.key, message.values)}
          </p>
        )}

        {files.length > 0 && (
          <div
            className="cv-file-list"
            role="group"
            aria-label={t("Selected resume files")}
          >
            <div className="cv-file-list-heading">
              <strong>
                {t("{{count}} selected", { count: files.length })}
              </strong>
              <button
                type="button"
                className="text-link"
                onClick={() => setFiles([])}
              >
                {t("Clear all")}
              </button>
            </div>
            {files.map((file) => (
              <div
                className="cv-file-row"
                key={`${file.name}:${file.size}:${file.lastModified}`}
              >
                <span className="cv-file-type">
                  {file.name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX"}
                </span>
                <span className="cv-file-name" title={file.name}>
                  {file.name}
                </span>
                <span className="muted-cell">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  className="icon-button icon-button-danger"
                  onClick={() =>
                    setFiles((current) =>
                      current.filter((candidate) => candidate !== file),
                    )
                  }
                  aria-label={t("Remove {{name}}", { name: file.name })}
                >
                  {t("Remove")}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="cv-integration-note" role="note">
          <strong>{t("Upload is waiting for Person B's API contract.")}</strong>
          <span>
            {t(
              "Files stay in your browser. This page does not send or store resumes yet.",
            )}
          </span>
        </div>
        <div className="cv-upload-footer">
          <span>
            {t(
              "Uploads remain disabled until the API endpoint, limits, and response fields are agreed.",
            )}
          </span>
          <button
            className="button button-primary"
            type="button"
            disabled
            title={t("Waiting for the CV upload API contract")}
          >
            {t("Upload unavailable")}
          </button>
        </div>
      </section>

      <aside className="panel cv-privacy-panel">
        <p className="eyebrow">{t("PRIVACY BY DESIGN")}</p>
        <h2>{t("Resumes contain personal information")}</h2>
        <p>
          {t(
            "Use synthetic files while developing. Do not commit resumes or personal data to Git.",
          )}
        </p>
        <ul>
          <li>{t("Only PDF and DOCX are selected here.")}</li>
          <li>{t("No file leaves this browser in this milestone.")}</li>
          <li>
            {t(
              "Server-side type, size, and access checks must be added with Person B's API.",
            )}
          </li>
        </ul>
      </aside>
    </div>
  );
}
