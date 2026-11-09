"use client";

import { useEffect } from "react";
import {
  PREFERENCES_CHANGE_EVENT,
  readPreferences,
  type Preferences,
} from "@/lib/preferences";

/** Mirrors the "Reduce motion" preference onto <html data-motion="reduce">. */
export function MotionPreference() {
  useEffect(() => {
    const apply = (prefs: Preferences) => {
      if (prefs.reduceMotion) {
        document.documentElement.dataset.motion = "reduce";
      } else {
        delete document.documentElement.dataset.motion;
      }
    };
    apply(readPreferences());
    const onChange = (event: Event) =>
      apply((event as CustomEvent<Preferences>).detail ?? readPreferences());
    window.addEventListener(PREFERENCES_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(PREFERENCES_CHANGE_EVENT, onChange);
  }, []);
  return null;
}
