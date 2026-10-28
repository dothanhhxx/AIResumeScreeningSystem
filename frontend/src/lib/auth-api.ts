export type AuthUser = {
  id: number;
  email: string;
  full_name: string;
  role: "admin" | "recruiter" | "viewer";
  is_active: boolean;
  created_at: string;
};

export type AuthToken = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: AuthUser;
};

export type RegisterInput = {
  email: string;
  password: string;
  full_name: string;
};

type AuthApiErrorKind = "configuration" | "network" | "response";

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: AuthApiErrorKind = "response",
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!isRecord(value)) return false;
  return (
    Number.isInteger(value.id) &&
    Number(value.id) > 0 &&
    typeof value.email === "string" &&
    typeof value.full_name === "string" &&
    (value.role === "admin" ||
      value.role === "recruiter" ||
      value.role === "viewer") &&
    typeof value.is_active === "boolean" &&
    typeof value.created_at === "string"
  );
}

function isAuthToken(value: unknown): value is AuthToken {
  if (!isRecord(value)) return false;
  return (
    typeof value.access_token === "string" &&
    value.access_token.length > 0 &&
    value.token_type === "bearer" &&
    typeof value.expires_in === "number" &&
    Number.isFinite(value.expires_in) &&
    value.expires_in > 0 &&
    isAuthUser(value.user)
  );
}

function getApiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new AuthApiError(
      "API base URL is not configured.",
      0,
      "configuration",
    );
  }
  return `${baseUrl}/api/v1/auth${path}`;
}

function getErrorMessage(body: unknown, status: number): string {
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

async function request<T>(
  path: string,
  init: RequestInit,
  accessToken?: string,
): Promise<T> {
  const url = getApiUrl(path);
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: "omit",
      headers,
    });
  } catch {
    throw new AuthApiError(
      "Could not reach the authentication service.",
      0,
      "network",
    );
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AuthApiError(
      getErrorMessage(body, response.status),
      response.status,
    );
  }

  if (
    !isRecord(body) ||
    body.success !== true ||
    body.data === null ||
    body.data === undefined
  ) {
    throw new AuthApiError(
      "The authentication service returned an invalid response.",
      response.status,
    );
  }

  return body.data as T;
}

export async function loginAccount(input: {
  email: string;
  password: string;
}): Promise<AuthToken> {
  const result = await request<unknown>("/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!isAuthToken(result)) {
    throw new AuthApiError(
      "The authentication service returned an invalid response.",
      200,
    );
  }
  return result;
}

export async function registerAccount(
  input: RegisterInput,
  accessToken?: string,
): Promise<AuthUser> {
  const result = await request<unknown>(
    "/register",
    { method: "POST", body: JSON.stringify(input) },
    accessToken,
  );
  if (!isAuthUser(result)) {
    throw new AuthApiError(
      "The authentication service returned an invalid response.",
      201,
    );
  }
  return result;
}

export async function getCurrentUser(accessToken: string): Promise<AuthUser> {
  const result = await request<unknown>("/me", { method: "GET" }, accessToken);
  if (!isAuthUser(result)) {
    throw new AuthApiError(
      "The authentication service returned an invalid response.",
      200,
    );
  }
  return result;
}
