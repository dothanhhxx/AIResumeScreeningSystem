"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { useI18n } from "@/i18n/provider";
import type { TranslationKey } from "@/i18n/messages";
import styles from "./landing-process.module.css";

type StepVisual = "jd" | "upload" | "parse" | "match" | "rank" | "decide";

interface ProcessStep {
  visual: StepVisual;
  icon: IconName;
  title: TranslationKey;
  caption: TranslationKey;
  detail: TranslationKey;
  where: TranslationKey;
}

/** The real recruiter flow in the workspace, in the order a team performs it. */
const PROCESS_STEPS: ProcessStep[] = [
  {
    visual: "jd",
    icon: "jobs",
    title: "Create the job",
    caption:
      "Paste the JD; required skills and minimum experience become the checklist.",
    detail:
      "Add the title, required and preferred skills, minimum years of experience and education. Every resume is later read against exactly this checklist.",
    where: "Job descriptions",
  },
  {
    visual: "upload",
    icon: "upload",
    title: "Upload resumes",
    caption: "Drop PDF or DOCX files, one by one or in a batch.",
    detail:
      "Upload straight into a job or into the shared CV library. Files that cannot be read are flagged instead of silently scored.",
    where: "CV library",
  },
  {
    visual: "parse",
    icon: "cvs",
    title: "Read & structure",
    caption:
      "Text is extracted and split into skills, experience and education.",
    detail:
      "TalentLens parses each resume into structured sections, so the same fields can be compared across every candidate.",
    where: "CV library",
  },
  {
    visual: "match",
    icon: "sparkle",
    title: "Match requirements",
    caption: "Rules, semantic similarity and an LLM check each requirement.",
    detail:
      "Each requirement is marked found, unclear or missing, and every “found” is backed by a quote from the CV.",
    where: "Candidate review",
  },
  {
    visual: "rank",
    icon: "rankings",
    title: "Rank with evidence",
    caption: "Candidates are ordered by a 0–100 fit score you can break down.",
    detail:
      "The score splits into skills, experience and education. Gaps to verify and suggested interview questions sit next to it.",
    where: "Candidate review",
  },
  {
    visual: "decide",
    icon: "check",
    title: "Decide & record",
    caption:
      "Your team shortlists, interviews or rejects; every action is logged.",
    detail:
      "AI never makes the call. Decisions and score overrides are saved with a reason in the audit log.",
    where: "Audit log",
  },
];

const AUTOPLAY_MS = 3200;

export function LandingProcess() {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % PROCESS_STEPS.length);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [playing]);

  const step = PROCESS_STEPS[active];

  return (
    <section
      className={styles.section}
      id="how-it-works"
      aria-labelledby="process-title"
    >
      <div className={styles.intro}>
        <p className={styles.eyebrow}>{t("Screening workflow")}</p>
        <h2 className={styles.title} id="process-title">
          <span>{t("From job description")}</span>
          <span className={styles.titleAccent}>{t("to shortlist")}</span>
        </h2>
        <p className={styles.lede}>
          {t(
            "Six steps your recruiters already take. TalentLens does the reading and cross-checking; people keep the decision.",
          )}
        </p>

        <div className={styles.guide} aria-live="polite">
          <div className={styles.guideHead}>
            <span className={styles.guideNumber}>
              {String(active + 1).padStart(2, "0")}
            </span>
            <strong>{t(step.title)}</strong>
          </div>
          <p>{t(step.detail)}</p>
          <span className={styles.guideWhere}>
            <Icon name={step.icon} size={14} />
            {t("In the workspace: {{page}}", { page: t(step.where) })}
          </span>
        </div>

        <div className={styles.actions}>
          <a className={styles.cta} href="#interactive-preview">
            {t("Try the interactive demo")}
            <Icon name="arrow" size={15} />
          </a>
          <button
            className={styles.playButton}
            type="button"
            aria-pressed={playing}
            onClick={() => setPlaying((value) => !value)}
          >
            <span aria-hidden="true" className={styles.playGlyph}>
              {playing ? "❚❚" : "▶"}
            </span>
            {playing ? t("Pause walkthrough") : t("Play walkthrough")}
          </button>
        </div>
      </div>

      <ol className={styles.grid}>
        {PROCESS_STEPS.map((item, index) => {
          const isActive = index === active;
          return (
            <li key={item.title} className={styles.item}>
              <button
                type="button"
                className={`${styles.card} ${isActive ? styles.cardActive : ""}`}
                aria-pressed={isActive}
                onClick={() => {
                  setActive(index);
                  setPlaying(false);
                }}
              >
                <span className={styles.cardHead}>
                  <span className={styles.number}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.cardTitle}>{t(item.title)}</span>
                </span>
                <span className={styles.visualWrap} aria-hidden="true">
                  <span className={styles.visual}>
                    <StepArt kind={item.visual} />
                  </span>
                  {index < PROCESS_STEPS.length - 1 && (
                    <span className={styles.arrow}>
                      <Icon name="arrow" size={16} />
                    </span>
                  )}
                </span>
                <span className={styles.caption}>{t(item.caption)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Small, decorative product vignettes — one per step. */
function StepArt({ kind }: { kind: StepVisual }) {
  switch (kind) {
    case "jd":
      return (
        <span className={styles.paper}>
          <span className={styles.paperTitle}>Product Analyst</span>
          <span className={styles.line} />
          <span className={styles.lineShort} />
          <span className={styles.chipRow}>
            <span className={styles.miniChip}>SQL</span>
            <span className={styles.miniChip}>Python</span>
            <span className={styles.miniChipMuted}>3+ yrs</span>
          </span>
        </span>
      );
    case "upload":
      return (
        <span className={styles.drop}>
          <span className={styles.dropIcon}>
            <Icon name="upload" size={18} />
          </span>
          <span className={styles.fileRow}>
            <span className={styles.fileTag}>PDF</span>
            <span className={styles.line} />
          </span>
          <span className={styles.fileRow}>
            <span className={styles.fileTagAlt}>DOCX</span>
            <span className={styles.line} />
          </span>
        </span>
      );
    case "parse":
      return (
        <span className={styles.paper}>
          <span className={styles.parseRow}>
            <span className={styles.parseLabel}>Skills</span>
            <span className={styles.lineHi} />
          </span>
          <span className={styles.parseRow}>
            <span className={styles.parseLabel}>Exp.</span>
            <span className={styles.lineHi} />
          </span>
          <span className={styles.parseRow}>
            <span className={styles.parseLabel}>Edu.</span>
            <span className={styles.lineShort} />
          </span>
        </span>
      );
    case "match":
      return (
        <span className={styles.paper}>
          <span className={styles.checkRow}>
            <span className={styles.dotFound}>✓</span>SQL
          </span>
          <span className={styles.checkRow}>
            <span className={styles.dotFound}>✓</span>Python
          </span>
          <span className={styles.checkRow}>
            <span className={styles.dotReview}>?</span>A/B tests
          </span>
        </span>
      );
    case "rank":
      return (
        <span className={styles.paper}>
          {[86, 74, 62].map((score, index) => (
            <span key={score} className={styles.rankRow}>
              <span className={styles.rankNo}>#{index + 1}</span>
              <span className={styles.rankTrack}>
                <span style={{ width: `${score}%` }} />
              </span>
              <span className={styles.rankScore}>{score}</span>
            </span>
          ))}
        </span>
      );
    case "decide":
      return (
        <span className={styles.paper}>
          <span className={styles.decideRow}>
            <span className={styles.decidePrimary}>✓ Shortlist</span>
            <span className={styles.decideGhost}>Interview</span>
          </span>
          <span className={styles.logRow}>
            <Icon name="shield" size={12} />
            <span className={styles.lineShort} />
          </span>
        </span>
      );
  }
}
