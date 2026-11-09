"use client";

import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/i18n/provider";
import type { TranslationKey } from "@/i18n/messages";
import type { CvStatus } from "@/lib/cvs-api";
import styles from "./pipeline-steps.module.css";

const STEPS: TranslationKey[] = [
  "Uploaded",
  "Text read",
  "Details extracted",
  "Scored",
];

/** For each backend status: how many steps are finished, and which one is running. */
const PROGRESS: Record<
  Exclude<CvStatus, "error">,
  { done: number; running: boolean }
> = {
  uploaded: { done: 1, running: false },
  parsing: { done: 1, running: true },
  parsed: { done: 2, running: false },
  extracting: { done: 2, running: true },
  extracted: { done: 3, running: false },
  scoring: { done: 3, running: true },
  scored: { done: 4, running: false },
};

/** The AI pipeline for one CV, as a four-step tracker that follows the live status. */
export function PipelineSteps({ status }: { status: CvStatus }) {
  const { t } = useI18n();
  if (status === "error") return null;
  const { done, running } = PROGRESS[status];

  return (
    <ol className={styles.steps} aria-label={t("Processing steps")}>
      {STEPS.map((label, index) => {
        const state =
          index < done
            ? "done"
            : index === done && running
              ? "running"
              : "todo";
        return (
          <li
            key={label}
            className={styles.step}
            data-state={state}
            aria-current={state === "running" ? "step" : undefined}
          >
            <span className={styles.dot} aria-hidden="true">
              {state === "done" ? <Icon name="check" size={12} /> : null}
            </span>
            <span className={styles.label}>
              {t(label)}
              <span className="sr-only">
                {state === "done"
                  ? ` (${t("done")})`
                  : state === "running"
                    ? ` (${t("in progress")})`
                    : ` (${t("not started")})`}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
