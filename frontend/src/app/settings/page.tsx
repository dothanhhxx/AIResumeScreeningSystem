"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Skeleton } from "@/components/skeleton";
import { useI18n } from "@/i18n/provider";
import type { TranslationKey } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import { getCurrentUser, type AuthUser } from "@/lib/auth-api";
import { getAuthAccessToken, useAuthSession } from "@/lib/auth-session";
import {
  changePassword,
  getSystemInfo,
  type SystemInfo,
} from "@/lib/insights-api";
import {
  usePreferences,
  writePreferences,
  type Preferences,
} from "@/lib/preferences";
import styles from "./settings.module.css";

const TABS = [
  { id: "account", label: "Account" },
  { id: "preferences", label: "Preferences" },
  { id: "engine", label: "AI engine" },
] as const satisfies readonly { id: string; label: TranslationKey }[];

type TabId = (typeof TABS)[number]["id"];

const roleLabels: Record<AuthUser["role"], TranslationKey> = {
  admin: "Administrator",
  recruiter: "Recruiter",
  viewer: "Viewer",
};

export default function SettingsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>("account");
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    account: null,
    preferences: null,
    engine: null,
  });
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  // The underline slides to the active tab; measured so translated labels fit.
  useLayoutEffect(() => {
    const element = tabRefs.current[tab];
    if (element)
      setIndicator({ left: element.offsetLeft, width: element.offsetWidth });
  }, [tab, t]);

  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    const index = TABS.findIndex((item) => item.id === tab);
    const delta =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? TABS.length - 1
          : (index + delta + TABS.length) % TABS.length;
    const next = TABS[nextIndex].id;
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("WORKSPACE")}</p>
          <h1>{t("Settings")}</h1>
          <p className="page-subtitle">
            {t(
              "Your account, how the workspace behaves for you, and how scores are produced.",
            )}
          </p>
        </div>
      </div>

      <div
        className={styles.tabs}
        role="tablist"
        aria-label={t("Settings")}
        onKeyDown={onTabKey}
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            ref={(element) => {
              tabRefs.current[item.id] = element;
            }}
            id={`tab-${item.id}`}
            className={styles.tab}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
          >
            {t(item.label)}
          </button>
        ))}
        <span
          className={styles.indicator}
          style={{
            transform: `translateX(${indicator.left}px)`,
            width: indicator.width,
          }}
          aria-hidden="true"
        />
      </div>

      <div
        key={tab}
        className={styles.panel}
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
      >
        {tab === "account" && <AccountTab />}
        {tab === "preferences" && <PreferencesTab />}
        {tab === "engine" && <EngineTab />}
      </div>
    </>
  );
}

/* ── Account ──────────────────────────────────────────────────────────────── */

function AccountTab() {
  const { t, language } = useI18n();
  const { updateSessionUser } = useAuthSession();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const token = getAuthAccessToken();
    if (!token) return;
    getCurrentUser(token)
      .then((latest) => {
        setUser(latest);
        updateSessionUser(latest);
      })
      .catch(() => undefined);
  }, [updateSessionUser]);

  const since = user
    ? new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
        dateStyle: "long",
      }).format(new Date(user.created_at))
    : null;

  return (
    <div className={styles.columns}>
      <section
        className={`panel ${styles.card}`}
        aria-labelledby="profile-title"
      >
        <h2 id="profile-title">{t("Profile")}</h2>
        <p className={styles.lead}>
          {t("Ask an administrator to change your name, email or role.")}
        </p>
        <dl className={styles.facts}>
          <div>
            <dt>{t("Full name")}</dt>
            <dd>{user ? user.full_name : <Skeleton width={140} />}</dd>
          </div>
          <div>
            <dt>{t("Work email")}</dt>
            <dd>{user ? user.email : <Skeleton width={180} />}</dd>
          </div>
          <div>
            <dt>{t("Role")}</dt>
            <dd>{user ? t(roleLabels[user.role]) : <Skeleton width={90} />}</dd>
          </div>
          <div>
            <dt>{t("Member since")}</dt>
            <dd>{since ?? <Skeleton width={120} />}</dd>
          </div>
        </dl>
      </section>
      <PasswordCard />
    </div>
  );
}

function PasswordCard() {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const mismatch = confirm.length > 0 && confirm !== next;
  const tooShort = next.length > 0 && next.length < 8;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mismatch || tooShort || !current) return;
    setSaving(true);
    setFeedback(null);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setFeedback({
        kind: "success",
        text: t("Password updated. Use it the next time you sign in."),
      });
    } catch (reason) {
      setFeedback({
        kind: "error",
        text:
          reason instanceof ApiError && reason.status === 400
            ? reason.message === "Current password is incorrect."
              ? t("Current password is incorrect.")
              : t("Choose a password you have not used for this account.")
            : t("Something went wrong. Please try again."),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className={`panel ${styles.card}`}
      aria-labelledby="password-title"
    >
      <h2 id="password-title">{t("Change password")}</h2>
      <p className={styles.lead}>{t("Use at least 8 characters.")}</p>
      <form className={styles.form} onSubmit={submit} noValidate>
        <label className="form-field">
          <span>{t("Current password")}</span>
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            required
          />
        </label>
        <label className="form-field">
          <span>{t("New password")}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={next}
            aria-invalid={tooShort || undefined}
            aria-describedby={tooShort ? "new-password-error" : undefined}
            onChange={(event) => setNext(event.target.value)}
            required
            minLength={8}
          />
          {tooShort && (
            <small id="new-password-error" className={styles.fieldError}>
              {t("Use at least 8 characters.")}
            </small>
          )}
        </label>
        <label className="form-field">
          <span>{t("Confirm new password")}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            aria-invalid={mismatch || undefined}
            aria-describedby={mismatch ? "confirm-password-error" : undefined}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
          {mismatch && (
            <small id="confirm-password-error" className={styles.fieldError}>
              {t("The two passwords do not match.")}
            </small>
          )}
        </label>
        {feedback && (
          <p
            className={
              feedback.kind === "success" ? styles.success : styles.error
            }
            role={feedback.kind === "success" ? "status" : "alert"}
          >
            {feedback.text}
          </p>
        )}
        <div className={styles.formActions}>
          <button
            className="button button-primary"
            type="submit"
            disabled={
              saving || !current || !next || !confirm || mismatch || tooShort
            }
          >
            {saving ? t("Saving…") : t("Update password")}
          </button>
        </div>
      </form>
    </section>
  );
}

/* ── Preferences ──────────────────────────────────────────────────────────── */

function PreferencesTab() {
  const { t, language, setLanguage } = useI18n();
  const prefs = usePreferences();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 1800);
    return () => window.clearTimeout(timer);
  }, [saved]);

  function update(patch: Partial<Preferences>) {
    writePreferences({ ...prefs, ...patch });
    setSaved(true);
  }

  return (
    <section
      className={`panel ${styles.card} ${styles.narrow}`}
      aria-labelledby="prefs-title"
    >
      <div className={styles.cardTitleRow}>
        <h2 id="prefs-title">{t("Preferences")}</h2>
        <span
          className={styles.savedNote}
          data-visible={saved || undefined}
          role="status"
        >
          {saved ? t("Saved on this device") : ""}
        </span>
      </div>
      <p className={styles.lead}>{t("Stored in this browser only.")}</p>

      <div className={styles.settingRow}>
        <div>
          <strong>{t("Display language")}</strong>
          <span className={styles.description}>
            {t("Applies to every page in this browser.")}
          </span>
        </div>
        <div
          className={styles.segmentedControl}
          role="radiogroup"
          aria-label={t("Display language")}
        >
          {(["en", "vi"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={language === value}
              onClick={() => {
                setLanguage(value);
                setSaved(true);
              }}
            >
              {value === "en" ? "English" : "Tiếng Việt"}
            </button>
          ))}
        </div>
      </div>

      <Toggle
        label={t("Hide candidate identity by default")}
        description={t(
          "Candidate review opens with names and emails hidden to reduce bias.",
        )}
        checked={prefs.hideIdentity}
        onChange={(checked) => update({ hideIdentity: checked })}
      />
      <Toggle
        label={t("Reduce motion")}
        description={t(
          "Turns off interface animation, even if your system allows it.",
        )}
        checked={prefs.reduceMotion}
        onChange={(checked) => update({ reduceMotion: checked })}
      />
    </section>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.settingRow}>
      <span>
        <strong>{label}</strong>
        <span className={styles.description}>{description}</span>
      </span>
      <span className={styles.switch}>
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span aria-hidden="true" />
      </span>
    </label>
  );
}

/* ── AI engine ────────────────────────────────────────────────────────────── */

function EngineTab() {
  const { t } = useI18n();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getSystemInfo(controller.signal)
      .then(setInfo)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <p className="cv-upload-message cv-upload-message-error" role="alert">
        {t("Something went wrong. Please try again.")}
      </p>
    );
  }

  const weights = info
    ? ([
        ["rule", t("Rules"), info.score_weights.rule],
        ["semantic", t("Semantic"), info.score_weights.semantic],
        ["llm", t("LLM"), info.score_weights.llm],
      ] as const)
    : [];

  return (
    <div className={styles.columns}>
      <section
        className={`panel ${styles.card}`}
        aria-labelledby="engine-title"
      >
        <div className={styles.cardTitleRow}>
          <h2 id="engine-title">{t("Scoring engine")}</h2>
          {info && (
            <span
              className={`status-pill ${info.llm_active ? "status-active" : "status-closed"}`}
            >
              {info.llm_active ? t("Language model on") : t("Offline scoring")}
            </span>
          )}
        </div>
        <p className={styles.lead}>
          {t(
            "Read-only. Administrators change these values in the backend configuration.",
          )}
        </p>
        <dl className={styles.facts}>
          <div>
            <dt>{t("Provider")}</dt>
            <dd>{info ? info.llm_provider : <Skeleton width={90} />}</dd>
          </div>
          <div>
            <dt>{t("Model")}</dt>
            <dd>
              {info ? (
                (info.llm_model ?? t("Not used"))
              ) : (
                <Skeleton width={140} />
              )}
            </dd>
          </div>
          <div>
            <dt>{t("Embedding model")}</dt>
            <dd>
              {info ? (
                (info.embedding_model ?? t("Offline text hashing"))
              ) : (
                <Skeleton width={140} />
              )}
            </dd>
          </div>
          <div>
            <dt>{t("Fallback when the model is unavailable")}</dt>
            <dd>
              {info ? (
                info.fallback_to_heuristic ? (
                  t("Rule-based scoring")
                ) : (
                  t("Off")
                )
              ) : (
                <Skeleton width={110} />
              )}
            </dd>
          </div>
          <div>
            <dt>{t("Engine version")}</dt>
            <dd>{info ? info.engine_version : <Skeleton width={70} />}</dd>
          </div>
        </dl>
      </section>

      <section
        className={`panel ${styles.card}`}
        aria-labelledby="weights-title"
      >
        <h2 id="weights-title">{t("Score weights")}</h2>
        <p className={styles.lead}>
          {t(
            "How much each signal counts toward the overall match score when it is available.",
          )}
        </p>
        <ul className={styles.weights}>
          {info
            ? weights.map(([key, label, value]) => (
                <li key={key}>
                  <span>{label}</span>
                  <span className={styles.weightTrack} aria-hidden="true">
                    <span style={{ width: `${value * 100}%` }} />
                  </span>
                  <strong>{Math.round(value * 100)}%</strong>
                </li>
              ))
            : Array.from({ length: 3 }, (_, index) => (
                <li key={index}>
                  <Skeleton width={70} />
                  <Skeleton />
                  <Skeleton width={32} />
                </li>
              ))}
        </ul>
        <dl className={`${styles.facts} ${styles.factsCompact}`}>
          <div>
            <dt>{t("Processing pipeline")}</dt>
            <dd>{info ? info.pipeline_mode : <Skeleton width={70} />}</dd>
          </div>
          <div>
            <dt>{t("File storage")}</dt>
            <dd>{info ? info.storage_backend : <Skeleton width={70} />}</dd>
          </div>
          <div>
            <dt>{t("Session length")}</dt>
            <dd>
              {info ? (
                t("{{minutes}} minutes", { minutes: info.session_minutes })
              ) : (
                <Skeleton width={90} />
              )}
            </dd>
          </div>
          <div>
            <dt>{t("App version")}</dt>
            <dd>{info ? info.app_version : <Skeleton width={50} />}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
