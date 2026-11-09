"use client";

import Link from "next/link";
import { useState } from "react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { BrandLogo } from "@/components/ui/brand-logo";
import { useI18n } from "@/i18n/provider";
import { demoCandidates, demoCvLibrary, demoJobs } from "@/lib/demo-fixtures";
import styles from "./demo-workspace.module.css";

type DemoView = "overview" | "jobs" | "cvs" | "review";

const navigation = [
  { id: "overview", label: "Overview", shortLabel: "01" },
  { id: "jobs", label: "Job descriptions", shortLabel: "02" },
  { id: "cvs", label: "CV library", shortLabel: "03" },
  { id: "review", label: "Candidate review", shortLabel: "04" },
] as const satisfies { id: DemoView; label: string; shortLabel: string }[];

export function DemoWorkspace() {
  const { t } = useI18n();
  const [activeView, setActiveView] = useState<DemoView>("overview");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(
    demoCandidates[0].id,
  );
  const selectedCandidate =
    demoCandidates.find((candidate) => candidate.id === selectedCandidateId) ??
    demoCandidates[0];

  return (
    <main className={styles.demoShell}>
      <header className={styles.header}>
        <div className={styles.headerFrame}>
          <div className={styles.brandGroup}>
            <Link
              className={styles.brand}
              href="/"
              aria-label="TalentLens demo"
            >
              <BrandLogo
                variant="dark"
                size="md"
                tagline={t("From resume noise to explainable hiring clarity.")}
              />
            </Link>
            <span className={styles.demoBadge}>{t("DEMO")}</span>
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.homeLink} href="/">
              {t("Home page")}
            </Link>
            <LanguageSwitcher variant="landing" />
            <Link className={styles.signInLink} href="/login">
              {t("Sign in to workspace")}
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>{t("READ-ONLY PRODUCT TOUR")}</p>
          <div className={styles.introRow}>
            <div>
              <h1>{t("Explore the TalentLens workspace")}</h1>
              <p className={styles.subtitle}>
                {t(
                  "See how job requirements, resume evidence, and human review fit together.",
                )}
              </p>
            </div>
            <span className={styles.sampleCount}>
              {t("Illustrative sample · not live AI output")}
            </span>
          </div>
        </section>

        <aside
          className={styles.safetyNotice}
          role="note"
          aria-label={t("Demo data notice")}
        >
          <span className={styles.noticeIcon} aria-hidden="true">
            i
          </span>
          <p>
            <strong>{t("Safe demo mode")}</strong>{" "}
            {t(
              "All people, resumes, jobs, and match indicators are invented examples. This page makes no API requests and does not save changes.",
            )}
          </p>
        </aside>

        <nav className={styles.navigation} aria-label={t("Demo sections")}>
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`${styles.navButton}${activeView === item.id ? ` ${styles.navButtonActive}` : ""}`}
              type="button"
              aria-pressed={activeView === item.id}
              onClick={() => setActiveView(item.id)}
            >
              <span className={styles.navNumber} aria-hidden="true">
                {item.shortLabel}
              </span>
              {t(item.label)}
            </button>
          ))}
        </nav>

        {activeView === "overview" && <OverviewView />}
        {activeView === "jobs" && <JobsView />}
        {activeView === "cvs" && <CvLibraryView />}
        {activeView === "review" && (
          <ReviewView
            selectedCandidate={selectedCandidate}
            onSelectCandidate={setSelectedCandidateId}
          />
        )}

        <footer className={styles.footer}>
          <div className={styles.footerBrandGroup}>
            <Link href="/" className={styles.footerBrandLink}>
              <BrandLogo
                variant="dark"
                size="sm"
                showTagline
                tagline={t("From resume noise to explainable hiring clarity.")}
              />
            </Link>
          </div>
          <div className={styles.footerActions}>
            <Link href="/">{t("Home page")}</Link>
            <span aria-hidden="true">·</span>
            <Link href="/login">{t("Go to the real workspace")}</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

function OverviewView() {
  const { t } = useI18n();
  const metrics = [
    { label: "Active roles", value: "03", detail: "Across two teams" },
    { label: "Sample CVs", value: "24", detail: "Invented demo records" },
    {
      label: "For human review",
      value: "06",
      detail: "Not automated decisions",
    },
  ] as const;

  return (
    <section className={styles.view} aria-labelledby="overview-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionEyebrow}>{t("WORKSPACE OVERVIEW")}</p>
          <h2 id="overview-title">
            {t("A clearer view of the hiring pipeline")}
          </h2>
        </div>
        <span className={styles.readOnlyPill}>{t("Read only")}</span>
      </div>

      <div className={styles.metricGrid}>
        {metrics.map((metric) => (
          <article className={styles.metricCard} key={metric.label}>
            <span>{t(metric.label)}</span>
            <strong>{metric.value}</strong>
            <small>{t(metric.detail)}</small>
          </article>
        ))}
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.sectionEyebrow}>{t("RECENT ROLES")}</p>
            <h3>{t("Job pipeline")}</h3>
          </div>
          <span>{t("Synthetic records")}</span>
        </div>
        <JobsTable />
      </div>

      <div className={styles.humanNote}>
        <span aria-hidden="true">✳</span>
        <p>
          <strong>
            {t("AI can organize evidence; people make hiring decisions.")}
          </strong>
          <br />
          {t(
            "A match indicator is only a prompt for review. It is not a recommendation to hire or reject.",
          )}
        </p>
      </div>
    </section>
  );
}

function JobsView() {
  const { t } = useI18n();

  return (
    <section className={styles.view} aria-labelledby="jobs-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionEyebrow}>{t("HIRING PIPELINE")}</p>
          <h2 id="jobs-title">{t("Example job descriptions")}</h2>
          <p className={styles.sectionDescription}>
            {t("Sample roles and candidate counts for a product walkthrough.")}
          </p>
        </div>
        <span className={styles.readOnlyPill}>{t("Read only")}</span>
      </div>
      <div className={styles.panel}>
        <JobsTable />
      </div>
    </section>
  );
}

function JobsTable() {
  const { t } = useI18n();

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t("ROLE")}</th>
            <th scope="col">{t("TEAM")}</th>
            <th scope="col">{t("CANDIDATES")}</th>
            <th scope="col">{t("STATUS")}</th>
            <th scope="col">{t("UPDATED")}</th>
          </tr>
        </thead>
        <tbody>
          {demoJobs.map((job) => (
            <tr key={job.title}>
              <th scope="row">
                <span className={styles.roleMark} aria-hidden="true">
                  {job.title.slice(0, 1)}
                </span>
                {t(job.title)}
              </th>
              <td>{t(job.team)}</td>
              <td>{t("{{count}} sample CVs", { count: job.candidates })}</td>
              <td>
                <span
                  className={`${styles.status} ${job.status === "Active" ? styles.statusActive : styles.statusReview}`}
                >
                  {t(job.status)}
                </span>
              </td>
              <td>{t(job.updated)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CvLibraryView() {
  const { t } = useI18n();

  return (
    <section className={styles.view} aria-labelledby="cvs-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionEyebrow}>{t("CANDIDATE PIPELINE")}</p>
          <h2 id="cvs-title">{t("Sample CV library")}</h2>
          <p className={styles.sectionDescription}>
            {t(
              "These invented profiles show how parsed resume details can be organized.",
            )}
          </p>
        </div>
        <span className={styles.readOnlyPill}>{t("No uploads in demo")}</span>
      </div>
      <div className={styles.cvGrid}>
        {demoCvLibrary.map((cv, index) => (
          <article className={styles.cvCard} key={cv.id}>
            <div className={styles.cvCardTop}>
              <span className={styles.candidateAvatar} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={styles.status}>{t(cv.state)}</span>
            </div>
            <h3>{t(cv.candidate)}</h3>
            <p>{t(cv.role)}</p>
            <div
              className={styles.skillList}
              aria-label={t("Sample extracted skills")}
            >
              {cv.skills.map((skill) => (
                <span key={skill}>{t(skill)}</span>
              ))}
            </div>
            <span className={styles.cvMeta}>
              {t("Synthetic resume · no personal details")}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReviewView({
  selectedCandidate,
  onSelectCandidate,
}: {
  selectedCandidate: (typeof demoCandidates)[number];
  onSelectCandidate: (candidateId: string) => void;
}) {
  const { t } = useI18n();

  return (
    <section className={styles.view} aria-labelledby="review-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionEyebrow}>{t("HUMAN REVIEW")}</p>
          <h2 id="review-title">{t("Review evidence, not just a number")}</h2>
          <p className={styles.sectionDescription}>
            {t(
              "Select a sample candidate to inspect requirement-level evidence.",
            )}
          </p>
        </div>
        <span className={styles.readOnlyPill}>{t("Illustrative only")}</span>
      </div>

      <div className={styles.reviewLayout}>
        <div
          className={styles.candidateList}
          aria-label={t("Sample candidates")}
        >
          {demoCandidates.map((candidate, index) => (
            <button
              className={`${styles.candidateButton}${candidate.id === selectedCandidate.id ? ` ${styles.candidateButtonActive}` : ""}`}
              key={candidate.id}
              type="button"
              aria-pressed={candidate.id === selectedCandidate.id}
              onClick={() => onSelectCandidate(candidate.id)}
            >
              <span className={styles.candidateAvatar} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={styles.candidateCopy}>
                <strong>{t(candidate.label)}</strong>
                <small>{t(candidate.stage)}</small>
              </span>
              <span
                className={styles.scorePill}
                aria-label={t("Illustrative indicator")}
              >
                {candidate.match}
              </span>
            </button>
          ))}
          <p className={styles.listFootnote}>
            {t("Example indicators do not represent a validated model score.")}
          </p>
        </div>

        <article className={styles.evidencePanel}>
          <header className={styles.evidenceHeader}>
            <div>
              <p className={styles.sectionEyebrow}>{t("SAMPLE EVIDENCE")}</p>
              <h3>{t(selectedCandidate.label)}</h3>
              <p>{t(selectedCandidate.role)}</p>
            </div>
            <div className={styles.scoreSummary}>
              <strong>{selectedCandidate.match}</strong>
              <span>{t("example only")}</span>
            </div>
          </header>

          <p className={styles.evidenceCaveat}>
            {t("A missing phrase is not proof that a candidate lacks a skill.")}
          </p>
          <div className={styles.evidenceList}>
            {selectedCandidate.evidence.map((item) => (
              <section className={styles.evidenceItem} key={item.requirement}>
                <div className={styles.evidenceItemHeading}>
                  <strong>{t(item.requirement)}</strong>
                  <span
                    className={
                      item.status === "Evidence found"
                        ? styles.evidenceFound
                        : styles.evidenceReview
                    }
                  >
                    {t(item.status)}
                  </span>
                </div>
                <blockquote>{t(item.excerpt)}</blockquote>
                <span className={styles.evidenceSource}>{t(item.source)}</span>
              </section>
            ))}
          </div>
          <p className={styles.humanReviewNotice}>
            {t(
              "The recruiter remains responsible for every real hiring decision.",
            )}
          </p>
        </article>
      </div>
    </section>
  );
}
