"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo, BrandMark } from "@/components/brand-logo";
import { Icon, type IconName } from "@/components/icon";
import { LandingProcess } from "@/components/landing-process";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/i18n/provider";
import type { TranslationKey } from "@/i18n/messages";
import { useAuthSession } from "@/lib/auth-session";
import styles from "./landing-page.module.css";

const HIGHLIGHTS: { icon: IconName; label: TranslationKey }[] = [
  { icon: "cvs", label: "Evidence quoted from the CV" },
  { icon: "rankings", label: "Ranked by fit to the job" },
  { icon: "scale", label: "People make the final call" },
];

const PRINCIPLES: {
  icon: IconName;
  title: TranslationKey;
  body: TranslationKey;
}[] = [
  {
    icon: "sparkle",
    title: "Explainable scores",
    body: "Every score breaks down into skills, experience and education, and shows which engine produced it.",
  },
  {
    icon: "users",
    title: "Identity hidden by default",
    body: "Reviewers compare candidates by evidence first. Names and emails stay hidden until someone chooses to show them.",
  },
  {
    icon: "shield",
    title: "Every action on record",
    body: "Uploads, matching runs and decisions are written to an audit log administrators can review.",
  },
];

const STORY_BADGES: {
  icon: IconName;
  title: TranslationKey;
  detail: TranslationKey;
}[] = [
  {
    icon: "cvs",
    title: "100% Quoted",
    detail: "Every matched requirement links to a CV excerpt",
  },
  {
    icon: "sparkle",
    title: "3-Signal Hybrid",
    detail: "Rule-based + Semantic + LLM verification",
  },
  {
    icon: "eye",
    title: "Blind by Default",
    detail: "Names & emails masked during initial review",
  },
  {
    icon: "shield",
    title: "Full Audit Trail",
    detail: "Every upload, run, and decision is logged",
  },
];

const PIPELINE_STAGES: {
  icon: IconName;
  title: TranslationKey;
  detail: TranslationKey;
}[] = [
  {
    icon: "upload",
    title: "01. Ingest & Parse",
    detail: "PDF & DOCX extraction into structured sections",
  },
  {
    icon: "sparkle",
    title: "02. Hybrid Matching",
    detail: "Rule checklist + semantic similarity + LLM quotes",
  },
  {
    icon: "eye",
    title: "03. Blind Evidence Review",
    detail: "Compare candidates by proof before revealing identity",
  },
  {
    icon: "check",
    title: "04. Auditable Decision",
    detail: "Shortlist, interview, or override with logged reasons",
  },
];

const RUN_STAGES: TranslationKey[] = [
  "Reading the CV",
  "Structuring skills & experience",
  "Checking each requirement",
  "Scoring & ranking",
];

const RUN_STAGE_MS = 650;

interface InteractiveCandidate {
  id: string;
  blindLabel: TranslationKey;
  realName: string;
  email: string;
  role: TranslationKey;
  score: number;
  tone: "high" | "mid" | "low";
  skillsScore: number;
  expScore: number;
  eduScore: number;
  evidence: {
    requirement: TranslationKey;
    status: "Evidence found" | "Needs human review" | "Not found in sample";
    excerpt: TranslationKey;
    source: TranslationKey;
  }[];
}

const INTERACTIVE_CANDIDATES: InteractiveCandidate[] = [
  {
    id: "cand-1",
    blindLabel: "Candidate 01",
    realName: "Linh Tran",
    email: "linh.tran@example.test",
    role: "Product Analyst",
    score: 86,
    tone: "high",
    skillsScore: 90,
    expScore: 84,
    eduScore: 82,
    evidence: [
      {
        requirement: "SQL",
        status: "Evidence found",
        excerpt:
          "Built SQL reports to monitor weekly activation and retention trends.",
        source: "Sample CV · Project experience",
      },
      {
        requirement: "Python",
        status: "Evidence found",
        excerpt:
          "Used Python to clean event data and automate recurring analysis.",
        source: "Sample CV · Technical skills",
      },
      {
        requirement: "Experiment design",
        status: "Needs human review",
        excerpt:
          "Supported an onboarding experiment; ownership of the test design is unclear.",
        source: "Sample CV · Work history",
      },
    ],
  },
  {
    id: "cand-2",
    blindLabel: "Candidate 02",
    realName: "Minh Pham",
    email: "minh.pham@example.test",
    role: "Product Analyst",
    score: 74,
    tone: "mid",
    skillsScore: 76,
    expScore: 78,
    eduScore: 68,
    evidence: [
      {
        requirement: "Experiment design",
        status: "Evidence found",
        excerpt:
          "Partnered with product managers to interpret A/B test outcomes.",
        source: "Sample CV · Work history",
      },
      {
        requirement: "SQL",
        status: "Evidence found",
        excerpt:
          "Maintained warehouse queries used in monthly product reviews.",
        source: "Sample CV · Work history",
      },
      {
        requirement: "Python",
        status: "Not found in sample",
        excerpt:
          "No Python experience is stated in the provided sample resume.",
        source: "Sample CV · Full text reviewed",
      },
    ],
  },
  {
    id: "cand-3",
    blindLabel: "Candidate 03",
    realName: "An Nguyen",
    email: "an.nguyen@example.test",
    role: "Product Analyst",
    score: 62,
    tone: "mid",
    skillsScore: 65,
    expScore: 58,
    eduScore: 70,
    evidence: [
      {
        requirement: "Python",
        status: "Evidence found",
        excerpt:
          "Prepared research datasets and reproducible analysis in Python.",
        source: "Sample CV · Education project",
      },
      {
        requirement: "SQL",
        status: "Needs human review",
        excerpt:
          "References relational data work without naming the query language.",
        source: "Sample CV · Education project",
      },
      {
        requirement: "Experiment design",
        status: "Not found in sample",
        excerpt: "No experiment design experience is stated in this sample.",
        source: "Sample CV · Full text reviewed",
      },
    ],
  },
];

export function LandingPage({ displayFont = "" }: { displayFont?: string }) {
  const { t } = useI18n();
  const { session } = useAuthSession();
  const signedIn = Boolean(session);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(
    INTERACTIVE_CANDIDATES[0].id,
  );
  const [hideIdentity, setHideIdentity] = useState<boolean>(true);
  // null = results visible; 0..n = index of the simulated pipeline stage running.
  const [runStage, setRunStage] = useState<number | null>(null);

  useEffect(() => {
    if (runStage === null) return;
    const timer = window.setTimeout(() => {
      setRunStage((stage) =>
        stage === null || stage >= RUN_STAGES.length - 1 ? null : stage + 1,
      );
    }, RUN_STAGE_MS);
    return () => window.clearTimeout(timer);
  }, [runStage]);

  const running = runStage !== null;

  const activeCandidate =
    INTERACTIVE_CANDIDATES.find((item) => item.id === selectedCandidateId) ??
    INTERACTIVE_CANDIDATES[0];
  const evidenceCounts = {
    found: activeCandidate.evidence.filter((e) => e.status === "Evidence found")
      .length,
    review: activeCandidate.evidence.filter(
      (e) => e.status === "Needs human review",
    ).length,
    missing: activeCandidate.evidence.filter(
      (e) => e.status === "Not found in sample",
    ).length,
  };

  return (
    <div className={`${styles.page} ${displayFont}`} id="top">
      <a className={styles.skip} href="#main">
        {t("Skip to content")}
      </a>

      <header className={styles.header}>
        <nav className={styles.headerFrame} aria-label={t("Main navigation")}>
          <Link
            className={styles.brand}
            href="/"
            aria-label={t("TalentLens home")}
          >
            <BrandLogo
              variant="dark"
              size="md"
              tagline={t("From resume noise to explainable hiring clarity.")}
            />
          </Link>
          <ul className={styles.navLinks}>
            <li>
              <a href="#how-it-works">{t("How it works")}</a>
            </li>
            <li>
              <a href="#interactive-preview">{t("Interactive preview")}</a>
            </li>
            <li>
              <a href="#principles">{t("Principles")}</a>
            </li>
            <li>
              <a href="#vision">{t("About us")}</a>
            </li>
            <li>
              <a href="#contact">{t("Contact & access")}</a>
            </li>
            <li>
              <Link href="/demo" className={styles.navLinkBoxed}>
                {t("Demo")}
              </Link>
            </li>
          </ul>
          <div className={styles.headerActions}>
            <LanguageSwitcher variant="landing" />
            <span className={styles.headerDivider} aria-hidden="true" />
            <Link
              className={styles.ctaSmall}
              href={signedIn ? "/dashboard" : "/login"}
            >
              {signedIn ? t("Open workspace") : t("Sign in")}
              <Icon name="arrow" size={15} />
            </Link>
          </div>
        </nav>
      </header>

      <main id="main">
        {/* ── 1. Hero ─────────────────────────────────────────────── */}
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroBody}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>
                {t("AI resume screening for hiring teams")}
              </p>
              <h1 className={styles.display} id="hero-title">
                <span>{t("Read every CV.")}</span>
                <span className={styles.displayAccent}>
                  {t("Decide with evidence.")}
                </span>
              </h1>
              <p className={styles.lede}>
                {t(
                  "TalentLens reads each resume, checks it against every requirement in your job description, and ranks candidates with quotes as proof. The decision always stays with your team.",
                )}
              </p>
              <div className={styles.heroActions}>
                <Link className={styles.cta} href="/demo">
                  {t("Explore the demo")}
                  <Icon name="arrow" size={16} />
                </Link>
                <Link
                  className={styles.ghost}
                  href={signedIn ? "/dashboard" : "/login"}
                >
                  {signedIn
                    ? t("Open workspace")
                    : t("Sign in to your workspace")}
                </Link>
              </div>
              <ul className={styles.highlights}>
                {HIGHLIGHTS.map((item) => (
                  <li key={item.label}>
                    <span className={styles.highlightIcon} aria-hidden="true">
                      <Icon name={item.icon} size={18} />
                    </span>
                    {t(item.label)}
                  </li>
                ))}
              </ul>
            </div>

            <ProductCollage />
          </div>
        </section>

        {/* ── 2. How It Works: numbered process grid ───────────────── */}
        <LandingProcess />

        {/* ── 3. Interactive Live Evidence Preview (Cream) ─────────── */}
        <section
          className={styles.interactiveSection}
          id="interactive-preview"
          aria-labelledby="interactive-title"
        >
          <div className={styles.interactiveInner}>
            <div className={styles.interactiveHeader}>
              <div>
                <p className={styles.eyebrowDark}>
                  {t("INTERACTIVE EVIDENCE PREVIEW")}
                </p>
                <h2 className={styles.storyTitle} id="interactive-title">
                  {t("Test-drive requirement matching right here")}
                </h2>
                <p className={styles.storyLede}>
                  {t(
                    "Switch roles, toggle blind review, and click any candidate to inspect how TalentLens quotes resume evidence without making hiring decisions for you.",
                  )}
                </p>
              </div>
              <div className={styles.interactiveControls}>
                <label className={styles.blindToggle}>
                  <input
                    type="checkbox"
                    checked={hideIdentity}
                    onChange={(e) => setHideIdentity(e.target.checked)}
                  />
                  <span
                    className={styles.blindToggleTrack}
                    aria-hidden="true"
                  />
                  <span>{t("Blind review (hide identity)")}</span>
                </label>
                <button
                  className={styles.runButton}
                  type="button"
                  disabled={running}
                  onClick={() => setRunStage(0)}
                >
                  <Icon name="sparkle" size={15} />
                  {running ? t("Analyzing…") : t("Run sample analysis")}
                </button>
              </div>
            </div>

            <div className={styles.interactiveGrid}>
              {/* Candidate selector column */}
              <div
                className={styles.interactiveList}
                role="group"
                aria-label={t("Sample candidates")}
              >
                <div className={styles.interactiveListHead}>
                  <span>{t("Ranked candidates")}</span>
                  <span className={styles.roleTag}>
                    {t("Product Analyst")}
                  </span>
                </div>
                {INTERACTIVE_CANDIDATES.map((cand, index) => {
                  const isSelected = cand.id === activeCandidate.id;
                  const displayName = hideIdentity
                    ? t(cand.blindLabel)
                    : cand.realName;
                  const displaySub = hideIdentity
                    ? t("Identity hidden")
                    : cand.email;
                  return (
                    <button
                      key={cand.id}
                      type="button"
                      className={`${styles.interactiveCandBtn} ${isSelected ? styles.interactiveCandBtnActive : ""}`}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedCandidateId(cand.id)}
                    >
                      <span className={styles.interactiveRank}>
                        #{index + 1}
                      </span>
                      <span className={styles.interactiveCandCopy}>
                        <strong>{displayName}</strong>
                        <small>{displaySub}</small>
                      </span>
                      <span
                        className={`${styles.chip} ${styles[cand.tone]}`}
                        aria-label={t("Score")}
                      >
                        {cand.score}
                      </span>
                    </button>
                  );
                })}
                <p className={styles.interactiveFootnote}>
                  {t(
                    "AI can organize evidence; people make hiring decisions.",
                  )}
                </p>
              </div>

              {/* Evidence detail card */}
              <article className={styles.interactiveDetail}>
                <header className={styles.interactiveDetailHead}>
                  <div>
                    <span className={styles.interactiveStatusPill}>
                      {hideIdentity
                        ? t("Identity hidden")
                        : t("Identity visible")}
                    </span>
                    <h3>
                      {hideIdentity
                        ? t(activeCandidate.blindLabel)
                        : activeCandidate.realName}
                    </h3>
                    <p>
                      {t(activeCandidate.role)}
                      {!hideIdentity ? ` · ${activeCandidate.email}` : ""}
                    </p>
                  </div>
                  <div className={styles.interactiveScoreBox}>
                    <strong>{activeCandidate.score}</strong>
                    <span>{t("match")}</span>
                  </div>
                </header>

                {running ? (
                  <ol
                    className={styles.runPipeline}
                    aria-label={t("Analysis progress")}
                    aria-live="polite"
                  >
                    {RUN_STAGES.map((stage, index) => {
                      const state =
                        index < (runStage ?? 0)
                          ? "done"
                          : index === runStage
                            ? "active"
                            : "waiting";
                      return (
                        <li
                          key={stage}
                          className={`${styles.runStage} ${styles[`runStage_${state}`]}`}
                        >
                          <span className={styles.runStageDot} aria-hidden="true">
                            {state === "done" ? "✓" : index + 1}
                          </span>
                          <span>{t(stage)}</span>
                          <small>
                            {state === "done"
                              ? t("Done")
                              : state === "active"
                                ? t("Running")
                                : t("Waiting")}
                          </small>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <>
                    <div
                      className={styles.gapSummary}
                      aria-label={t("Skill gap summary")}
                    >
                      <strong>
                        {t("{{found}} of {{total}} requirements met", {
                          found: evidenceCounts.found,
                          total: activeCandidate.evidence.length,
                        })}
                      </strong>
                      <span className={styles.evBadgeFound}>
                        {t("{{count}} with evidence", {
                          count: evidenceCounts.found,
                        })}
                      </span>
                      <span className={styles.evBadgeReview}>
                        {t("{{count}} to verify", {
                          count: evidenceCounts.review,
                        })}
                      </span>
                      <span className={styles.evBadgeMissing}>
                        {t("{{count}} missing", {
                          count: evidenceCounts.missing,
                        })}
                      </span>
                    </div>
                    <div className={styles.interactiveBars}>
                      <div>
                        <div className={styles.interactiveBarLabel}>
                          <span>{t("Skills")}</span>
                          <strong>{activeCandidate.skillsScore}%</strong>
                        </div>
                        <div className={styles.interactiveBarTrack}>
                          <span
                            style={{ width: `${activeCandidate.skillsScore}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className={styles.interactiveBarLabel}>
                          <span>{t("Experience")}</span>
                          <strong>{activeCandidate.expScore}%</strong>
                        </div>
                        <div className={styles.interactiveBarTrack}>
                          <span style={{ width: `${activeCandidate.expScore}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className={styles.interactiveBarLabel}>
                          <span>{t("Education")}</span>
                          <strong>{activeCandidate.eduScore}%</strong>
                        </div>
                        <div className={styles.interactiveBarTrack}>
                          <span style={{ width: `${activeCandidate.eduScore}%` }} />
                        </div>
                      </div>
                    </div>

                    <ul className={styles.interactiveEvidenceList}>
                      {activeCandidate.evidence.map((ev) => {
                        const badgeClass =
                          ev.status === "Evidence found"
                            ? styles.evBadgeFound
                            : ev.status === "Needs human review"
                              ? styles.evBadgeReview
                              : styles.evBadgeMissing;
                        return (
                          <li
                            key={ev.requirement}
                            className={styles.interactiveEvItem}
                          >
                            <div className={styles.interactiveEvTop}>
                              <strong>{t(ev.requirement)}</strong>
                              <span className={badgeClass}>{t(ev.status)}</span>
                            </div>
                            <blockquote>“{t(ev.excerpt)}”</blockquote>
                            <small>{t(ev.source)}</small>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </article>
            </div>
          </div>
        </section>

        {/* ── 4. Principles (Forest Band) ─────────────────────────── */}
        <section
          className={styles.principles}
          id="principles"
          aria-labelledby="principles-title"
        >
          <div className={styles.principlesInner}>
            <p className={styles.eyebrow}>{t("Principles")}</p>
            <h2 className={styles.principlesTitle} id="principles-title">
              {t("Built so people stay in charge")}
            </h2>
            <ul className={styles.principleList}>
              {PRINCIPLES.map((item) => (
                <li key={item.title}>
                  <span className={styles.principleIcon} aria-hidden="true">
                    <Icon name={item.icon} size={20} />
                  </span>
                  <h3>{t(item.title)}</h3>
                  <p>{t(item.body)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 5. Brand Story, Vision & Mission (Inspired by Image 2) ── */}
        <section
          className={styles.visionSection}
          id="vision"
          aria-labelledby="vision-story-title"
        >
          <div className={styles.visionInner}>
            <div className={styles.storySplit}>
              <div className={styles.storyVisualFrame}>
                <div className={styles.storyVisualInner}>
                  <div className={styles.storyLogoSpotlight}>
                    <BrandLogo
                      variant="dark"
                      size="lg"
                      showTagline
                      tagline={t(
                        "From resume noise to explainable hiring clarity.",
                      )}
                    />
                  </div>
                  <div className={styles.storyBadgeGrid}>
                    {STORY_BADGES.map((badge) => (
                      <div key={badge.title} className={styles.storyBadgeCard}>
                        <span
                          className={styles.storyBadgeIcon}
                          aria-hidden="true"
                        >
                          <Icon name={badge.icon} size={18} />
                        </span>
                        <strong>{t(badge.title)}</strong>
                        <small>{t(badge.detail)}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.storyNarrative}>
                <p className={styles.eyebrowDark}>
                  {t("THE TALENTLENS STORY")}
                </p>
                <h2 className={styles.storyTitle} id="vision-story-title">
                  {t("From resume overload to transparent human decisions")}
                </h2>
                <p>
                  {t(
                    "TalentLens was born from a simple observation: recruiters spend hours scanning PDFs for keywords, while qualified candidates get overlooked or filtered out by opaque black-box scores.",
                  )}
                </p>
                <p>
                  {t(
                    "Built as an explainable AI screening system at FPT University Hanoi, we combine deterministic rules, semantic retrieval, and verifiable CV quotes so hiring teams always see the evidence behind every rank.",
                  )}
                </p>
              </div>
            </div>

            <div className={styles.visionCards}>
              <article className={styles.visionCard}>
                <span className={styles.visionCardIcon} aria-hidden="true">
                  <Icon name="eye" size={22} />
                </span>
                <h3>{t("OUR VISION")}</h3>
                <p className={styles.visionCardSub}>
                  {t("ELEVATING EXPLAINABLE HIRING")}
                </p>
                <p className={styles.visionCardBody}>
                  {t(
                    "TalentLens aims to become the trusted standard for evidence-led recruitment—where AI accelerates reading and cross-checking, while fairness, context, and final judgment remain 100% human.",
                  )}
                </p>
              </article>

              <article className={styles.visionCard}>
                <span className={styles.visionCardIcon} aria-hidden="true">
                  <Icon name="trophy" size={22} />
                </span>
                <h3>{t("OUR MISSION")}</h3>
                <p className={styles.visionCardSub}>
                  {t("CONNECTING TALENT THROUGH VERIFIABLE PROOF")}
                </p>
                <p className={styles.visionCardBody}>
                  {t(
                    "TalentLens connects hiring teams and candidates by structuring every resume into clear, auditable requirement checks—reducing unconscious bias with default blind review and full auditability.",
                  )}
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ── 6. Ecosystem Map & Contact Hub (Inspired by Image 1) ── */}
        <section
          className={styles.contactSection}
          id="contact"
          aria-labelledby="contact-title"
        >
          <div className={styles.contactInner}>
            <div className={styles.ecosystemMapCard}>
              <div className={styles.mapTopBar}>
                <Link href="/demo" className={styles.mapFloatingBadge}>
                  <Icon name="sparkle" size={14} />
                  {t("Explore the demo")}
                </Link>
                <span className={styles.mapCoordinate}>
                  TALENTLENS · HYBRID AI v1
                </span>
              </div>
              <div className={styles.mapCanvas}>
                <div className={styles.mapGridLines} aria-hidden="true" />
                <ol className={styles.mapStageList}>
                  {PIPELINE_STAGES.map((stage) => (
                    <li key={stage.title} className={styles.mapStageItem}>
                      <span className={styles.mapStageIcon} aria-hidden="true">
                        <Icon name={stage.icon} size={18} />
                      </span>
                      <div>
                        <strong>{t(stage.title)}</strong>
                        <p>{t(stage.detail)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className={styles.contactInfoCard}>
              <p className={styles.eyebrowDark}>
                {t("ARCHITECTURE & ACCESS")}
              </p>
              <h2 className={styles.storyTitle} id="contact-title">
                {t("Explore the TalentLens ecosystem")}
              </h2>
              <p className={styles.contactIntro}>
                {t(
                  "Four transparent stages from raw PDF/DOCX upload to an auditable team shortlist. Try the read-only demo or sign in to your workspace.",
                )}
              </p>

              <ul className={styles.contactDetailsList}>
                <li>
                  <span className={styles.contactIcon} aria-hidden="true">
                    <Icon name="pin" size={18} />
                  </span>
                  <div>
                    <strong>{t("Research & Development Location")}</strong>
                    <span>
                      {t(
                        "Hanoi University - Km9, Nguyen Trai, Dai Mo, Hanoi",
                      )}
                    </span>
                  </div>
                </li>
                <li>
                  <span className={styles.contactIcon} aria-hidden="true">
                    <Icon name="phone" size={18} />
                  </span>
                  <div>
                    <strong>{t("Consultation & Demo Support")}</strong>
                    <span>{t("0913842888 · TalentLens Product ATI Team")}</span>
                  </div>
                </li>
                <li>
                  <span className={styles.contactIcon} aria-hidden="true">
                    <Icon name="mail" size={18} />
                  </span>
                  <div>
                    <strong>{t("Electronic Mail")}</strong>
                    <span>talentlens.ai@gmail.com</span>
                  </div>
                </li>
              </ul>

              <div className={styles.contactActions}>
                <Link className={styles.contactOutlineCta} href="/demo">
                  {t("OPEN INTERACTIVE DEMO")}
                  <Icon name="arrow" size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── 7. Closing CTA Band ─────────────────────────────────── */}
        <section className={styles.closing} aria-labelledby="closing-title">
          <h2 id="closing-title">{t("See a full review with sample data")}</h2>
          <p>
            {t(
              "The demo uses invented candidates and makes no requests to your backend.",
            )}
          </p>
          <div className={styles.closingActions}>
            <Link className={styles.ctaDark} href="/demo">
              {t("Explore the demo")}
              <Icon name="arrow" size={16} />
            </Link>
            <Link
              className={styles.ghostDark}
              href={signedIn ? "/dashboard" : "/login"}
            >
              {signedIn ? t("Open workspace") : t("Sign in")}
            </Link>
          </div>
        </section>
      </main>

      {/* ── 8. Synchronized Rich Multi-Column Footer (Image 1 style) ── */}
      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrandCol}>
            <Link
              href="/"
              className={styles.footerBrandLink}
              aria-label={t("TalentLens home")}
            >
              <BrandLogo
                variant="dark"
                size="lg"
                showTagline
                tagline={t(
                  "From resume noise to explainable hiring clarity.",
                )}
              />
            </Link>
            <p className={styles.footerBio}>
              {t(
                "Preserving fairness and clarity in every hiring decision—from raw resume noise to structured, verifiable human shortlists.",
              )}
            </p>
            <div className={styles.footerSocials}>
              <Link
                href="/demo"
                className={styles.footerSocialBtn}
                aria-label={t("Demo")}
                title={t("Demo")}
              >
                <Icon name="sparkle" size={16} />
              </Link>
              <a
                href="mailto:talentlens.ai@gmail.com"
                className={styles.footerSocialBtn}
                aria-label={t("Electronic Mail")}
                title="talentlens.ai@gmail.com"
              >
                <Icon name="mail" size={16} />
              </a>
              <Link
                href={signedIn ? "/dashboard" : "/login"}
                className={styles.footerSocialBtn}
                aria-label={signedIn ? t("Open workspace") : t("Sign in")}
                title={signedIn ? t("Open workspace") : t("Sign in")}
              >
                <Icon name="users" size={16} />
              </Link>
            </div>
          </div>

          <div className={styles.footerNavCol}>
            <h3 className={styles.footerColTitle}>
              <Icon name="leaf" size={15} />
              {t("ABOUT TALENTLENS")}
            </h3>
            <ul>
              <li>
                <a href="#top">{t("Home page")}</a>
              </li>
              <li>
                <a href="#how-it-works">{t("How it works")}</a>
              </li>
              <li>
                <a href="#interactive-preview">{t("Interactive preview")}</a>
              </li>
              <li>
                <a href="#principles">{t("Principles")}</a>
              </li>
              <li>
                <a href="#vision">{t("About us")}</a>
              </li>
              <li>
                <a href="#contact">{t("Contact & access")}</a>
              </li>
            </ul>
          </div>

          <div className={styles.footerNavCol}>
            <h3 className={styles.footerColTitle}>
              <Icon name="leaf" size={15} />
              {t("WORKSPACE MODULES")}
            </h3>
            <ul>
              <li>
                <Link href="/demo">{t("Demo workspace")}</Link>
              </li>
              <li>
                <Link href="/dashboard">{t("Overview")}</Link>
              </li>
              <li>
                <Link href="/jobs">{t("Job descriptions")}</Link>
              </li>
              <li>
                <Link href="/cvs">{t("CV library")}</Link>
              </li>
              <li>
                <Link href="/rankings">{t("Candidate review")}</Link>
              </li>
              <li>
                <Link href="/analytics">
                  {t("All modules")} <span aria-hidden="true">↗</span>
                </Link>
              </li>
            </ul>
          </div>

          <div className={styles.footerContactCol}>
            <h3 className={styles.footerColTitle}>
              <Icon name="leaf" size={15} />
              {t("CONTACT & GOVERNANCE")}
            </h3>
            <ul className={styles.footerContactList}>
              <li>
                <Icon name="pin" size={15} />
                <span>
                  {t(
                    "Hanoi University - Km9, Nguyen Trai, Dai Mo, Hanoi",
                  )}
                </span>
              </li>
              <li>
                <Icon name="phone" size={15} />
                <span>{t("0913842888 · TalentLens Product ATI Team")}</span>
              </li>
              <li>
                <Icon name="mail" size={15} />
                <span>talentlens.ai@gmail.com</span>
              </li>
              <li>
                <Icon name="shield" size={15} />
                <span>{t("AI-assisted. Human-decided.")}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <span>{t("© 2026 TalentLens. All rights reserved.")}</span>
          <div className={styles.footerOrnament} aria-hidden="true">
            <span className={styles.footerOrnamentLine} />
            <Icon name="leaf" size={16} />
            <span className={styles.footerOrnamentLine} />
          </div>
          <div className={styles.footerPillars}>
            <span>{t("EVIDENCE-LED")}</span>
            <span className={styles.footerPillarSep}>|</span>
            <span>{t("BLIND REVIEW")}</span>
            <span className={styles.footerPillarSep}>|</span>
            <span>{t("AUDIT TRAIL")}</span>
            <span className={styles.footerPillarSep}>|</span>
            <span>{t("HUMAN-DECIDED")}</span>
          </div>
        </div>
      </footer>

      {/* ── Floating Quick-Action Buttons (Bottom-Right) ─────────── */}
      <div className={styles.floatingActions}>
        <Link
          href="/demo"
          className={styles.floatingBtn}
          aria-label={t("Explore the demo")}
          title={t("Explore the demo")}
        >
          <Icon name="dashboard" size={18} />
        </Link>
        <a
          href="#top"
          className={`${styles.floatingBtn} ${styles.floatingBtnGold}`}
          aria-label={t("Back to top")}
          title={t("Back to top")}
        >
          <Icon name="chevron-up" size={20} />
        </a>
      </div>
    </div>
  );
}

/** The hero "product shot": the review workspace itself, drawn in the brand palette. */
function ProductCollage() {
  const { t } = useI18n();
  const rows = [
    {
      rank: 1,
      name: t("Candidate #{{id}}", { id: 1 }),
      skills: "Python · FastAPI · PostgreSQL",
      score: 82,
      tone: "high",
    },
    {
      rank: 2,
      name: t("Candidate #{{id}}", { id: 3 }),
      skills: "PostgreSQL · Kubernetes",
      score: 64,
      tone: "mid",
    },
    {
      rank: 3,
      name: t("Candidate #{{id}}", { id: 2 }),
      skills: "Python · Docker",
      score: 41,
      tone: "low",
    },
  ];

  return (
    <div className={styles.collage} aria-hidden="true">
      <div className={`${styles.paper} ${styles.paperBack}`}>
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className={`${styles.paper} ${styles.paperMid}`}>
        <div className={styles.paperBrandRow}>
          <strong>CV</strong>
          <BrandMark size={24} variant="light" />
        </div>
        <span />
        <span />
        <span />
      </div>

      <div className={styles.board}>
        <div className={styles.boardHead}>
          <span className={styles.boardHeadTitle}>
            <BrandMark size={20} variant="dark" />
            {t("Ranked candidates")}
          </span>
          <span className={styles.boardJob}>Senior Python Engineer</span>
        </div>
        <ol>
          {rows.map((row) => (
            <li key={row.rank}>
              <span className={styles.rank}>#{row.rank}</span>
              <span className={styles.rowCopy}>
                <strong>{row.name}</strong>
                <small>{row.skills}</small>
              </span>
              <span className={`${styles.chip} ${styles[row.tone]}`}>
                {row.score}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.ring}>
        <strong>82</strong>
        <span>{t("match")}</span>
      </div>

      <div className={styles.evidence}>
        <div className={styles.evidenceHead}>
          <strong>FastAPI</strong>
          <span>{t("Evidence found")}</span>
        </div>
        <p>
          “Built FastAPI microservices on PostgreSQL serving 2M requests a day.”
        </p>
      </div>
    </div>
  );
}
