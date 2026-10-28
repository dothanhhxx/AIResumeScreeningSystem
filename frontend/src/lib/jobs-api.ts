export type JobStatus = "draft" | "active" | "closed" | "archived";

export type Job = {
  id: number;
  title: string;
  department: string | null;
  location: string | null;
  description: string;
  requirements: string | null;
  required_skills: string[] | null;
  experience_years: number | null;
  education_level: string | null;
  status: JobStatus;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type JobInput = {
  title: string;
  department: string | null;
  location: string | null;
  description: string;
  requirements: string | null;
  required_skills: string[];
  experience_years: number | null;
  education_level: string | null;
};

export type JobPage = {
  items: Job[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export class JobsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "JobsApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function apiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new JobsApiError(
      "Set NEXT_PUBLIC_API_BASE_URL to connect the backend.",
      0,
    );
  }
  return `${baseUrl}${path}`;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  signal?: AbortSignal,
): Promise<T> {
  const url = apiUrl(path);
  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    response = await fetch(url, {
      ...init,
      signal,
      credentials: "include",
      headers,
    });
  } catch {
    throw new JobsApiError(
      "Could not reach the backend. Check that it is running.",
      0,
    );
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = isRecord(body) ? body.detail : undefined;
    const validationMessages = Array.isArray(detail)
      ? detail
          .map((item) => {
            if (!item || typeof item !== "object") return "";
            const error = item as { loc?: unknown[]; msg?: unknown };
            const field = Array.isArray(error.loc)
              ? error.loc.slice(-1)[0]
              : undefined;
            return typeof error.msg === "string"
              ? `${typeof field === "string" ? `${field}: ` : ""}${error.msg}`
              : "";
          })
          .filter(Boolean)
          .join(" ")
      : "";
    const message =
      typeof detail === "string"
        ? detail
        : validationMessages ||
          (isRecord(body) && typeof body.message === "string"
            ? body.message
            : `Request failed (${response.status}).`);
    throw new JobsApiError(message, response.status);
  }
  if (
    !isRecord(body) ||
    body.success !== true ||
    body.data === null ||
    body.data === undefined
  ) {
    throw new JobsApiError(
      isRecord(body) && typeof body.message === "string"
        ? body.message
        : "The backend returned an invalid response.",
      response.status,
    );
  }
  return body.data as T;
}

export function listJobs({
  page,
  pageSize,
  status,
  signal,
}: {
  page: number;
  pageSize: number;
  status?: JobStatus | "all";
  signal?: AbortSignal;
}): Promise<JobPage> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (status && status !== "all") params.set("status", status);
  return request<JobPage>(`/jobs?${params.toString()}`, undefined, signal);
}

export function createJob(input: JobInput): Promise<Job> {
  return request<Job>("/jobs", { method: "POST", body: JSON.stringify(input) });
}

export function updateJob(
  jobId: number,
  input: JobInput & { status: JobStatus },
): Promise<Job> {
  return request<Job>(`/jobs/${jobId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function archiveJob(jobId: number): Promise<Job> {
  return request<Job>(`/jobs/${jobId}`, { method: "DELETE" });
}
