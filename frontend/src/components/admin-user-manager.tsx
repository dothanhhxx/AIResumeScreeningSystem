"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { TranslationKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import { AuthApiError, registerAccount } from "@/lib/auth-api";
import { useAuthSession } from "@/lib/auth-session";

type FormNotice = {
  key: TranslationKey;
  kind: "error" | "success";
};

function getRegistrationError(error: unknown): FormNotice {
  if (!(error instanceof AuthApiError)) {
    return {
      key: "The server could not complete the request. Try again later.",
      kind: "error",
    };
  }

  if (error.kind === "configuration") {
    return {
      key: "Authentication service is not configured. Set NEXT_PUBLIC_API_BASE_URL in the frontend environment.",
      kind: "error",
    };
  }
  if (error.kind === "network") {
    return {
      key: "Could not connect to the authentication service. Check that the backend is running.",
      kind: "error",
    };
  }
  if (error.status === 401) {
    return {
      key: "Sign in as an administrator before creating additional accounts.",
      kind: "error",
    };
  }
  if (error.status === 403) {
    return {
      key: "Only the first account or an administrator can create an account.",
      kind: "error",
    };
  }
  if (error.status === 409) {
    return { key: "An account with this email already exists.", kind: "error" };
  }
  if (error.status === 400 || error.status === 422) {
    return { key: "Check the information and try again.", kind: "error" };
  }
  return {
    key: "The server could not complete the request. Try again later.",
    kind: "error",
  };
}

export function AdminUserManager() {
  const { session } = useAuthSession();
  const { t } = useI18n();
  const [notice, setNotice] = useState<FormNotice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || session.user.role !== "admin" || isSubmitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const fullName = String(formData.get("full_name") ?? "").trim();
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") ?? "");

    setNotice(null);
    setIsSubmitting(true);
    try {
      await registerAccount(
        { full_name: fullName, email, password },
        session.accessToken,
      );
      form.reset();
      setNotice({
        key: "Account created. You can continue managing accounts.",
        kind: "success",
      });
    } catch (error) {
      setNotice(getRegistrationError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!session) {
    return <p role="status">{t("Loading…")}</p>;
  }

  if (session.user.role !== "admin") {
    return (
      <section className="panel user-management-panel">
        <p className="login-notice login-notice-info" role="status">
          {t(
            "Only administrators can create additional accounts. Contact your workspace administrator.",
          )}
        </p>
        <Link className="button button-secondary" href="/dashboard">
          {t("Back to workspace")}
        </Link>
      </section>
    );
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">{t("ADMINISTRATION")}</p>
          <h1>{t("User management")}</h1>
          <p className="page-subtitle">
            {t("Manage access to your hiring workspace.")}
          </p>
        </div>
      </header>

      <section
        className="panel user-management-panel"
        aria-labelledby="user-management-title"
      >
        <div className="user-management-card-heading">
          <h2 id="user-management-title">{t("Create a recruiter account")}</h2>
          <p>{t("New accounts are created with the Recruiter role.")}</p>
        </div>

        <form
          className="user-account-form"
          onSubmit={handleSubmit}
          aria-busy={isSubmitting}
        >
          <label className="form-field" htmlFor="user-full-name">
            <span>{t("Full name")}</span>
            <input
              id="user-full-name"
              name="full_name"
              type="text"
              autoComplete="name"
              maxLength={255}
              required
            />
          </label>

          <label className="form-field" htmlFor="user-email">
            <span>{t("Work email")}</span>
            <input
              id="user-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={255}
              required
            />
          </label>

          <label className="form-field" htmlFor="user-password">
            <span>{t("Password")}</span>
            <input
              id="user-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
            />
            <small>{t("Use at least 8 characters.")}</small>
          </label>

          {notice ? (
            <p
              className={`user-account-notice user-account-notice-${notice.kind}`}
              role={notice.kind === "error" ? "alert" : "status"}
            >
              {t(notice.key)}
            </p>
          ) : null}

          <div className="user-account-footer">
            <button
              className="button button-primary"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? t("Creating an account…") : t("Create account")}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
