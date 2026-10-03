import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { MetricCard } from "@/components/metric-card";
import { recentRoles, reviewQueue, sampleMetrics } from "@/lib/sample-data";

export default function DashboardPage() {
  return (
    <AppShell activePath="/dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">THURSDAY, OCTOBER 1, 2026</p>
          <h1>
            Good morning, Jordan <span className="wave">✳</span>
          </h1>
          <p className="page-subtitle">
            Here&apos;s what&apos;s happening across your hiring pipeline.
          </p>
        </div>
        <Link className="button button-primary" href="/jobs">
          <span className="button-plus">+</span> Create a job
        </Link>
      </div>

      <div className="sample-banner">
        <span className="sample-banner-icon">i</span>
        <span>
          <strong>Preview workspace</strong> All candidate and hiring figures
          below are synthetic sample data.
        </span>
        <Link href="/jobs">
          Explore job descriptions <Icon name="arrow" size={15} />
        </Link>
      </div>

      <section className="metrics-grid" aria-label="Hiring overview">
        {sampleMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="panel roles-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent job descriptions</h2>
              <p>Track roles and their candidate pipelines.</p>
            </div>
            <Link className="text-link" href="/jobs">
              View all <Icon name="arrow" size={15} />
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ROLE</th>
                  <th>APPLICANTS</th>
                  <th>STATUS</th>
                  <th>UPDATED</th>
                  <th>
                    <span className="sr-only">Open role</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentRoles.map((role) => (
                  <tr key={role.title}>
                    <td>
                      <div className="role-title">{role.title}</div>
                      <div className="role-department">{role.department}</div>
                    </td>
                    <td>
                      <span className="applicant-count">{role.candidates}</span>
                      <span className="muted-inline"> candidates</span>
                    </td>
                    <td>
                      <span className={`status-pill status-${role.tone}`}>
                        <span />
                        {role.status}
                      </span>
                    </td>
                    <td className="muted-cell">{role.updated}</td>
                    <td>
                      <Link
                        className="row-arrow"
                        href="/jobs"
                        aria-label={`View ${role.title}`}
                      >
                        <Icon name="arrow" size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link className="panel-bottom-link" href="/jobs">
            View all job descriptions <Icon name="arrow" size={15} />
          </Link>
        </section>

        <section className="panel queue-panel">
          <div className="panel-heading">
            <div>
              <h2>Review queue</h2>
              <p>Strong matches waiting for a human review.</p>
            </div>
            <span className="queue-count">8</span>
          </div>
          <div className="queue-list">
            {reviewQueue.map((candidate) => (
              <article className="queue-item" key={candidate.name}>
                <div
                  className={`candidate-avatar candidate-avatar-${candidate.tone}`}
                >
                  {candidate.initials}
                </div>
                <div className="candidate-info">
                  <strong>{candidate.name}</strong>
                  <span>{candidate.role}</span>
                  <small>{candidate.skills}</small>
                </div>
                <div className="fit-score">
                  <strong>{candidate.fit}</strong>
                  <span>fit</span>
                </div>
              </article>
            ))}
          </div>
          <Link className="panel-bottom-link" href="/rankings">
            Review candidates <Icon name="arrow" size={15} />
          </Link>
        </section>
      </div>

      <section className="human-review-note">
        <span className="human-review-icon">♡</span>
        <div>
          <strong>People make the hiring decisions.</strong>
          <span>
            Match indicators help organize review. They do not make or replace
            hiring decisions.
          </span>
        </div>
        <Link href="/rankings">
          How review works <Icon name="arrow" size={15} />
        </Link>
      </section>
    </AppShell>
  );
}
