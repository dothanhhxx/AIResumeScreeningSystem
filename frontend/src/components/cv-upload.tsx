"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];

function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CvUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");

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
        ? `${rejected} file${rejected === 1 ? " was" : "s were"} skipped. Choose PDF or DOCX files.`
        : supported.length
          ? "Files are selected in this browser only. They have not been uploaded."
          : "Choose at least one PDF or DOCX file.",
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
            <h2 id="cv-upload-title">Add candidate resumes</h2>
            <p>Choose PDF or DOCX files to prepare them for the CV pipeline.</p>
          </div>
        </div>

        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          onChange={handleFileChange}
          aria-label="Choose resume files"
        />
        <div
          className={`cv-dropzone${dragging ? " cv-dropzone-active" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              setDragging(false);
          }}
          onDrop={handleDrop}
        >
          <span className="cv-upload-icon" aria-hidden="true">
            ↑
          </span>
          <strong>Drop resume files here</strong>
          <span>PDF or DOCX</span>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            Browse files
          </button>
        </div>

        {message && (
          <p className="cv-upload-message" role="status">
            {message}
          </p>
        )}

        {files.length > 0 && (
          <div className="cv-file-list" aria-label="Selected resume files">
            <div className="cv-file-list-heading">
              <strong>{files.length} selected</strong>
              <button
                type="button"
                className="text-link"
                onClick={() => setFiles([])}
              >
                Clear all
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
                  aria-label={`Remove ${file.name}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="cv-integration-note" role="note">
          <strong>Upload is waiting for Person B&apos;s API contract.</strong>
          <span>
            Files stay in your browser. This page does not send or store resumes
            yet.
          </span>
        </div>
        <div className="cv-upload-footer">
          <span>
            Uploads remain disabled until the API endpoint, limits, and response
            fields are agreed.
          </span>
          <button
            className="button button-primary"
            type="button"
            disabled
            title="Waiting for the CV upload API contract"
          >
            Upload unavailable
          </button>
        </div>
      </section>

      <aside className="panel cv-privacy-panel">
        <p className="eyebrow">PRIVACY BY DESIGN</p>
        <h2>Resumes contain personal information</h2>
        <p>
          Use synthetic files while developing. Do not commit resumes or
          personal data to Git.
        </p>
        <ul>
          <li>Only PDF and DOCX are selected here.</li>
          <li>No file leaves this browser in this milestone.</li>
          <li>
            Server-side type, size, and access checks must be added with Person
            B&apos;s API.
          </li>
        </ul>
      </aside>
    </div>
  );
}
