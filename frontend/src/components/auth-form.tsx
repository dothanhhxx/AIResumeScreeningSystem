"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/provider";
import type { TranslationKey } from "@/i18n/messages";
import { AuthApiError, loginAccount, registerAccount } from "@/lib/auth-api";
import { useAuthSession } from "@/lib/auth-session";

type FormNotice = {
  key: TranslationKey;
  kind: "error" | "info" | "success";
  values?: Record<string, string | number>;
};

function getErrorNotice(
  error: unknown,
  mode: "login" | "register",
): FormNotice {
  if (!(error instanceof AuthApiError)) {
    return {
      key: "The server could not complete the request. Try again later.",
      kind: "error",
    };
  }

  if (error.kind === "configuration") {
    return {
      key: "Authentication is not configured. Set NEXT_PUBLIC_API_BASE_URL.",
      kind: "error",
    };
  }
  if (error.kind === "network") {
    return {
      key: "Could not connect to the authentication service. Check that the backend is running.",
      kind: "error",
    };
  }
  if (error.status === 401 && mode === "login") {
    return { key: "Email or password is incorrect.", kind: "error" };
  }
  if (error.status === 401) {
    return {
      key: "Your session expired. Sign in again before creating an account.",
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
  if (error.status >= 500) {
    return {
      key: "The server could not complete the request. Try again later.",
      kind: "error",
    };
  }
  return {
    key: "Request failed ({{status}}).",
    kind: "error",
    values: { status: error.status },
  };
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [notice, setNotice] = useState<FormNotice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useI18n();
  const { session, signIn } = useAuthSession();
  const router = useRouter();
  const isRegistering = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") ?? "");
    const fullName = String(formData.get("full_name") ?? "").trim();

    if (isRegistering && !fullName) {
      setNotice({ key: "Check the information and try again.", kind: "error" });
      return;
    }

    setNotice(null);
    setIsSubmitting(true);
    try {
      if (isRegistering) {
        await registerAccount(
          { email, password, full_name: fullName },
          session?.accessToken,
        );
        setNotice({
          key: session
            ? "Account created. You can continue managing accounts."
            : "Account created. Sign in with your new account.",
          kind: "success",
        });
      } else {
        const token = await loginAccount({ email, password });
        signIn(token);
        router.replace("/dashboard");
      }
    } catch (error) {
      setNotice(getErrorNotice(error, mode));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="login-form"
      onSubmit={handleSubmit}
      aria-busy={isSubmitting}
    >
      {isRegistering && (
        <p className="login-help">
          {t(
            "The first account becomes an administrator. After setup, only administrators can create accounts.",
          )}
        </p>
      )}
      {isRegistering && (
        <>
          <label htmlFor="full-name">{t("Full name")}</label>
          <input
            id="full-name"
            name="full_name"
            type="text"
            autoComplete="name"
            placeholder={t("Your name")}
            maxLength={255}
            required
          />
        </>
      )}
      <label htmlFor="email">{t("Work email")}</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        maxLength={255}
        required
      />
      <div className="password-label">
        <label htmlFor="password">{t("Password")}</label>
        {!isRegistering && (
          <button
            className="text-button"
            type="button"
            onClick={() =>
              setNotice({
                key: "Password reset is not available yet.",
                kind: "info",
              })
            }
          >
            {t("Forgot password?")}
          </button>
        )}
      </div>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete={isRegistering ? "new-password" : "current-password"}
        placeholder={
          isRegistering ? t("At least 8 characters") : t("Enter your password")
        }
        minLength={isRegistering ? 8 : 1}
        maxLength={72}
        required
      />
      <button
        className="button button-primary login-submit"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting
          ? t(isRegistering ? "Creating an account…" : "Signing in…")
          : t(isRegistering ? "Create account" : "Sign in")}
        <span aria-hidden="true">→</span>
      </button>
      {notice && (
        <p
          className={`login-notice login-notice-${notice.kind}`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          {t(notice.key, notice.values)}
        </p>
      )}
      <p className="login-legal">
        {t(
          "By continuing, you agree to your organization's access and data handling policies.",
        )}
      </p>
    </form>
  );
}

export function AuthSwitch({ mode }: { mode: "login" | "register" }) {
  const isRegistering = mode === "register";
  const { t } = useI18n();

  return (
    <p className="login-support">
      {isRegistering
        ? t("Already have an account? ")
        : t("New to TalentLens? ")}
      <Link href={isRegistering ? "/login" : "/register"}>
        {isRegistering ? t("Sign in") : t("Create an account")}
      </Link>
    </p>
  );
}
