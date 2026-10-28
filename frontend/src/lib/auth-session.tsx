"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { AuthToken, AuthUser } from "@/lib/auth-api";

const SESSION_STORAGE_KEY = "talentlens-auth-session";
const SESSION_CHANGE_EVENT = "talentlens-auth-session-change";
const MAX_TIMEOUT_MS = 2_147_000_000;

export type SessionUser = Pick<AuthUser, "id" | "full_name" | "role">;

export type AuthSession = {
  accessToken: string;
  expiresAt: number;
  user: SessionUser;
};

type AuthSessionContextValue = {
  session: AuthSession | null;
  signIn: (token: AuthToken) => void;
  signOut: () => void;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

let cachedSession: AuthSession | null = null;
let hasReadStoredSession = false;

function isSessionUser(value: unknown): value is SessionUser {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    Number.isInteger(user.id) &&
    Number(user.id) > 0 &&
    typeof user.full_name === "string" &&
    user.full_name.length > 0 &&
    (user.role === "admin" ||
      user.role === "recruiter" ||
      user.role === "viewer")
  );
}

function readStoredSession(): AuthSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const value = parsed as Record<string, unknown>;
    if (
      typeof value.accessToken !== "string" ||
      value.accessToken.length === 0 ||
      typeof value.expiresAt !== "number" ||
      !Number.isFinite(value.expiresAt) ||
      !isSessionUser(value.user) ||
      value.expiresAt <= Date.now()
    ) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    return {
      accessToken: value.accessToken,
      expiresAt: value.expiresAt,
      user: value.user,
    };
  } catch {
    return null;
  }
}

function getSessionSnapshot(): AuthSession | null {
  if (!hasReadStoredSession) {
    cachedSession = readStoredSession();
    hasReadStoredSession = true;
  }
  return cachedSession;
}

function getServerSessionSnapshot(): null {
  return null;
}

function subscribeToSession(callback: () => void) {
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key !== null && event.key !== SESSION_STORAGE_KEY) return;
    cachedSession = readStoredSession();
    hasReadStoredSession = true;
    callback();
  };

  window.addEventListener(SESSION_CHANGE_EVENT, callback);
  window.addEventListener("storage", handleStorageChange);
  return () => {
    window.removeEventListener(SESSION_CHANGE_EVENT, callback);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function notifySessionChange() {
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

function expireSessionAt(expiresAt: number, signOut: () => void) {
  let timeoutId: number;

  const checkExpiry = () => {
    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) {
      signOut();
      return;
    }
    timeoutId = window.setTimeout(
      checkExpiry,
      Math.min(remainingMs, MAX_TIMEOUT_MS),
    );
  };

  timeoutId = window.setTimeout(
    checkExpiry,
    Math.min(Math.max(0, expiresAt - Date.now()), MAX_TIMEOUT_MS),
  );
  return () => window.clearTimeout(timeoutId);
}

export function getAuthAccessToken(): string | null {
  return getSessionSnapshot()?.accessToken ?? null;
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );

  const signOut = useCallback(() => {
    cachedSession = null;
    hasReadStoredSession = true;
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // The session still clears in memory when browser storage is unavailable.
    }
    notifySessionChange();
  }, []);

  const signIn = useCallback((token: AuthToken) => {
    cachedSession = {
      accessToken: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
      user: {
        id: token.user.id,
        full_name: token.user.full_name,
        role: token.user.role,
      },
    };
    hasReadStoredSession = true;

    try {
      window.sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(cachedSession),
      );
    } catch {
      // Keep the signed-in session in memory for this tab.
    }
    notifySessionChange();
  }, []);

  useEffect(() => {
    if (!session) return;
    return expireSessionAt(session.expiresAt, signOut);
  }, [session, signOut]);

  const value = useMemo(
    () => ({ session, signIn, signOut }),
    [session, signIn, signOut],
  );

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const value = useContext(AuthSessionContext);
  if (!value) {
    throw new Error("useAuthSession must be used within AuthSessionProvider.");
  }
  return value;
}
