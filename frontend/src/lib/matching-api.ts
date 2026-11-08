import { apiRequest } from "@/lib/api";
import type { CvStatus } from "@/lib/cvs-api";
import type { ScoringWeights } from "@/lib/jobs-api";

export const DECISION_STATUSES = [
  "pending",
  "shortlisted",
  "interview",
  "rejected",
  "hired",
] as const;

export type DecisionStatus = (typeof DECISION_STATUSES)[number];
export type EvidenceStatus = "found" | "unclear" | "not_found";

export type Evidence = {
  requirement: string;
  category: string;
  status: EvidenceStatus;
  quote: string | null;
};

export type MatchDetails = {
  strengths: string[];
  gaps: string[];
  interview_questions: string[];
  evidence: Evidence[];
  weights: Record<string, number>;
  category_weights?: Record<string, number>;
  custom_weights?: ScoringWeights | null;
  sources: Record<string, string>;
};

export type Decision = {
  id: number;
  status: DecisionStatus;
  reason: string | null;
  note: string | null;
  score_override: number | null;
  decided_by: number | null;
  updated_at: string;
};

export type RankedMatch = {
  id: number;
  cv_id: number;
  job_id: number;
  overall_score: number;
  effective_score: number;
  skill_score: number | null;
  experience_score: number | null;
  education_score: number | null;
  rule_score: number | null;
  semantic_score: number | null;
  llm_score: number | null;
  matched_skills: string[];
  missing_skills: string[];
  explanation: string | null;
  model_name: string | null;
  model_version: string | null;
  rank: number | null;
  created_at: string;
  updated_at: string | null;
  candidate: {
    cv_id: number;
    candidate_name: string;
    candidate_email: string | null;
    file_name: string;
    status: CvStatus;
    skills: string[];
    years_of_experience: number | null;
  };
  decision: Decision | null;
  details: MatchDetails;
};

export type JobRanking = {
  job_id: number;
  job_title: string;
  scoring_weights?: ScoringWeights;
  total: number;
  pending_cvs: number;
  items: RankedMatch[];
};

export type MatchRun = {
  job_id: number;
  queued: number;
  cv_ids: number[];
  skipped: number[];
};

export type DecisionInput = {
  status: DecisionStatus;
  reason: string | null;
  note: string | null;
  score_override: number | null;
};

export function runMatching(
  jobId: number,
  cvIds?: number[],
): Promise<MatchRun> {
  return apiRequest<MatchRun>("/matching/run", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId, cv_ids: cvIds ?? null }),
  });
}

export function getJobRanking(
  jobId: number,
  decisionStatus?: DecisionStatus | "all",
  signal?: AbortSignal,
): Promise<JobRanking> {
  const query =
    decisionStatus && decisionStatus !== "all"
      ? `?decision_status=${decisionStatus}`
      : "";
  return apiRequest<JobRanking>(
    `/matching/jobs/${jobId}/results${query}`,
    undefined,
    signal,
  );
}

export function saveDecision(
  resultId: number,
  input: DecisionInput,
): Promise<Decision> {
  return apiRequest<Decision>(`/matching/results/${resultId}/decision`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function updateJobWeights(
  jobId: number,
  weights: ScoringWeights,
  resetCvOverrides = true,
): Promise<JobRanking> {
  return apiRequest<JobRanking>(`/matching/jobs/${jobId}/weights`, {
    method: "PUT",
    body: JSON.stringify({
      scoring_weights: weights,
      reset_cv_overrides: resetCvOverrides,
    }),
  });
}

export function updateResultWeights(
  resultId: number,
  weights: ScoringWeights | null,
): Promise<RankedMatch> {
  return apiRequest<RankedMatch>(`/matching/results/${resultId}/weights`, {
    method: "PUT",
    body: JSON.stringify({ scoring_weights: weights }),
  });
}
