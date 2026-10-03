import { AppShell } from "@/components/app-shell";

export default function RankingsPage() {
  return (
    <AppShell activePath="/rankings">
      <div className="page-heading">
        <div>
          <p className="eyebrow">HUMAN REVIEW</p>
          <h1>Candidate review</h1>
          <p className="page-subtitle">
            Review evidence and record decisions with your team.
          </p>
        </div>
      </div>
      <section className="empty-panel">
        <span className="empty-icon">⌁</span>
        <h2>Ranking results will appear here</h2>
        <p>
          The review experience will use Person C&apos;s agreed scoring response
          and keep human decisions visible.
        </p>
      </section>
    </AppShell>
  );
}
