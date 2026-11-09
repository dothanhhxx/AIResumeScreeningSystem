"use client";

import { useState } from "react";
import styles from "./ranking-evidence-demo.module.css";
import { useI18n } from "@/i18n/provider";

const demoCandidate = {
  name: "Linh Tran (synthetic profile)",
  email: "linh.tran@example.test",
} as const;

const demoEvidence = [
  {
    category: "Required",
    requirement: "Python",
    status: "found",
    statusLabel: "Evidence found",
    quote:
      "Built a data-cleaning pipeline with Python for a sales analytics project.",
    source: "CV sample · page 2 · Project",
  },
  {
    category: "Required",
    requirement: "SQL",
    status: "unclear",
    statusLabel: "Needs verification",
    quote: "Queried relational datasets and prepared weekly reports.",
    source: "CV sample · page 2 · Experience",
  },
  {
    category: "Preferred",
    requirement: "Docker",
    status: "not-found",
    statusLabel: "Not found in CV",
    quote: null,
    source: null,
  },
] as const;

export function RankingEvidenceDemo() {
  const [identityHidden, setIdentityHidden] = useState(true);
  const { t } = useI18n();

  return (
    <section className={styles.preview} aria-labelledby="evidence-demo-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t("REVIEW WORKSPACE")}</p>
          <h2 id="evidence-demo-title">{t("Evidence-led review")}</h2>
          <p className={styles.subtitle}>
            {t(
              "Review each job requirement with CV evidence so recruiters can verify it.",
            )}
          </p>
        </div>
        <span className={styles.demoBadge}>{t("Demo · synthetic data")}</span>
      </header>

      <div className={styles.body}>
        <div className={styles.candidateBar}>
          <div className={styles.candidateIdentity}>
            <span className={styles.avatar} aria-hidden="true">
              {identityHidden ? "S" : "LT"}
            </span>
            <div>
              <strong>
                {identityHidden
                  ? t("Sample candidate 01")
                  : t(demoCandidate.name)}
              </strong>
              <span>
                {identityHidden
                  ? t("Identity details are hidden")
                  : demoCandidate.email}
              </span>
            </div>
          </div>

          <label className={styles.identityToggle}>
            <input
              type="checkbox"
              checked={identityHidden}
              onChange={(event) =>
                setIdentityHidden(event.currentTarget.checked)
              }
            />
            <span>{t("Hide identifying details")}</span>
          </label>
        </div>

        <div className={styles.evidenceHeading}>
          <div>
            <h3>{t("Evidence by requirement")}</h3>
            <p>
              {t(
                "Not found in the CV does not mean the candidate lacks the skill.",
              )}
            </p>
          </div>
          <span className={styles.noScore}>{t("No demo score is shown")}</span>
        </div>

        <ul className={styles.evidenceList}>
          {demoEvidence.map((item) => (
            <li className={styles.evidenceItem} key={item.requirement}>
              <div className={styles.requirement}>
                <span className={styles.category}>{t(item.category)}</span>
                <strong>{item.requirement}</strong>
                <span
                  className={`${styles.status} ${styles[`status_${item.status}`]}`}
                >
                  {t(item.statusLabel)}
                </span>
              </div>
              <div className={styles.evidence}>
                {item.quote ? (
                  <>
                    <blockquote>“{item.quote}”</blockquote>
                    <span className={styles.source}>{t(item.source)}</span>
                    {item.status === "unclear" && (
                      <span className={styles.reviewHint}>
                        {t(
                          "Recruiter should verify how relevant this experience is.",
                        )}
                      </span>
                    )}
                  </>
                ) : (
                  <p className={styles.noEvidence}>
                    {t("No relevant evidence was found in this sample CV.")}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>

        <p className={styles.disclaimer}>
          {t(
            "This is an interface preview only. It does not call the API or show real AI results. The hide option covers only the displayed name and email; it does not fully anonymize CV content.",
          )}
        </p>
      </div>
    </section>
  );
}
