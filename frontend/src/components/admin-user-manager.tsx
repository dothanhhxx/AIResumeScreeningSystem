"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { Icon } from "@/components/icon";
import { Skeleton } from "@/components/skeleton";
import type { TranslationKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import { ApiError } from "@/lib/api";
import { AuthApiError, registerAccount } from "@/lib/auth-api";
import { useAuthSession } from "@/lib/auth-session";
import {
  USER_ROLES,
  deleteUser,
  hasActivity,
  listUsers,
  updateUser,
  type ManagedUser,
  type UserRole,
  type UserUpdate,
} from "@/lib/users-api";
import styles from "./admin-user-manager.module.css";

const roleLabels: Record<UserRole, TranslationKey> = {
  admin: "Administrator",
  recruiter: "Recruiter",
  viewer: "Viewer",
};

const roleDescriptions: Record<UserRole, TranslationKey> = {
  admin: "Full access, including user accounts and the audit log.",
  recruiter:
    "Creates job descriptions, uploads CVs, runs matching and records decisions.",
  viewer: "Read-only: sees job descriptions, CVs, rankings and reports.",
};

/** Backend messages that deserve a specific, translated explanation. */
const knownErrors: Record<string, TranslationKey> = {
  "You cannot remove your own administrator access.":
    "You cannot remove your own administrator access.",
  "The workspace needs at least one active administrator.":
    "The workspace needs at least one active administrator.",
  "You cannot delete your own account.": "You cannot delete your own account.",
};

type Notice = { kind: "success" | "error"; text: string };
type Confirm = { user: ManagedUser; action: "lock" | "unlock" | "delete" };

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export function AdminUserManager() {
  const { session, updateSessionUser } = useAuthSession();
  const { t, language } = useI18n();
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "locked">(
    "",
  );
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const isAdmin = session?.user.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    listUsers({}, controller.signal)
      .then((result) => {
        setUsers(result);
        setLoadError(null);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(
          reason instanceof ApiError && reason.status === 0
            ? t("Could not reach the backend. Check that it is running.")
            : t("Something went wrong. Please try again."),
        );
      });
    return () => controller.abort();
  }, [isAdmin, reloadVersion, t]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (users ?? []).filter(
      (user) =>
        (!roleFilter || user.role === roleFilter) &&
        (!statusFilter || (statusFilter === "active") === user.is_active) &&
        (!query ||
          user.full_name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)),
    );
  }, [users, search, roleFilter, statusFilter]);

  const counts = useMemo(() => {
    const all = users ?? [];
    return {
      admin: all.filter((u) => u.role === "admin" && u.is_active).length,
      recruiter: all.filter((u) => u.role === "recruiter" && u.is_active)
        .length,
      viewer: all.filter((u) => u.role === "viewer" && u.is_active).length,
      locked: all.filter((u) => !u.is_active).length,
    };
  }, [users]);

  const lastSeen = useMemo(() => {
    const format = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
    return (value: string | null) => {
      if (!value) return t("Never signed in");
      const minutes = Math.round(
        (new Date(value).getTime() - Date.now()) / 60000,
      );
      if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
      const hours = Math.round(minutes / 60);
      if (Math.abs(hours) < 24) return format.format(hours, "hour");
      return format.format(Math.round(hours / 24), "day");
    };
  }, [language, t]);

  function describeError(error: unknown, context: "update" | "delete"): string {
    if (error instanceof ApiError) {
      const known = knownErrors[error.message];
      if (known) return t(known);
      if (error.status === 409) {
        return context === "delete"
          ? t(
              "This account has hiring activity, so it cannot be deleted. Lock it instead.",
            )
          : t("An account with this email already exists.");
      }
      if (error.status === 422)
        return t("Check the information and try again.");
    }
    return t("Something went wrong. Please try again.");
  }

  function finish(text: string) {
    setNotice({ kind: "success", text });
    setReloadVersion((value) => value + 1);
  }

  async function runConfirm() {
    if (!confirm) return;
    const { user, action } = confirm;
    try {
      if (action === "delete") {
        await deleteUser(user.id);
        finish(t("{{name}} was deleted.", { name: user.full_name }));
      } else {
        await updateUser(user.id, { is_active: action === "unlock" });
        finish(
          action === "lock"
            ? t("{{name}} is locked and signed out.", { name: user.full_name })
            : t("{{name}} can sign in again.", { name: user.full_name }),
        );
      }
    } catch (error) {
      setNotice({
        kind: "error",
        text: describeError(error, action === "delete" ? "delete" : "update"),
      });
    } finally {
      setConfirm(null);
    }
  }

  if (!session) {
    return <p role="status">{t("Loading…")}</p>;
  }

  if (!isAdmin) {
    return (
      <section className="panel user-management-panel">
        <p className="login-notice login-notice-info" role="status">
          {t(
            "Only administrators can manage accounts. Contact your workspace administrator.",
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
            {t(
              "Only administrators create accounts. Change roles, lock access or remove accounts here.",
            )}
          </p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={() => setCreating(true)}
        >
          <span className="button-plus">+</span> {t("Add user")}
        </button>
      </header>

      {notice && (
        <div
          className={`jobs-alert ${notice.kind === "success" ? "jobs-alert-success" : "jobs-alert-error"}`}
          role={notice.kind === "success" ? "status" : "alert"}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            aria-label={t("Dismiss notification")}
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      )}

      <section className="panel" aria-labelledby="users-title">
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <h2 id="users-title">{t("Accounts")}</h2>
            {users && (
              <p>
                {t(
                  "Admins {{admins}} · Recruiters {{recruiters}} · Viewers {{viewers}} · Locked {{locked}}",
                  {
                    admins: counts.admin,
                    recruiters: counts.recruiter,
                    viewers: counts.viewer,
                    locked: counts.locked,
                  },
                )}
              </p>
            )}
          </div>
          <label className={`form-field ${styles.search}`}>
            <span className="sr-only">{t("Search")}</span>
            <span className={styles.searchInput}>
              <Icon name="search" size={16} />
              <input
                type="search"
                value={search}
                placeholder={t("Name or email")}
                onChange={(event) => setSearch(event.target.value)}
              />
            </span>
          </label>
          <label className="form-field">
            <span className="sr-only">{t("Role")}</span>
            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value as UserRole | "")
              }
            >
              <option value="">{t("All roles")}</option>
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(roleLabels[role])}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="sr-only">{t("Status")}</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "" | "active" | "locked")
              }
            >
              <option value="">{t("Any status")}</option>
              <option value="active">{t("Active")}</option>
              <option value="locked">{t("Locked")}</option>
            </select>
          </label>
        </div>

        {loadError && (
          <p className="cv-upload-message cv-upload-message-error" role="alert">
            {loadError}
          </p>
        )}

        {!users && !loadError && (
          <div
            className={styles.skeleton}
            role="status"
            aria-label={t("Loading…")}
          >
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index}>
                <Skeleton width={36} height={36} radius={999} />
                <Skeleton width="40%" />
                <Skeleton width={90} height={22} radius={999} />
                <Skeleton width="30%" />
              </div>
            ))}
          </div>
        )}

        {users && (
          <div className="table-wrap">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("User")}</th>
                  <th scope="col">{t("Role")}</th>
                  <th scope="col">{t("Status")}</th>
                  <th scope="col">{t("Activity")}</th>
                  <th scope="col">{t("Last sign-in")}</th>
                  <th scope="col">
                    <span className="sr-only">{t("Actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((user) => {
                  const isSelf = user.id === session.user.id;
                  const active = hasActivity(user);
                  return (
                    <tr
                      key={user.id}
                      className={user.is_active ? undefined : styles.lockedRow}
                    >
                      <th scope="row">
                        <span className={styles.person}>
                          <span className={styles.avatar} aria-hidden="true">
                            {initials(user.full_name)}
                          </span>
                          <span className={styles.personCopy}>
                            <strong>
                              {user.full_name}
                              {isSelf && (
                                <span className={styles.youBadge}>
                                  {t("You")}
                                </span>
                              )}
                            </strong>
                            <small>{user.email}</small>
                          </span>
                        </span>
                      </th>
                      <td>
                        <span className={`${styles.role} ${styles[user.role]}`}>
                          {t(roleLabels[user.role])}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${user.is_active ? "status-active" : "status-locked"}`}
                        >
                          {user.is_active ? t("Active") : t("Locked")}
                        </span>
                      </td>
                      <td className={styles.activity}>
                        {active
                          ? t(
                              "{{jobs}} JDs · {{cvs}} CVs · {{decisions}} decisions",
                              {
                                jobs: user.jobs_created,
                                cvs: user.cvs_uploaded,
                                decisions: user.decisions_made,
                              },
                            )
                          : t("No activity yet")}
                      </td>
                      <td className="muted-cell">
                        {lastSeen(user.last_login_at)}
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => setEditing(user)}
                            aria-label={`${t("Edit")} ${user.full_name}`}
                          >
                            {t("Edit")}
                          </button>
                          <button
                            className="icon-button"
                            type="button"
                            disabled={isSelf}
                            title={
                              isSelf
                                ? t("You cannot lock your own account.")
                                : undefined
                            }
                            onClick={() =>
                              setConfirm({
                                user,
                                action: user.is_active ? "lock" : "unlock",
                              })
                            }
                            aria-label={`${user.is_active ? t("Lock") : t("Unlock")} ${user.full_name}`}
                          >
                            {user.is_active ? t("Lock") : t("Unlock")}
                          </button>
                          <button
                            className="icon-button icon-button-danger"
                            type="button"
                            disabled={isSelf || active}
                            title={
                              isSelf
                                ? t("You cannot delete your own account.")
                                : active
                                  ? t(
                                      "This account has hiring activity, so it cannot be deleted. Lock it instead.",
                                    )
                                  : undefined
                            }
                            onClick={() =>
                              setConfirm({ user, action: "delete" })
                            }
                            aria-label={`${t("Delete")} ${user.full_name}`}
                          >
                            {t("Delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length === 0 && (
              <p className="cv-library-state dashboard-empty">
                {t("No accounts match these filters.")}
              </p>
            )}
          </div>
        )}
      </section>

      <section
        className={`panel ${styles.guide}`}
        aria-labelledby="roles-title"
      >
        <h2 id="roles-title">{t("What each role can do")}</h2>
        <ul>
          {USER_ROLES.map((role) => (
            <li key={role}>
              <span className={`${styles.role} ${styles[role]}`}>
                {t(roleLabels[role])}
              </span>
              <p>{t(roleDescriptions[role])}</p>
            </li>
          ))}
        </ul>
      </section>

      {creating && (
        <CreateUserDialog
          onClose={() => setCreating(false)}
          onCreated={(name) => {
            setCreating(false);
            finish(t("Account created for {{name}}.", { name }));
          }}
        />
      )}

      {editing && (
        <EditUserDialog
          user={editing}
          isSelf={editing.id === session.user.id}
          describeError={(error) => describeError(error, "update")}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            if (saved.id === session.user.id) updateSessionUser(saved);
            finish(t("Changes to {{name}} saved.", { name: saved.full_name }));
          }}
        />
      )}

      {confirm && (
        <Dialog
          titleId="confirm-user-title"
          role="alertdialog"
          className="confirm-card"
          title={
            confirm.action === "delete"
              ? t("Delete {{name}}?", { name: confirm.user.full_name })
              : confirm.action === "lock"
                ? t("Lock {{name}}?", { name: confirm.user.full_name })
                : t("Unlock {{name}}?", { name: confirm.user.full_name })
          }
          onClose={() => setConfirm(null)}
        >
          <p className="confirm-copy">
            {confirm.action === "delete"
              ? t("The account is removed permanently. This cannot be undone.")
              : confirm.action === "lock"
                ? t(
                    "They are signed out right away and cannot sign in until unlocked. Their history stays.",
                  )
                : t("They can sign in again with their current password.")}
          </p>
          <div className="confirm-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setConfirm(null)}
            >
              {t("Cancel")}
            </button>
            <button
              className={`button ${confirm.action === "unlock" ? "button-primary" : "button-danger"}`}
              type="button"
              onClick={() => void runConfirm()}
            >
              {confirm.action === "delete"
                ? t("Delete account")
                : confirm.action === "lock"
                  ? t("Lock account")
                  : t("Unlock account")}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

/* ── Create ──────────────────────────────────────────────────────────────── */

function createError(error: unknown): TranslationKey {
  if (error instanceof AuthApiError) {
    if (error.kind === "network") {
      return "Could not connect to the authentication service. Check that the backend is running.";
    }
    if (error.status === 409)
      return "An account with this email already exists.";
    if (error.status === 403 || error.status === 401) {
      return "Sign in as an administrator before creating additional accounts.";
    }
    if (error.status === 400 || error.status === 422)
      return "Check the information and try again.";
  }
  return "The server could not complete the request. Try again later.";
}

function CreateUserDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const { t } = useI18n();
  const { session } = useAuthSession();
  const [role, setRole] = useState<UserRole>("recruiter");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fullName = String(data.get("full_name") ?? "").trim();
    setSaving(true);
    setError(null);
    try {
      await registerAccount(
        {
          full_name: fullName,
          email: String(data.get("email") ?? "")
            .trim()
            .toLowerCase(),
          password: String(data.get("password") ?? ""),
          role,
        },
        session?.accessToken,
      );
      onCreated(fullName);
    } catch (reason) {
      setError(createError(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      titleId="create-user-title"
      eyebrow={t("ADMINISTRATION")}
      title={t("Add user")}
      onClose={onClose}
    >
      <form
        className={`user-account-form ${styles.dialogForm}`}
        onSubmit={submit}
        aria-busy={saving}
      >
        <label className="form-field">
          <span>{t("Full name")}</span>
          <input
            name="full_name"
            type="text"
            autoComplete="off"
            maxLength={255}
            required
          />
        </label>
        <label className="form-field">
          <span>{t("Work email")}</span>
          <input
            name="email"
            type="email"
            autoComplete="off"
            maxLength={255}
            required
          />
        </label>
        <label className="form-field">
          <span>{t("Temporary password")}</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />
          <small>
            {t(
              "Share it privately. They can change it in Settings after signing in.",
            )}
          </small>
        </label>
        <RolePicker value={role} onChange={setRole} />
        {error && (
          <p
            className="user-account-notice user-account-notice-error"
            role="alert"
          >
            {t(error)}
          </p>
        )}
        <div className="confirm-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={onClose}
          >
            {t("Cancel")}
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={saving}
          >
            {saving ? t("Creating an account…") : t("Create account")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/* ── Edit ────────────────────────────────────────────────────────────────── */

function EditUserDialog({
  user,
  isSelf,
  describeError,
  onClose,
  onSaved,
}: {
  user: ManagedUser;
  isSelf: boolean;
  describeError: (error: unknown) => string;
  onClose: () => void;
  onSaved: (saved: ManagedUser) => void;
}) {
  const { t } = useI18n();
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<UserRole>(user.role);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const changes: UserUpdate = {};
    if (fullName.trim() !== user.full_name) changes.full_name = fullName.trim();
    if (email.trim().toLowerCase() !== user.email)
      changes.email = email.trim().toLowerCase();
    if (role !== user.role) changes.role = role;
    if (password) changes.password = password;
    if (!Object.keys(changes).length) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await updateUser(user.id, changes));
    } catch (reason) {
      setError(describeError(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      titleId="edit-user-title"
      eyebrow={t("ADMINISTRATION")}
      title={t("Edit {{name}}", { name: user.full_name })}
      onClose={onClose}
    >
      <form
        className={`user-account-form ${styles.dialogForm}`}
        onSubmit={submit}
        aria-busy={saving}
      >
        <label className="form-field">
          <span>{t("Full name")}</span>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            maxLength={255}
            required
          />
        </label>
        <label className="form-field">
          <span>{t("Work email")}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={255}
            required
          />
        </label>
        <RolePicker
          value={role}
          onChange={setRole}
          disabled={isSelf}
          note={isSelf ? t("You cannot change your own role.") : undefined}
        />
        <label className="form-field">
          <span>{t("Reset password (optional)")}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            minLength={8}
            maxLength={72}
            onChange={(event) => setPassword(event.target.value)}
          />
          <small>{t("Leave empty to keep the current password.")}</small>
        </label>
        {error && (
          <p
            className="user-account-notice user-account-notice-error"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="confirm-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={onClose}
          >
            {t("Cancel")}
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={saving}
          >
            {saving ? t("Saving…") : t("Save changes")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function RolePicker({
  value,
  onChange,
  disabled = false,
  note,
}: {
  value: UserRole;
  onChange: (role: UserRole) => void;
  disabled?: boolean;
  note?: string;
}) {
  const { t } = useI18n();
  return (
    <fieldset className={styles.rolePicker} disabled={disabled}>
      <legend>{t("Role")}</legend>
      {USER_ROLES.map((role) => (
        <label key={role} className={styles.roleOption}>
          <input
            type="radio"
            name="role"
            value={role}
            checked={value === role}
            onChange={() => onChange(role)}
          />
          <span>
            <strong>{t(roleLabels[role])}</strong>
            <small>{t(roleDescriptions[role])}</small>
          </span>
        </label>
      ))}
      {note && <p className={styles.roleNote}>{note}</p>}
    </fieldset>
  );
}
