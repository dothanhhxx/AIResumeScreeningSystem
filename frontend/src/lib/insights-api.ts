import { apiRequest } from "@/lib/api";
import type { JobStatus } from "@/lib/jobs-api";

export type DecisionStatus =
  "pending" | "shortlisted" | "interview" | "rejected" | "hired";

export const DECISION_STATUSES: DecisionStatus[] = [
  "pending",
  "shortlisted",
  "interview",
  "rejected",
  "hired",
];

export type Analytics = {
  total_jobs: number;
  total_cvs: number;
  scored_matches: number;
  decided_matches: number;
  average_score: number | null;
  score_bands: { high: number; mid: number; low: number };
  score_distribution: { start: number; end: number; count: number }[];
  decision_funnel: Record<DecisionStatus, number>;
  cv_status_counts: Record<string, number>;
  jobs: {
    id: number;
    title: string;
    status: JobStatus;
    candidates: number;
    average_score: number | null;
    top_score: number | null;
    advanced: number;
  }[];
  top_missing_skills: { skill: string; candidates: number }[];
  activity: {
    date: string;
    cvs_uploaded: number;
    matches_scored: number;
    decisions_made: number;
  }[];
};

export type HistoryItem = {
  result_id: number;
  job_id: number;
  job_title: string;
  cv_id: number;
  candidate_name: string;
  ai_score: number;
  effective_score: number;
  decision_status: DecisionStatus;
  decision_reason: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  scored_at: string | null;
  model_name: string | null;
};

export type HistoryPage = {
  items: HistoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export type HistoryFilters = {
  page: number;
  pageSize?: number;
  jobId?: number | null;
  decisionStatus?: DecisionStatus | "";
  search?: string;
};

export type SystemInfo = {
  app_version: string;
  engine_version: string;
  llm_provider: string;
  llm_active: boolean;
  llm_model: string | null;
  embedding_model: string | null;
  fallback_to_heuristic: boolean;
  score_weights: { rule: number; semantic: number; llm: number };
  pipeline_mode: string;
  storage_backend: string;
  session_minutes: number;
};

export function getAnalytics(
  days: number,
  signal?: AbortSignal,
): Promise<Analytics> {
  return apiRequest<Analytics>(
    `/dashboard/analytics?days=${days}`,
    undefined,
    signal,
  );
}

export function getHistory(
  filters: HistoryFilters,
  signal?: AbortSignal,
): Promise<HistoryPage> {
  const params = new URLSearchParams({
    page: String(filters.page),
    page_size: String(filters.pageSize ?? 20),
  });
  if (filters.jobId) params.set("job_id", String(filters.jobId));
  if (filters.decisionStatus)
    params.set("decision_status", filters.decisionStatus);
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  return apiRequest<HistoryPage>(
    `/matching/history?${params.toString()}`,
    undefined,
    signal,
  );
}

export function getSystemInfo(signal?: AbortSignal): Promise<SystemInfo> {
  return apiRequest<SystemInfo>("/system/info", undefined, signal);
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<null> {
  return apiRequest<null>("/auth/password", {
    method: "PUT",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}
