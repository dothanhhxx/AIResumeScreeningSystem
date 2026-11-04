"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/provider";
import { isRegistrationOpen } from "@/lib/users-api";

/** null while checking; true only before the first (admin) account exists. */
export function useRegistrationOpen(): boolean | null {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    isRegistrationOpen(controller.signal)
      .then(setOpen)
      .catch(() => {
        // If the check fails, assume the safe state: sign-up closed.
        if (!controller.signal.aborted) setOpen(false);
      });
    return () => controller.abort();
  }, []);
  return open;
}

/**
 * Self-registration is closed. The form is shown only for initial setup, when
 * the workspace has no accounts yet and the first person becomes administrator.
 */
export function RegistrationGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const open = useRegistrationOpen();

  if (open === null) {
    return (
      <p className="login-notice" role="status">
        {t("Loading…")}
      </p>
    );
  }

  if (open) {
    return (
      <>
        <p className="login-notice login-notice-info" role="note">
          {t(
            "This workspace has no accounts yet. The account you create now becomes the administrator.",
          )}
        </p>
        {children}
      </>
    );
  }

  return (
    <div className="login-form">
      <p className="login-notice login-notice-info" role="status">
        {t(
          "Accounts are created by your workspace administrator. Ask them to add you, then sign in.",
        )}
      </p>
      <Link className="button button-primary" href="/login">
        {t("Go to sign in")}
      </Link>
    </div>
  );
}
