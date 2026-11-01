import { getAuthAccessToken } from "@/lib/auth-session";

/** Error raised for any failed call to the backend `/api/v1` routes. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function apiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new ApiError(
      "Set NEXT_PUBLIC_API_BASE_URL to connect the backend.",
      0,
    );
  }
  return baseUrl;
}

function errorMessage(body: unknown, status: number): string {
  if (isRecord(body)) {
    if (typeof body.message === "string") return body.message;
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      const messages = body.detail
        .map((item) =>
          isRecord(item) && typeof item.msg === "string" ? item.msg : "",
        )
        .filter(Boolean);
      if (messages.length > 0) return messages.join(" ");
    }
  }
  return `Request failed (${status}).`;
}

async function send(
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAuthAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  try {
    return await fetch(`${apiBaseUrl()}/api/v1${path}`, {
      ...init,
      signal,
      headers,
      credentials: "omit",
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "Could not reach the backend. Check that it is running.",
      0,
    );
  }
}

/** Call an endpoint that returns the shared `{ success, message, data }` envelope. */
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const response = await send(path, init, signal);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(errorMessage(body, response.status), response.status);
  }
  if (!isRecord(body) || body.success !== true || !("data" in body)) {
    throw new ApiError(
      "The backend returned an invalid response.",
      response.status,
    );
  }
  return body.data as T;
}

/** Download a binary endpoint and hand it to the browser as a file. */
export async function apiDownload(
  path: string,
  fallbackName: string,
): Promise<void> {
  const response = await send(path, { headers: { Accept: "*/*" } });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(errorMessage(body, response.status), response.status);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = match?.[1] ?? fallbackName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
