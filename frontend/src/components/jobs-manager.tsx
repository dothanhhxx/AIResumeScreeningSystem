"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  archiveJob,
  createJob,
  JobsApiError,
  listJobs,
  updateJob,
  type Job,
  type JobInput,
  type JobStatus,
} from "@/lib/jobs-api";
import { useI18n } from "@/i18n/provider";
import type { TranslationKey } from "@/i18n/messages";

const PAGE_SIZE = 10;
const filters = [
  { label: "All roles", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Closed", value: "closed" },
  { label: "Archived", value: "archived" },
] as const satisfies readonly {
  label: TranslationKey;
  value: JobStatus | "all";
}[];

function formatDate(value: string, language: "en" | "vi"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

const statusLabels: Record<JobStatus, TranslationKey> = {
  draft: "Draft",
  active: "Active",
  closed: "Closed",
  archived: "Archived",
};

function messageForError(
  error: unknown,
  t: (key: TranslationKey) => string,
): string {
  if (
    error instanceof JobsApiError &&
    error.message === "Set NEXT_PUBLIC_API_BASE_URL to connect the backend."
  ) {
    return t(
      "Backend connection is not configured. Set NEXT_PUBLIC_API_BASE_URL in the frontend environment.",
    );
  }
  if (error instanceof JobsApiError && error.status === 404) {
    return t("The job management API route is not available yet.");
  }
  if (error instanceof JobsApiError && error.status === 401) {
    return t("Your session expired or is invalid. Sign in again.");
  }
  if (error instanceof JobsApiError && error.status === 0) {
    return t("Could not reach the backend. Check that it is running.");
  }
  return error instanceof Error
    ? error.message
    : t("Something went wrong. Please try again.");
}

function JobForm({
  job,
  saving,
  onCancel,
  onSubmit,
}: {
  job: Job | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: JobInput, status?: JobStatus) => void;
}) {
  const { t } = useI18n();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const skills = String(form.get("required_skills") ?? "")
      .split(/[\n,]/)
      .map((skill) => skill.trim())
      .filter(Boolean);
    const experience = String(form.get("experience_years") ?? "").trim();
    const input: JobInput = {
      title: String(form.get("title") ?? "").trim(),
      department: String(form.get("department") ?? "").trim() || null,
      location: String(form.get("location") ?? "").trim() || null,
      description: String(form.get("description") ?? "").trim(),
      requirements: String(form.get("requirements") ?? "").trim() || null,
      required_skills: skills,
      experience_years: experience ? Number(experience) : null,
      education_level: String(form.get("education_level") ?? "").trim() || null,
    };
    const statusValue = form.get("status");
    onSubmit(
      input,
      statusValue ? (String(statusValue) as JobStatus) : undefined,
    );
  }

  return (
    <form className="job-form" onSubmit={handleSubmit}>
      <div className="job-form-grid">
        <label className="form-field form-field-wide">
          <span>
            {t("Job title")} <b>*</b>
          </span>
          <input
            name="title"
            required
            maxLength={255}
            defaultValue={job?.title ?? ""}
            placeholder={t("e.g. Product Designer")}
          />
        </label>
        <label className="form-field">
          <span>{t("Department")}</span>
          <input
            name="department"
            maxLength={255}
            defaultValue={job?.department ?? ""}
            placeholder={t("e.g. Product")}
          />
        </label>
        <label className="form-field">
          <span>{t("Location")}</span>
          <input
            name="location"
            maxLength={255}
            defaultValue={job?.location ?? ""}
            placeholder={t("e.g. Hanoi / Remote")}
          />
        </label>
        <label className="form-field form-field-wide">
          <span>
            {t("Description")} <b>*</b>
          </span>
          <textarea
            name="description"
            required
            defaultValue={job?.description ?? ""}
            rows={5}
            placeholder={t("Describe the role and its responsibilities.")}
          />
        </label>
        <label className="form-field form-field-wide">
          <span>{t("Requirements")}</span>
          <textarea
            name="requirements"
            defaultValue={job?.requirements ?? ""}
            rows={3}
            placeholder={t("Add qualifications or additional requirements.")}
          />
        </label>
        <label className="form-field form-field-wide">
          <span>{t("Required skills")}</span>
          <textarea
            name="required_skills"
            defaultValue={job?.required_skills?.join(", ") ?? ""}
            rows={2}
            placeholder={t("Python, SQL, Product design")}
          />
          <small>{t("Separate skills with commas or new lines.")}</small>
        </label>
        <label className="form-field">
          <span>{t("Experience (years)")}</span>
          <input
            name="experience_years"
            type="number"
            min={0}
            step={1}
            defaultValue={job?.experience_years ?? ""}
            placeholder={t("e.g. 3")}
          />
        </label>
        <label className="form-field">
          <span>{t("Education level")}</span>
          <input
            name="education_level"
            maxLength={100}
            defaultValue={job?.education_level ?? ""}
            placeholder={t("e.g. Bachelor's degree")}
          />
        </label>
        {job && (
          <label className="form-field">
            <span>{t("Status")}</span>
            <select name="status" defaultValue={job.status}>
              {filters
                .filter((filter) => filter.value !== "all")
                .map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {t(filter.label)}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      <div className="job-form-footer">
        <span>
          <b>*</b> {t("Required fields. New jobs start as drafts.")}
        </span>
        <div>
          <button
            className="button button-secondary"
            type="button"
            onClick={onCancel}
            disabled={saving}
          >
            {t("Cancel")}
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={saving}
          >
            {saving
              ? t("Saving…")
              : job
                ? t("Save changes")
                : t("Create draft")}
          </button>
        </div>
      </div>
    </form>
  );
}

export function JobsManager() {
  const { t, language } = useI18n();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [notice, setNotice] = useState<TranslationKey | "">("");
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [creating, setCreating] = useState(false);
  const [archivingJob, setArchivingJob] = useState<Job | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadJobs() {
      setLoading(true);
      setLoadError(null);
      try {
        const result = await listJobs({
          page,
          pageSize: PAGE_SIZE,
          status: statusFilter,
          signal: controller.signal,
        });
        setJobs(result.items);
        setTotal(result.total);
        setTotalPages(Math.max(result.total_pages, 1));
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setLoadError(loadError);
        setJobs([]);
        setTotal(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadJobs();
    return () => controller.abort();
  }, [page, statusFilter, reloadVersion]);

  async function handleSave(input: JobInput, nextStatus?: JobStatus) {
    setSaving(true);
    setActionError(null);
    try {
      if (editingJob) {
        await updateJob(editingJob.id, {
          ...input,
          status: nextStatus ?? editingJob.status,
        });
        setNotice("Job description updated.");
      } else {
        await createJob(input);
        setNotice("Draft job description created.");
        setPage(1);
      }
      setCreating(false);
      setEditingJob(null);
      setReloadVersion((version) => version + 1);
    } catch (saveError) {
      setActionError(saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!archivingJob) return;
    setSaving(true);
    setActionError(null);
    try {
      await archiveJob(archivingJob.id);
      setNotice("Job description archived. Its match history is retained.");
      setArchivingJob(null);
      setReloadVersion((version) => version + 1);
    } catch (archiveError) {
      setActionError(archiveError);
    } finally {
      setSaving(false);
    }
  }

  function chooseFilter(value: JobStatus | "all") {
    setStatusFilter(value);
    setPage(1);
  }

  function openCreateDialog() {
    setActionError(null);
    setCreating(true);
  }

  function openEditDialog(job: Job) {
    setActionError(null);
    setEditingJob(job);
  }

  function openArchiveDialog(job: Job) {
    setActionError(null);
    setArchivingJob(job);
  }

  const modalJob = editingJob;
  const noRolesForFilter = total === 0 && statusFilter !== "all";

  return (
    <>
      <div className="jobs-toolbar">
        <div
          className="filter-tabs"
          role="group"
          aria-label={t("Filter job descriptions")}
        >
          {filters.map((filter) => (
            <button
              className={`filter-tab${statusFilter === filter.value ? " filter-tab-active" : ""}`}
              key={filter.value}
              type="button"
              aria-pressed={statusFilter === filter.value}
              onClick={() => chooseFilter(filter.value)}
            >
              {t(filter.label)}
            </button>
          ))}
        </div>
        <div className="jobs-toolbar-actions">
          {!loading && loadError === null && (
            <p className="jobs-total">
              {total === 1
                ? t("{{count}} role", { count: total })
                : t("{{count}} roles", { count: total })}
            </p>
          )}
          <button
            className="button button-primary"
            type="button"
            onClick={openCreateDialog}
          >
            <span className="button-plus">+</span> {t("New job")}
          </button>
        </div>
      </div>

      {notice && (
        <div className="jobs-alert jobs-alert-success" role="status">
          <span>{t(notice)}</span>
          <button
            type="button"
            aria-label={t("Dismiss notification")}
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}

      <section className="panel jobs-panel" aria-label={t("Job descriptions")}>
        {loading ? (
          <div className="jobs-state" role="status" aria-live="polite">
            <span className="loading-mark" aria-hidden="true" />
            <p>{t("Loading job descriptions…")}</p>
          </div>
        ) : loadError !== null ? (
          <div className="jobs-state jobs-state-error" role="alert">
            <span className="empty-icon" aria-hidden="true">
              !
            </span>
            <h2>{t("Could not load job descriptions.")}</h2>
            <p>{messageForError(loadError, t)}</p>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setReloadVersion((version) => version + 1)}
            >
              {t("Retry")}
            </button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="jobs-state" role="status">
            <span className="empty-icon" aria-hidden="true">
              ▤
            </span>
            <h2>
              {noRolesForFilter
                ? t("No roles match this filter")
                : total === 0
                  ? t("No job descriptions yet")
                  : t("No roles on this page")}
            </h2>
            <p>
              {noRolesForFilter
                ? t("Try another status filter to find a job description.")
                : total === 0
                  ? t(
                      "Create a draft JD to start organizing the role requirements for your team.",
                    )
                  : t(
                      "Return to the previous page to see the remaining roles.",
                    )}
            </p>
            {noRolesForFilter ? (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => chooseFilter("all")}
              >
                {t("Show all roles")}
              </button>
            ) : total === 0 ? (
              <button
                className="button button-primary"
                type="button"
                onClick={openCreateDialog}
              >
                {t("Create your first draft")}
              </button>
            ) : (
              <button
                className="button button-secondary"
                type="button"
                onClick={() =>
                  page > 1
                    ? setPage((current) => Math.max(current - 1, 1))
                    : setReloadVersion((version) => version + 1)
                }
              >
                {t(page > 1 ? "Previous" : "Retry")}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>{t("JOB TITLE")}</th>
                    <th>{t("REQUIRED SKILLS")}</th>
                    <th>{t("STATUS")}</th>
                    <th>{t("LAST UPDATED")}</th>
                    <th>
                      <span className="sr-only">{t("Actions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td>
                        <div className="role-title">{job.title}</div>
                        <div className="role-department">
                          {[job.department, job.location]
                            .filter(Boolean)
                            .join(" · ") ||
                            t("Department and location not set")}
                        </div>
                      </td>
                      <td>
                        <div className="job-skill-list">
                          {job.required_skills?.length ? (
                            job.required_skills.slice(0, 3).map((skill) => (
                              <span className="skill-chip" key={skill}>
                                {skill}
                              </span>
                            ))
                          ) : (
                            <span className="muted-cell">
                              {t("Not specified")}
                            </span>
                          )}
                          {(job.required_skills?.length ?? 0) > 3 && (
                            <span className="skill-overflow">
                              +{(job.required_skills?.length ?? 0) - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill status-${job.status}`}>
                          <span />
                          {t(statusLabels[job.status])}
                        </span>
                      </td>
                      <td className="muted-cell">
                        {formatDate(job.updated_at, language)}
                      </td>
                      <td>
                        <div className="job-row-actions">
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => openEditDialog(job)}
                            aria-label={`${t("Edit")} ${job.title}`}
                          >
                            {t("Edit")}
                          </button>
                          {job.status !== "archived" && (
                            <button
                              className="icon-button icon-button-danger"
                              type="button"
                              onClick={() => openArchiveDialog(job)}
                              aria-label={`${t("Archive")} ${job.title}`}
                            >
                              {t("Archive")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="jobs-pagination">
              <span>
                {t("Showing {{start}}–{{end}} of {{total}}", {
                  start: total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1,
                  end: Math.min(page * PAGE_SIZE, total),
                  total,
                })}
              </span>
              <div>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  {t("Previous")}
                </button>
                <span>
                  {t("Page {{page}} of {{total}}", { page, total: totalPages })}
                </span>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {t("Next")}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {creating && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-modal-title"
          >
            <header className="modal-header">
              <div>
                <p className="eyebrow">{t("JOB_DESCRIPTION")}</p>
                <h2 id="job-modal-title">{t("Create a draft")}</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setCreating(false)}
                aria-label={t("Close dialog")}
              >
                ×
              </button>
            </header>
            {actionError !== null && (
              <div className="jobs-alert jobs-alert-error" role="alert">
                {messageForError(actionError, t)}
              </div>
            )}
            <JobForm
              job={null}
              saving={saving}
              onCancel={() => setCreating(false)}
              onSubmit={handleSave}
            />
          </section>
        </div>
      )}
      {modalJob && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-modal-title"
          >
            <header className="modal-header">
              <div>
                <p className="eyebrow">{t("JOB_DESCRIPTION")}</p>
                <h2 id="job-modal-title">{t("Edit role")}</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setEditingJob(null)}
                aria-label={t("Close dialog")}
              >
                ×
              </button>
            </header>
            {actionError !== null && (
              <div className="jobs-alert jobs-alert-error" role="alert">
                {messageForError(actionError, t)}
              </div>
            )}
            <JobForm
              key={modalJob.id}
              job={modalJob}
              saving={saving}
              onCancel={() => setEditingJob(null)}
              onSubmit={handleSave}
            />
          </section>
        </div>
      )}
      {archivingJob && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal-card confirm-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="archive-modal-title"
          >
            <header className="modal-header">
              <div>
                <p className="eyebrow">{t("ARCHIVE_ROLE")}</p>
                <h2 id="archive-modal-title">
                  {t("Archive “{{title}}”?", { title: archivingJob.title })}
                </h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setArchivingJob(null)}
                aria-label={t("Close dialog")}
              >
                ×
              </button>
            </header>
            {actionError !== null && (
              <div className="jobs-alert jobs-alert-error" role="alert">
                {messageForError(actionError, t)}
              </div>
            )}
            <p className="confirm-copy">
              {t(
                "The role will leave active hiring filters. Existing match history remains available.",
              )}
            </p>
            <div className="confirm-actions">
              <button
                className="button button-secondary"
                type="button"
                disabled={saving}
                onClick={() => setArchivingJob(null)}
              >
                {t("Cancel")}
              </button>
              <button
                className="button button-danger"
                type="button"
                disabled={saving}
                onClick={() => void handleArchive()}
              >
                {saving ? t("Archiving…") : t("Archive role")}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
