import { apiRequest } from "@/lib/api";
import type { AuthUser } from "@/lib/auth-api";

export type UserRole = AuthUser["role"];

export const USER_ROLES: UserRole[] = ["admin", "recruiter", "viewer"];

export type ManagedUser = {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  jobs_created: number;
  cvs_uploaded: number;
  decisions_made: number;
};

export type UserFilters = {
  search?: string;
  role?: UserRole | "";
  active?: boolean | null;
};

export type UserUpdate = Partial<{
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  password: string;
}>;

/** Accounts with hiring activity are locked, not deleted, so history stays attributable. */
export function hasActivity(user: ManagedUser): boolean {
  return Boolean(user.jobs_created || user.cvs_uploaded || user.decisions_made);
}

export function listUsers(
  filters: UserFilters,
  signal?: AbortSignal,
): Promise<ManagedUser[]> {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.role) params.set("role", filters.role);
  if (filters.active !== null && filters.active !== undefined)
    params.set("active", String(filters.active));
  const query = params.toString();
  return apiRequest<ManagedUser[]>(
    `/users${query ? `?${query}` : ""}`,
    undefined,
    signal,
  );
}

export function updateUser(
  id: number,
  changes: UserUpdate,
): Promise<ManagedUser> {
  return apiRequest<ManagedUser>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

export function deleteUser(id: number): Promise<null> {
  return apiRequest<null>(`/users/${id}`, { method: "DELETE" });
}

/** Public sign-up is only open before the first (admin) account exists. */
export async function isRegistrationOpen(
  signal?: AbortSignal,
): Promise<boolean> {
  const status = await apiRequest<{ open: boolean }>(
    "/auth/registration",
    undefined,
    signal,
  );
  return status.open;
}
