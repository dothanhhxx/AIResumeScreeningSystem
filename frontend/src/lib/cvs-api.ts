import { getAuthAccessToken } from "@/lib/auth-session";

export const CV_STATUSES = [
  "uploaded",
  "parsing",
  "parsed",
  "extracting",
  "extracted",
  "scoring",
  "scored",
  "error",
] as const;

export type CvStatus = (typeof CV_STATUSES)[number];

export type CvSummary = {
  id: number;
  candidate_name: string;
  candidate_email: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  status: CvStatus;
  uploaded_by: number | null;
  created_at: string;
};

export type CvPage = {
  items: CvSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export class CvsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CvsApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCvStatus(value: unknown): value is CvStatus {
  return typeof value === "string" && CV_STATUSES.includes(value as CvStatus);
}

function parseCvSummary(value: unknown): CvSummary | null {
  if (!isRecord(value)) return null;
  if (
    !Number.isInteger(value.id) ||
    typeof value.candidate_name !== "string" ||
    !(
      typeof value.candidate_email === "string" ||
      value.candidate_email === null
    ) ||
    typeof value.file_name !== "string" ||
    typeof value.file_type !== "string" ||
    !Number.isInteger(value.file_size) ||
    !isCvStatus(value.status) ||
    !(Number.isInteger(value.uploaded_by) || value.uploaded_by === null) ||
    typeof value.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: value.id as number,
    candidate_name: value.candidate_name,
    candidate_email: value.candidate_email,
    file_name: value.file_name,
    file_type: value.file_type,
    file_size: value.file_size as number,
    status: value.status,
    uploaded_by: value.uploaded_by as number | null,
    created_at: value.created_at,
  };
}

function apiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new CvsApiError(
      "Set NEXT_PUBLIC_API_BASE_URL to connect the backend.",
      0,
    );
  }
  return `${baseUrl}/api/v1/cvs${path}`;
}

function getErrorMessage(body: unknown, status: number): string {
  if (!isRecord(body)) return `Request failed (${status}).`;
  if (typeof body.message === "string") return body.message;

  if (Array.isArray(body.detail)) {
    const messages = body.detail
      .map((item) =>
        isRecord(item) && typeof item.msg === "string" ? item.msg : "",
      )
      .filter(Boolean);
    if (messages.length > 0) return messages.join(" ");
  }
  if (typeof body.detail === "string") return body.detail;
  return `Request failed (${status}).`;
}

async function requestData(
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<unknown> {
  const url = apiUrl(path);
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  const accessToken = getAuthAccessToken();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal,
      credentials: "omit",
      headers,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new CvsApiError(
      "Could not reach the backend. Check that it is running.",
      0,
    );
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new CvsApiError(
      getErrorMessage(body, response.status),
      response.status,
    );
  }
  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) {
    throw new CvsApiError(
      isRecord(body) && typeof body.message === "string"
        ? body.message
        : "The backend returned an invalid response.",
      response.status,
    );
  }
  return body.data;
}

export async function uploadCv(
  input: {
    candidateName: string;
    candidateEmail?: string;
    file: File;
  },
  signal?: AbortSignal,
): Promise<CvSummary> {
  const formData = new FormData();
  formData.set("candidate_name", input.candidateName.trim());
  if (input.candidateEmail?.trim()) {
    formData.set("candidate_email", input.candidateEmail.trim());
  }
  formData.set("file", input.file);

  const uploaded = parseCvSummary(
    await requestData("/upload", { method: "POST", body: formData }, signal),
  );
  if (!uploaded) {
    throw new CvsApiError("The backend returned an invalid CV record.", 200);
  }
  return uploaded;
}

export async function listCvs({
  page,
  pageSize,
  signal,
}: {
  page: number;
  pageSize: number;
  signal?: AbortSignal;
}): Promise<CvPage> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  const data = await requestData(`?${params.toString()}`, undefined, signal);

  if (
    !isRecord(data) ||
    !Array.isArray(data.items) ||
    !Number.isInteger(data.total) ||
    !Number.isInteger(data.page) ||
    !Number.isInteger(data.page_size) ||
    !Number.isInteger(data.total_pages)
  ) {
    throw new CvsApiError("The backend returned an invalid CV list.", 200);
  }

  const items = data.items.map(parseCvSummary);
  if (items.some((item) => item === null)) {
    throw new CvsApiError("The backend returned an invalid CV record.", 200);
  }

  return {
    items: items as CvSummary[],
    total: data.total as number,
    page: data.page as number,
    page_size: data.page_size as number,
    total_pages: data.total_pages as number,
  };
}
