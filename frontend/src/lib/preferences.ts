import { useSyncExternalStore } from "react";

/**
 * Per-viewer interface preferences, kept in localStorage.
 *
 * Storage can be unavailable (private windows, blocked site data), so reads
 * fall back to an in-memory copy and then to the defaults, and writes are
 * best-effort. Components read them with `usePreferences()`.
 */

export type Preferences = {
  /** Start candidate review with names and emails hidden. */
  hideIdentity: boolean;
  /** Turn off interface animation regardless of the OS setting. */
  reduceMotion: boolean;
};

const STORAGE_KEY = "talentlens-preferences";
export const PREFERENCES_CHANGE_EVENT = "talentlens-preferences-change";

export const DEFAULT_PREFERENCES: Preferences = {
  hideIdentity: true,
  reduceMotion: false,
};

let memory: Preferences | null = null;
let cachedRaw: string | null | undefined;
let cachedPrefs: Preferences = DEFAULT_PREFERENCES;

function parse(raw: string | null): Preferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      hideIdentity:
        typeof parsed.hideIdentity === "boolean"
          ? parsed.hideIdentity
          : DEFAULT_PREFERENCES.hideIdentity,
      reduceMotion:
        typeof parsed.reduceMotion === "boolean"
          ? parsed.reduceMotion
          : DEFAULT_PREFERENCES.reduceMotion,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Current preferences; returns the same object until something changes. */
export function readPreferences(): Preferences {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memory ?? DEFAULT_PREFERENCES;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedPrefs = parse(raw);
  }
  return cachedPrefs;
}

export function writePreferences(next: Preferences): void {
  memory = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The in-memory copy keeps the change for this page view.
  }
  window.dispatchEvent(
    new CustomEvent<Preferences>(PREFERENCES_CHANGE_EVENT, { detail: next }),
  );
}

function subscribe(callback: () => void) {
  window.addEventListener(PREFERENCES_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(PREFERENCES_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** Live preferences; the server render uses the defaults. */
export function usePreferences(): Preferences {
  return useSyncExternalStore(
    subscribe,
    readPreferences,
    () => DEFAULT_PREFERENCES,
  );
}
