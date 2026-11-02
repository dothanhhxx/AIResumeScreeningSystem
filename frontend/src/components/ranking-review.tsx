"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useI18n } from "@/i18n/provider";
import type { TranslationKey } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import { useAuthSession } from "@/lib/auth-session";
import { listJobs, type Job } from "@/lib/jobs-api";
import {
  DECISION_STATUSES,
  getJobRanking,
  runMatching,
  saveDecision,
  type DecisionStatus,
  type EvidenceStatus,
  type JobRanking,
  type RankedMatch,
} from "@/lib/matching-api";

const POLL_MS = 3000;

const decisionLabels: Record<DecisionStatus, TranslationKey> = {
  pending: "Pending review",
  shortlisted: "Shortlisted",
  interview: "Interview",
  rejected: "Rejected",
  hired: "Hired",
};

const evidenceLabels: Record<EvidenceStatus, TranslationKey> = {
  found: "Evidence found",
  unclear: "Needs verification",
  not_found: "Not found in CV",
};

type Notice = { kind: "error" | "info"; text: string };

function scoreTone(score: number): "high" | "mid" | "low" {
  if (score >= 70) return "high";
  if (score >= 45) return "mid";
  return "low";
}

function formatScore(score: number | null | undefined): string {
  return score === null || score === undefined
    ? "—"
    : String(Math.round(score));
}

function scoringSourceLabel(
  source: string | undefined,
  t: (key: TranslationKey) => string,
): string {
  if (!source) return t("Not reported");
  if (source === "none") return t("Not used");
  if (source === "rule_scorer") return t("Deterministic rule scorer");
  if (source === "hashing-bow-v1") return t("Offline text hashing");
  return source;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function errorText(error: unknown, t: (key: TranslationKey) => string): string {
  if (error instanceof ApiError) {
    if (error.status === 0 && error.message.startsWith("Set NEXT_PUBLIC")) {
      return t(
        "Backend connection is not configured. Set NEXT_PUBLIC_API_BASE_URL in the frontend environment.",
      );
    }
    if (error.status === 0)
      return t("Could not reach the backend. Check that it is running.");
    if (error.status === 401) return t("Sign in to review candidates.");
    if (error.status === 403) return t("Your role cannot perform this action.");
    return error.message;
  }
  return t("Something went wrong. Please try again.");
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="score-bar">
      <div className="score-bar-label">
        <span>{label}</span>
        <strong>{formatScore(value)}</strong>
      </div>
      <div className="score-bar-track" aria-hidden="true">
        <span
          className={`score-bar-fill score-${scoreTone(value ?? 0)}`}
          style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
        />
      </div>
    </div>
  );
}

function DecisionForm({
  result,
  canDecide,
  onSaved,
}: {
  result: RankedMatch;
  canDecide: boolean;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<DecisionStatus>(
    result.decision?.status ?? "pending",
  );
  const [reason, setReason] = useState(result.decision?.reason ?? "");
  const [note, setNote] = useState(result.decision?.note ?? "");
  const [override, setOverride] = useState(
    result.decision?.score_override?.toString() ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const overrideValue = override.trim() === "" ? null : Number(override);
    if (
      overrideValue !== null &&
      (!Number.isFinite(overrideValue) ||
        overrideValue < 0 ||
        overrideValue > 100)
    ) {
      setNotice({
        kind: "error",
        text: t("Adjusted score must be between 0 and 100."),
      });
      return;
    }
    if (overrideValue !== null && !reason.trim()) {
      setNotice({
        kind: "error",
        text: t("Give a reason when you adjust the AI score."),
      });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await saveDecision(result.id, {
        status,
        reason: reason.trim() || null,
        note: note.trim() || null,
        score_override: overrideValue,
      });
      setNotice({ kind: "info", text: t("Decision saved.") });
      onSaved();
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error, t) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="decision-panel decision-panel-live"
      aria-labelledby="decision-title"
      onSubmit={handleSubmit}
    >
      <div className="decision-panel-heading">
        <div>
          <p className="eyebrow">{t("RECRUITER DECISION")}</p>
          <h3 id="decision-title">{t("Review outcome")}</h3>
        </div>
        <span className={`decision-chip decision-${status}`}>
          {t(decisionLabels[status])}
        </span>
      </div>
      <div className="decision-grid">
        <label className="form-field">
          <span>{t("Decision status")}</span>
          <select
            value={status}
            disabled={!canDecide || saving}
            onChange={(event) =>
              setStatus(event.target.value as DecisionStatus)
            }
          >
            {DECISION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(decisionLabels[value])}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>{t("Adjusted score (optional)")}</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            inputMode="numeric"
            value={override}
            disabled={!canDecide || saving}
            placeholder={t("AI score: {{score}}", {
              score: formatScore(result.overall_score),
            })}
            onChange={(event) => setOverride(event.target.value)}
          />
        </label>
      </div>
      <label className="form-field">
        <span>{t("Reason")}</span>
        <input
          maxLength={500}
          value={reason}
          disabled={!canDecide || saving}
          placeholder={t(
            "Why this outcome? Required when adjusting the score.",
          )}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <label className="form-field">
        <span>{t("Reviewer note")}</span>
        <textarea
          rows={3}
          maxLength={5000}
          value={note}
          disabled={!canDecide || saving}
          placeholder={t("Notes for your team (optional)")}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {notice && (
        <p
          className={`cv-upload-message cv-upload-message-${notice.kind}`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          {notice.text}
        </p>
      )}
      {!canDecide && (
        <p className="decision-integration-note">
          {t("Viewers can read rankings but cannot record decisions.")}
        </p>
      )}
      <button
        className="button button-primary"
        type="submit"
        disabled={!canDecide || saving}
      >
        {saving ? t("Saving…") : t("Save recruiter decision")}
      </button>
    </form>
  );
}

function ResultDetail({
  result,
  hideIdentity,
  canViewOriginalCv,
  canDecide,
  onSaved,
}: {
  result: RankedMatch;
  hideIdentity: boolean;
  canViewOriginalCv: boolean;
  canDecide: boolean;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const name = hideIdentity
    ? t("Candidate #{{id}}", { id: result.cv_id })
    : result.candidate.candidate_name;
  const overridden = result.decision?.score_override != null;
  const usedLlm = result.llm_score !== null;
  const sources = result.details.sources ?? {};
  const semanticSource = sources.semantic;

  return (
    <>
      <header className="ranking-detail-header">
        <div className="detail-identity">
          <span className="candidate-avatar candidate-avatar-mint">
            {hideIdentity ? "#" : initials(result.candidate.candidate_name)}
          </span>
          <div>
            <p className="eyebrow">
              {t("RANK {{rank}}", { rank: result.rank ?? "—" })}
            </p>
            <h2 id="evidence-title">{name}</h2>
            <p>
              {hideIdentity
                ? t("Identity details are hidden")
                : (result.candidate.candidate_email ??
                  result.candidate.file_name)}
            </p>
          </div>
        </div>
        <div
          className={`score-ring score-${scoreTone(result.effective_score)}`}
        >
          <strong>{formatScore(result.effective_score)}</strong>
          <span>{overridden ? t("adjusted") : t("match")}</span>
        </div>
      </header>

      <div className="ranking-detail-body">
        <p className="ranking-transparency-note" role="note">
          <span className="ranking-transparency-icon" aria-hidden="true">
            i
          </span>
          <span>
            {t(
              "A 0–100 match score is a comparison signal, not a probability or a hiring recommendation. Verify extracted details and evidence against the original CV before deciding.",
            )}
          </span>
        </p>

        {overridden && (
          <p className="detail-override-note">
            {t("AI score {{ai}} was adjusted to {{score}} by a recruiter.", {
              ai: formatScore(result.overall_score),
              score: formatScore(result.decision?.score_override),
            })}
          </p>
        )}

        <section className="detail-section" aria-label={t("Score breakdown")}>
          <h3>{t("Score breakdown")}</h3>
          <div className="score-bars">
            <ScoreBar label={t("Skills")} value={result.skill_score} />
            <ScoreBar label={t("Experience")} value={result.experience_score} />
            <ScoreBar label={t("Education")} value={result.education_score} />
          </div>
          <dl className="engine-scores">
            <div>
              <dt>{t("Rules")}</dt>
              <dd>{formatScore(result.rule_score)}</dd>
            </div>
            <div>
              <dt>{t("Semantic")}</dt>
              <dd>{formatScore(result.semantic_score)}</dd>
            </div>
            <div>
              <dt>{t("LLM")}</dt>
              <dd>{usedLlm ? formatScore(result.llm_score) : t("Off")}</dd>
            </div>
          </dl>
        </section>

        {result.explanation && (
          <section className="detail-section">
            <h3>{t("Why this score")}</h3>
            <p className="detail-explanation">{result.explanation}</p>
          </section>
        )}

        <section className="detail-section">
          <h3>{t("Evidence by requirement")}</h3>
          <p className="detail-hint">
            {t(
              "Not found in the CV does not mean the candidate lacks the skill.",
            )}
          </p>
          {result.details.evidence.length === 0 ? (
            <p className="detail-hint">
              {t("This job has no explicit requirements to check.")}
            </p>
          ) : (
            <ul className="evidence-list">
              {result.details.evidence.map((item) => (
                <li
                  key={`${item.category}-${item.requirement}`}
                  className="evidence-row"
                >
                  <div className="evidence-requirement">
                    <strong>{item.requirement}</strong>
                    <span className={`evidence-status evidence-${item.status}`}>
                      {t(evidenceLabels[item.status])}
                    </span>
                  </div>
                  {item.quote && (
                    <blockquote className="evidence-quote">
                      “{item.quote}”
                    </blockquote>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canViewOriginalCv ? (
            hideIdentity ? (
              <p className="evidence-source-access-note">
                {t("Turn off identity hiding to open the original CV.")}
              </p>
            ) : (
              <Link
                className="text-link evidence-source-link"
                href={`/cvs?cv=${result.cv_id}`}
              >
                {t("Open original CV")}
              </Link>
            )
          ) : (
            <p className="evidence-source-access-note">
              {t("Original CV access follows your account permissions.")}
            </p>
          )}
        </section>

        <div className="detail-columns">
          <section className="detail-section">
            <h3>{t("Strengths")}</h3>
            <ul className="detail-bullets">
              {result.details.strengths.length ? (
                result.details.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))
              ) : (
                <li>{t("None recorded")}</li>
              )}
            </ul>
          </section>
          <section className="detail-section">
            <h3>{t("Gaps to verify")}</h3>
            <ul className="detail-bullets detail-bullets-gap">
              {result.details.gaps.length ? (
                result.details.gaps.map((item) => <li key={item}>{item}</li>)
              ) : (
                <li>{t("None recorded")}</li>
              )}
            </ul>
          </section>
        </div>

        {result.details.interview_questions.length > 0 && (
          <section className="detail-section">
            <h3>{t("Suggested interview questions")}</h3>
            <ol className="detail-questions">
              {result.details.interview_questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          </section>
        )}

        <section
          className="ranking-provenance"
          aria-labelledby="provenance-title"
        >
          <div className="ranking-provenance-heading">
            <h3 id="provenance-title">{t("Scoring provenance")}</h3>
            <span>
              {t("Engine version {{version}}", {
                version: result.model_version ?? t("Not reported"),
              })}
            </span>
          </div>
          <dl className="ranking-source-grid">
            <div>
              <dt>{t("Rules")}</dt>
              <dd>{scoringSourceLabel(sources.rule, t)}</dd>
            </div>
            <div>
              <dt>{t("Semantic")}</dt>
              <dd>{scoringSourceLabel(semanticSource, t)}</dd>
            </div>
            <div>
              <dt>{t("LLM")}</dt>
              <dd>{scoringSourceLabel(sources.llm, t)}</dd>
            </div>
          </dl>
          <p className="detail-provenance">
            {t("Scored by {{model}} · weights {{weights}}", {
              model: result.model_name ?? "—",
              weights: Object.entries(result.details.weights)
                .map(
                  ([engine, weight]) =>
                    `${engine} ${Math.round(weight * 100)}%`,
                )
                .join(", "),
            })}
          </p>
          {(!usedLlm || semanticSource === "hashing-bow-v1") && (
            <p className="ranking-source-notice" role="note">
              {!usedLlm && (
                <span>
                  {t(
                    "Language-model score was not produced for this result. Review the available scoring signals and CV evidence before deciding.",
                  )}
                </span>
              )}
              {semanticSource === "hashing-bow-v1" && (
                <span>
                  {t(
                    "Semantic matching used offline text hashing, a lightweight lexical fallback that has not been evaluated against labeled examples.",
                  )}
                </span>
              )}
            </p>
          )}
        </section>
      </div>

      <DecisionForm
        key={`${result.id}-${result.decision?.updated_at ?? "new"}`}
        result={result}
        canDecide={canDecide}
        onSaved={onSaved}
      />
      <div className="human-review-note ranking-human-note">
        <span className="human-review-icon">♡</span>
        <div>
          <strong>{t("People make hiring decisions.")}</strong>
          <span>
            {t(
              "Match indicators support review and do not decide for the recruiter.",
            )}
          </span>
        </div>
      </div>
    </>
  );
}

export function RankingReview() {
  const { t } = useI18n();
  const { session } = useAuthSession();
  const searchParams = useSearchParams();
  const requestedJob = Number(searchParams?.get("job") ?? "") || null;
  const canDecide = Boolean(session && session.user.role !== "viewer");

  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobsReloadVersion, setJobsReloadVersion] = useState(0);
  const [jobId, setJobId] = useState<number | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<DecisionStatus | "all">(
    "all",
  );
  const [search, setSearch] = useState("");
  const [hideIdentity, setHideIdentity] = useState(true);
  const [ranking, setRanking] = useState<JobRanking | null>(null);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    listJobs({ page: 1, pageSize: 100, signal: controller.signal })
      .then((page) => {
        const usable = page.items.filter((job) => job.status !== "archived");
        setJobs(usable);
        setRanking(null);
        setRankingError(null);
        setSelectedId(null);
        const preferred =
          usable.find((job) => job.id === requestedJob) ??
          usable.find((job) => job.status === "active") ??
          usable[0];
        setJobId(preferred?.id ?? null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setJobs([]);
        setJobsError(errorText(error, t));
      })
      .finally(() => {
        if (!controller.signal.aborted) setJobsLoading(false);
      });
    return () => controller.abort();
  }, [jobsReloadVersion, requestedJob, t]);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    if (jobId === null) return;
    const controller = new AbortController();
    getJobRanking(jobId, decisionFilter, controller.signal)
      .then((data) => {
        setRanking(data);
        setRankingError(null);
        setSelectedId((current) =>
          current && data.items.some((item) => item.id === current)
            ? current
            : (data.items[0]?.id ?? null),
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRankingError(errorText(error, t));
      });
    return () => controller.abort();
  }, [jobId, decisionFilter, version, t]);

  // Poll while CVs are still being scored in the background
  useEffect(() => {
    if (!ranking || ranking.pending_cvs === 0) return;
    const timer = window.setTimeout(refresh, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [ranking, refresh]);

  async function handleRun() {
    if (jobId === null) return;
    setRunning(true);
    setNotice(null);
    setRankingError(null);
    try {
      const run = await runMatching(jobId);
      setNotice({
        kind: "info",
        text:
          run.queued > 0
            ? t(
                "Scoring {{count}} CV(s) in the background. Results update automatically.",
                { count: run.queued },
              )
            : t(
                "No CVs are ready yet. Upload resumes and wait until they are extracted.",
              ),
      });
      refresh();
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error, t) });
    } finally {
      setRunning(false);
    }
  }

  const loading = jobId !== null && ranking === null && rankingError === null;

  const visible = useMemo(() => {
    const items = ranking?.items ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [
        hideIdentity ? `#${item.cv_id}` : item.candidate.candidate_name,
        ...item.matched_skills,
        ...item.candidate.skills,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [ranking, search, hideIdentity]);

  const selected =
    visible.find((item) => item.id === selectedId) ?? visible[0] ?? null;

  return (
    <>
      <section
        className="panel ranking-workspace"
        aria-label={t("Candidate ranking review")}
      >
        <div className="ranking-toolbar ranking-toolbar-live">
          <label className="form-field">
            <span>{t("Job")}</span>
            <select
              value={jobId ?? ""}
              disabled={!jobs || jobs.length === 0}
              onChange={(event) => {
                setRanking(null);
                setRankingError(null);
                setNotice(null);
                setJobId(Number(event.target.value) || null);
                setSelectedId(null);
              }}
            >
              {!jobs && <option value="">{t("Loading…")}</option>}
              {jobs?.length === 0 && (
                <option value="">{t("Create a job description first")}</option>
              )}
              {jobs?.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                  {job.status !== "active" ? ` (${job.status})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{t("Review status")}</span>
            <select
              value={decisionFilter}
              onChange={(event) => {
                setRanking(null);
                setRankingError(null);
                setNotice(null);
                setDecisionFilter(event.target.value as DecisionStatus | "all");
                setSelectedId(null);
              }}
            >
              <option value="all">{t("All candidates")}</option>
              {DECISION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(decisionLabels[value])}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{t("Search candidates")}</span>
            <input
              type="search"
              value={search}
              placeholder={t("Name or skill")}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="ranking-actions">
            <label className="identity-toggle">
              <input
                type="checkbox"
                checked={hideIdentity}
                aria-describedby="identity-scope-note"
                onChange={(event) =>
                  setHideIdentity(event.currentTarget.checked)
                }
              />
              <span
                title={t(
                  "This hides the name and email fields, but resume text may still identify a candidate.",
                )}
              >
                {t("Hide name and email")}
              </span>
            </label>
            <span id="identity-scope-note" className="sr-only">
              {t(
                "This hides the name and email fields, but resume text may still identify a candidate.",
              )}
            </span>
            <button
              className="button button-primary"
              type="button"
              onClick={handleRun}
              disabled={jobId === null || running || !canDecide}
            >
              {running ? t("Starting…") : t("Run AI matching")}
            </button>
          </div>
        </div>

        {notice && (
          <p
            className={`cv-upload-message cv-upload-message-${notice.kind} ranking-notice`}
            role={notice.kind === "error" ? "alert" : "status"}
          >
            {notice.text}
          </p>
        )}
        {jobsError && (
          <div className="ranking-fetch-error" role="alert">
            <span>{jobsError}</span>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                setJobsLoading(true);
                setJobsError(null);
                setJobsReloadVersion((currentVersion) => currentVersion + 1);
              }}
            >
              {t("Retry")}
            </button>
          </div>
        )}
        {rankingError && (
          <div className="ranking-fetch-error" role="alert">
            <span>{rankingError}</span>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                setRankingError(null);
                refresh();
              }}
            >
              {t("Retry")}
            </button>
          </div>
        )}
        {ranking && ranking.pending_cvs > 0 && (
          <p className="ranking-progress" role="status">
            <span className="ranking-spinner" aria-hidden="true" />
            {t("Scoring in progress: {{count}} CV(s) remaining…", {
              count: ranking.pending_cvs,
            })}
          </p>
        )}

        <div className="ranking-content-grid">
          <section
            className="ranking-list-panel"
            aria-labelledby="ranking-list-title"
          >
            <div className="ranking-list-heading">
              <div>
                <h2 id="ranking-list-title">{t("Ranked candidates")}</h2>
                <p>
                  {ranking
                    ? t("{{count}} scored for {{job}}", {
                        count: ranking.total,
                        job: ranking.job_title,
                      })
                    : t("Choose a job to see its ranking.")}
                </p>
              </div>
            </div>

            {jobsLoading && jobs === null && (
              <p className="cv-library-state" role="status">
                {t("Loading job descriptions…")}
              </p>
            )}
            {!jobsLoading && jobsError === null && jobs?.length === 0 && (
              <div className="ranking-empty-state" role="status">
                <h3>{t("Create a job description first")}</h3>
                <p>{t("Add a job description before reviewing candidates.")}</p>
                <Link className="button button-primary" href="/jobs">
                  {t("Create a job")}
                </Link>
              </div>
            )}
            {loading && (
              <p className="cv-library-state" role="status">
                {t("Loading…")}
              </p>
            )}
            {rankingError && !ranking && (
              <p className="cv-library-state" role="status">
                {t(
                  "Could not load candidate rankings. Use Retry to try again.",
                )}
              </p>
            )}
            {ranking && ranking.items.length === 0 && (
              <div className="ranking-empty-state" role="status">
                <span className="empty-icon" aria-hidden="true">
                  ⌁
                </span>
                <h3>{t("No ranked candidates yet")}</h3>
                <p>
                  {t(
                    "Upload CVs in the CV library, then choose Run AI matching to score them against this job.",
                  )}
                </p>
                <Link className="button button-secondary" href="/cvs">
                  {t("Open CV library")}
                </Link>
              </div>
            )}
            {ranking && ranking.items.length > 0 && visible.length === 0 && (
              <div className="ranking-empty-state" role="status">
                <h3>{t("No candidates match your search")}</h3>
                <p>{t("Try another name or skill.")}</p>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setSearch("")}
                >
                  {t("Clear search")}
                </button>
              </div>
            )}
            <ol className="ranking-list">
              {visible.map((item) => {
                const isActive = selected?.id === item.id;
                const decision = item.decision?.status ?? "pending";
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`ranking-row${isActive ? " ranking-row-active" : ""}`}
                      aria-pressed={isActive}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <span className="ranking-rank">#{item.rank}</span>
                      <span className="ranking-row-copy">
                        <strong>
                          {hideIdentity
                            ? t("Candidate #{{id}}", { id: item.cv_id })
                            : item.candidate.candidate_name}
                        </strong>
                        <span>
                          {item.matched_skills.slice(0, 4).join(" · ") ||
                            t("No required skills matched")}
                        </span>
                      </span>
                      <span className={`decision-chip decision-${decision}`}>
                        {t(decisionLabels[decision])}
                      </span>
                      <span
                        className={`ranking-score score-${scoreTone(item.effective_score)}`}
                      >
                        {formatScore(item.effective_score)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          <section
            className="ranking-detail-panel"
            aria-labelledby="evidence-title"
          >
            {selected ? (
              <ResultDetail
                result={selected}
                hideIdentity={hideIdentity}
                canViewOriginalCv={Boolean(
                  session && session.user.role !== "viewer",
                )}
                canDecide={canDecide}
                onSaved={refresh}
              />
            ) : ranking && ranking.items.length === 0 ? (
              <div className="ranking-empty-state">
                <h3 id="evidence-title">{t("Candidate evidence")}</h3>
                <p>
                  {t(
                    "No candidate evidence is available until a CV is scored.",
                  )}
                </p>
              </div>
            ) : ranking && visible.length === 0 ? (
              <div className="ranking-empty-state">
                <h3 id="evidence-title">{t("Candidate evidence")}</h3>
                <p>{t("Clear your search to review candidate evidence.")}</p>
              </div>
            ) : rankingError ? (
              <div className="ranking-empty-state">
                <h3 id="evidence-title">{t("Candidate evidence")}</h3>
                <p>
                  {t("Candidate evidence is unavailable until rankings load.")}
                </p>
              </div>
            ) : (
              <div className="ranking-empty-state">
                <h3 id="evidence-title">{t("Candidate evidence")}</h3>
                <p>{t("Select a candidate to review the evidence.")}</p>
              </div>
            )}
          </section>
        </div>
      </section>
    </>
  );
}
