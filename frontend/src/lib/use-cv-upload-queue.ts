"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TranslationKey } from "@/i18n/messages";
import { CvsApiError, uploadCvFile, type CvSummary } from "@/lib/cvs-api";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
/** Files kept in the browser queue at once. The backend has no hard cap for single uploads. */
export const MAX_QUEUE_FILES = 50;
/** Parallel requests. Kept small so a local SQLite backend is not flooded. */
const UPLOAD_CONCURRENCY = 3;

export type Feedback = {
  kind: "error" | "info";
  key?: TranslationKey;
  values?: Record<string, string | number>;
  text?: string;
};

export type QueueStatus =
  | "queued"
  | "uploading"
  | "uploaded"
  | "resynced"
  | "failed";

export type QueueItem = {
  key: string;
  file: File;
  status: QueueStatus;
  cv?: CvSummary;
  error?: Feedback;
};

export type AddFilesReport = {
  added: number;
  unsupported: string[];
  oversized: string[];
  duplicates: number;
  overflow: number;
};

export type RunOptions = {
  jobId: number | null;
  /** Applied only when the run uploads exactly one file. */
  candidateName?: string;
  candidateEmail?: string;
};

export type RunSummary = {
  succeeded: QueueItem[];
  failed: number;
  /** Set when the run was halted by an error that would fail every remaining file. */
  fatal: Feedback | null;
};

export function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || name.endsWith(".docx");
}

function fileKey(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

export function getApiErrorFeedback(error: unknown): Feedback {
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
      return { kind: "error", key: "The CV API route is not available yet." };
    }
    if (error.status === 401) {
      return { kind: "error", key: "Sign in to access the CV library." };
    }
    if (error.status === 403) {
      return {
        kind: "error",
        key: "Your role cannot upload resumes. Ask an admin for recruiter access.",
      };
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

/** Errors that will fail every other file too, so the queue stops instead of retrying blindly. */
function isFatal(error: unknown): boolean {
  return (
    error instanceof CvsApiError &&
    (error.status === 0 || error.status === 401 || error.status === 403)
  );
}

export function useCvUploadQueue(onRunComplete: (summary: RunSummary) => void) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const itemsRef = useRef<QueueItem[]>([]);
  const runningRef = useRef(false);
  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const onCompleteRef = useRef(onRunComplete);

  useEffect(() => {
    onCompleteRef.current = onRunComplete;
  }, [onRunComplete]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Keep the ref authoritative so workers and handlers see changes synchronously.
  const commit = useCallback(
    (update: (current: QueueItem[]) => QueueItem[]) => {
      itemsRef.current = update(itemsRef.current);
      setItems(itemsRef.current);
    },
    [],
  );

  const patch = useCallback(
    (key: string, changes: Partial<QueueItem>) => {
      commit((current) =>
        current.map((item) =>
          item.key === key ? { ...item, ...changes } : item,
        ),
      );
    },
    [commit],
  );

  const addFiles = useCallback(
    (incoming: FileList | File[]): AddFilesReport => {
      const report: AddFilesReport = {
        added: 0,
        unsupported: [],
        oversized: [],
        duplicates: 0,
        overflow: 0,
      };
      const known = new Set(itemsRef.current.map((item) => item.key));
      const next: QueueItem[] = [];

      for (const file of Array.from(incoming)) {
        if (!isSupportedFile(file)) {
          report.unsupported.push(file.name);
          continue;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          report.oversized.push(file.name);
          continue;
        }
        const key = fileKey(file);
        if (known.has(key)) {
          report.duplicates += 1;
          continue;
        }
        if (itemsRef.current.length + next.length >= MAX_QUEUE_FILES) {
          report.overflow += 1;
          continue;
        }
        known.add(key);
        next.push({ key, file, status: "queued" });
      }

      report.added = next.length;
      if (next.length > 0) commit((current) => [...current, ...next]);
      return report;
    },
    [commit],
  );

  const remove = useCallback(
    (key: string) => {
      commit((current) =>
        current.filter(
          (item) => item.key !== key || item.status === "uploading",
        ),
      );
    },
    [commit],
  );

  const clearFinished = useCallback(() => {
    commit((current) =>
      current.filter(
        (item) => item.status !== "uploaded" && item.status !== "resynced",
      ),
    );
  }, [commit]);

  const clearAll = useCallback(() => {
    commit((current) => current.filter((item) => item.status === "uploading"));
  }, [commit]);

  const requeueFailed = useCallback(() => {
    commit((current) =>
      current.map((item) =>
        item.status === "failed"
          ? { ...item, status: "queued", error: undefined }
          : item,
      ),
    );
  }, [commit]);

  const stop = useCallback(() => {
    stopRef.current = true;
  }, []);

  const start = useCallback(
    async (options: RunOptions) => {
      if (runningRef.current) return;
      const pending = itemsRef.current.filter(
        (item) => item.status === "queued",
      );
      if (pending.length === 0) return;

      runningRef.current = true;
      stopRef.current = false;
      setRunning(true);
      const controller = new AbortController();
      abortRef.current = controller;

      const single = pending.length === 1;
      const claimed = new Set<string>();
      const succeeded: QueueItem[] = [];
      let failed = 0;
      let fatal: Feedback | null = null;

      const nextItem = () =>
        itemsRef.current.find(
          (item) => item.status === "queued" && !claimed.has(item.key),
        );

      const worker = async () => {
        for (;;) {
          if (stopRef.current || controller.signal.aborted) return;
          const item = nextItem();
          if (!item) return;
          claimed.add(item.key);
          patch(item.key, { status: "uploading", error: undefined });
          try {
            const result = await uploadCvFile(
              {
                file: item.file,
                jobId: options.jobId,
                candidateName: single ? options.candidateName : undefined,
                candidateEmail: single ? options.candidateEmail : undefined,
              },
              controller.signal,
            );
            const done: QueueItem = {
              ...item,
              status: result.resynced ? "resynced" : "uploaded",
              cv: result.cv,
              error: undefined,
            };
            succeeded.push(done);
            patch(item.key, done);
          } catch (error) {
            if (controller.signal.aborted) return;
            const feedback = getApiErrorFeedback(error);
            failed += 1;
            patch(item.key, { status: "failed", error: feedback });
            if (isFatal(error)) {
              fatal = feedback;
              stopRef.current = true;
            }
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(UPLOAD_CONCURRENCY, pending.length) }, () =>
          worker(),
        ),
      );

      runningRef.current = false;
      abortRef.current = null;
      if (controller.signal.aborted) return;
      setRunning(false);
      onCompleteRef.current({ succeeded, failed, fatal });
    },
    [patch],
  );

  return {
    items,
    running,
    addFiles,
    remove,
    clearFinished,
    clearAll,
    requeueFailed,
    start,
    stop,
  };
}
