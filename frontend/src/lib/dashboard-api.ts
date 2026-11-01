import { apiRequest } from "@/lib/api";
import type { JobStatus } from "@/lib/jobs-api";

export type DashboardSummary = {
  active_jobs: number;
  total_jobs: number;
  total_cvs: number;
  processing_cvs: number;
  error_cvs: number;
  scored_matches: number;
  needs_review: number;
  shortlisted: number;
  cv_status_counts: Record<string, number>;
  recent_jobs: {
    id: number;
    title: string;
    department: string | null;
    location: string | null;
    status: JobStatus;
    candidates: number;
    updated_at: string;
  }[];
  review_queue: {
    result_id: number;
    job_id: number;
    job_title: string;
    cv_id: number;
    candidate_name: string;
    score: number;
    matched_skills: string[];
  }[];
};

export function getDashboardSummary(
  signal?: AbortSignal,
): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>("/dashboard/summary", undefined, signal);
}
