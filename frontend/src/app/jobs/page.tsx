import { AppShell } from "@/components/app-shell";
import { JobsManager } from "@/components/jobs-manager";

export default function JobsPage() {
  return (
    <AppShell activePath="/jobs">
      <div className="page-heading">
        <div>
          <p className="eyebrow">HIRING PIPELINE</p>
          <h1>Job descriptions</h1>
          <p className="page-subtitle">
            Create and manage the roles your team is hiring for.
          </p>
        </div>
      </div>
      <JobsManager />
    </AppShell>
  );
}
