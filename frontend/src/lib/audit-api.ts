import { apiRequest } from "@/lib/api";

export type AuditLog = {
  id: number;
  user_id: number | null;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  detail: Record<string, unknown> | string | null;
  ip_address: string | null;
  created_at: string;
};

export type AuditPage = {
  items: AuditLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export const AUDIT_ACTIONS = [
  "login",
  "register",
  "cv_upload",
  "cv_delete",
  "cv_view",
  "job_create",
  "job_update",
  "job_delete",
  "match_run",
  "match_view",
  "decision_create",
  "decision_update",
] as const;

export type ListAuditParams = {
  page?: number;
  pageSize?: number;
  action?: string;
};

export async function listAuditLogs(
  params: ListAuditParams = {},
  signal?: AbortSignal,
): Promise<AuditPage> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    page_size: String(params.pageSize ?? 50),
  });
  if (params.action) {
    query.set("action", params.action);
  }
  return apiRequest<AuditPage>(`/audit?${query.toString()}`, undefined, signal);
}
