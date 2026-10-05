import { AppShell } from "@/components/app-shell";
import { RankingReview } from "@/components/ranking-review";

export default function RankingsPage() {
  return (
    <AppShell activePath="/rankings">
      <div className="page-heading">
        <div>
          <p className="eyebrow">HUMAN REVIEW</p>
          <h1>Candidate rankings</h1>
          <p className="page-subtitle">
            Compare match evidence and review candidates with your team.
          </p>
        </div>
      </div>
      <RankingReview />
    </AppShell>
  );
}
