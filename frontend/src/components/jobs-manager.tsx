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

const PAGE_SIZE = 10;
const filters: { label: string; value: JobStatus | "all" }[] = [
  { label: "All roles", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Closed", value: "closed" },
  { label: "Archived", value: "archived" },
];

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function messageForError(error: unknown): string {
  if (error instanceof JobsApiError && error.status === 401) {
    return "Your session is not authenticated. Sign in after Person A's auth API is connected.";
  }
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
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
            Job title <b>*</b>
          </span>
          <input
            name="title"
            required
            maxLength={255}
            defaultValue={job?.title ?? ""}
            placeholder="e.g. Product Designer"
          />
        </label>
        <label className="form-field">
          <span>Department</span>
          <input
            name="department"
            maxLength={255}
            defaultValue={job?.department ?? ""}
            placeholder="e.g. Product"
          />
        </label>
        <label className="form-field">
          <span>Location</span>
          <input
            name="location"
            maxLength={255}
            defaultValue={job?.location ?? ""}
            placeholder="e.g. Hanoi / Remote"
          />
        </label>
        <label className="form-field form-field-wide">
          <span>
            Description <b>*</b>
          </span>
          <textarea
            name="description"
            required
            defaultValue={job?.description ?? ""}
            rows={5}
            placeholder="Describe the role and its responsibilities."
          />
        </label>
        <label className="form-field form-field-wide">
          <span>Requirements</span>
          <textarea
            name="requirements"
            defaultValue={job?.requirements ?? ""}
            rows={3}
            placeholder="Add qualifications or additional requirements."
          />
        </label>
        <label className="form-field form-field-wide">
          <span>Required skills</span>
          <textarea
            name="required_skills"
            defaultValue={job?.required_skills?.join(", ") ?? ""}
            rows={2}
            placeholder="Python, SQL, Product design"
          />
          <small>Separate skills with commas or new lines.</small>
        </label>
        <label className="form-field">
          <span>Experience (years)</span>
          <input
            name="experience_years"
            type="number"
            min={0}
            step={1}
            defaultValue={job?.experience_years ?? ""}
            placeholder="e.g. 3"
          />
        </label>
        <label className="form-field">
          <span>Education level</span>
          <input
            name="education_level"
            maxLength={100}
            defaultValue={job?.education_level ?? ""}
            placeholder="e.g. Bachelor's degree"
          />
        </label>
        {job && (
          <label className="form-field">
            <span>Status</span>
            <select name="status" defaultValue={job.status}>
              {filters
                .filter((filter) => filter.value !== "all")
                .map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      <div className="job-form-footer">
        <span>
          <b>*</b> Required fields. New jobs start as drafts.
        </span>
        <div>
          <button
            className="button button-secondary"
            type="button"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving…" : job ? "Save changes" : "Create draft"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function JobsManager() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [creating, setCreating] = useState(false);
  const [archivingJob, setArchivingJob] = useState<Job | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadJobs() {
      setLoading(true);
      setError("");
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
        setError(messageForError(loadError));
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
    setError("");
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
      setError(messageForError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!archivingJob) return;
    setSaving(true);
    setError("");
    try {
      await archiveJob(archivingJob.id);
      setNotice("Job description archived. Its match history is retained.");
      setArchivingJob(null);
      setReloadVersion((version) => version + 1);
    } catch (archiveError) {
      setError(messageForError(archiveError));
    } finally {
      setSaving(false);
    }
  }

  function chooseFilter(value: JobStatus | "all") {
    setStatusFilter(value);
    setPage(1);
  }

  const modalJob = editingJob;

  return (
    <>
      <div className="jobs-toolbar">
        <div
          className="filter-tabs"
          role="group"
          aria-label="Filter job descriptions"
        >
          {filters.map((filter) => (
            <button
              className={`filter-tab${statusFilter === filter.value ? " filter-tab-active" : ""}`}
              key={filter.value}
              type="button"
              aria-pressed={statusFilter === filter.value}
              onClick={() => chooseFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="jobs-toolbar-actions">
          <p className="jobs-total">
            {total} {total === 1 ? "role" : "roles"}
          </p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => setCreating(true)}
          >
            <span className="button-plus">+</span> New job
          </button>
        </div>
      </div>

      {error && (
        <div className="jobs-alert jobs-alert-error" role="alert">
          <strong>Could not load job descriptions.</strong>
          <span>{error}</span>
          {!loading && (
            <button
              type="button"
              onClick={() => setReloadVersion((version) => version + 1)}
            >
              Retry
            </button>
          )}
        </div>
      )}
      {notice && (
        <div className="jobs-alert jobs-alert-success" role="status">
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}

      <section className="panel jobs-panel" aria-label="Job descriptions">
        {loading ? (
          <div className="jobs-state">
            <span className="loading-mark" />
            <p>Loading job descriptions…</p>
          </div>
        ) : error ? (
          <div className="jobs-state">
            <span className="empty-icon">!</span>
            <h2>Backend connection needed</h2>
            <p>
              Configure the API base URL and sign in once Person A&apos;s auth
              endpoint is integrated.
            </p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="jobs-state">
            <span className="empty-icon">▤</span>
            <h2>
              {total === 0
                ? "No job descriptions yet"
                : "No roles on this page"}
            </h2>
            <p>
              Create a draft JD to start organizing the role requirements for
              your team.
            </p>
            <button
              className="button button-primary"
              type="button"
              onClick={() => setCreating(true)}
            >
              Create your first draft
            </button>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>JOB TITLE</th>
                    <th>REQUIRED SKILLS</th>
                    <th>STATUS</th>
                    <th>LAST UPDATED</th>
                    <th>
                      <span className="sr-only">Actions</span>
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
                            .join(" · ") || "Department and location not set"}
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
                            <span className="muted-cell">Not specified</span>
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
                          {job.status}
                        </span>
                      </td>
                      <td className="muted-cell">
                        {formatDate(job.updated_at)}
                      </td>
                      <td>
                        <div className="job-row-actions">
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => setEditingJob(job)}
                            aria-label={`Edit ${job.title}`}
                          >
                            Edit
                          </button>
                          {job.status !== "archived" && (
                            <button
                              className="icon-button icon-button-danger"
                              type="button"
                              onClick={() => setArchivingJob(job)}
                              aria-label={`Archive ${job.title}`}
                            >
                              Archive
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
                Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
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
                <p className="eyebrow">JOB DESCRIPTION</p>
                <h2 id="job-modal-title">Create a draft</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setCreating(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            {error && (
              <div className="jobs-alert jobs-alert-error" role="alert">
                {error}
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
                <p className="eyebrow">JOB DESCRIPTION</p>
                <h2 id="job-modal-title">Edit role</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setEditingJob(null)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            {error && (
              <div className="jobs-alert jobs-alert-error" role="alert">
                {error}
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
                <p className="eyebrow">ARCHIVE ROLE</p>
                <h2 id="archive-modal-title">
                  Archive “{archivingJob.title}”?
                </h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setArchivingJob(null)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            {error && (
              <div className="jobs-alert jobs-alert-error" role="alert">
                {error}
              </div>
            )}
            <p className="confirm-copy">
              The role will leave active hiring filters. Existing match history
              remains available.
            </p>
            <div className="confirm-actions">
              <button
                className="button button-secondary"
                type="button"
                disabled={saving}
                onClick={() => setArchivingJob(null)}
              >
                Cancel
              </button>
              <button
                className="button button-danger"
                type="button"
                disabled={saving}
                onClick={() => void handleArchive()}
              >
                {saving ? "Archiving…" : "Archive role"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
