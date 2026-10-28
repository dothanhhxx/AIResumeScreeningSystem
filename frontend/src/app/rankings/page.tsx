"use client";

import { AppShell } from "@/components/app-shell";
import { RankingReview } from "@/components/ranking-review";
import { useI18n } from "@/i18n/provider";

export default function RankingsPage() {
  const { t } = useI18n();

  return (
    <AppShell activePath="/rankings">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("HUMAN REVIEW")}</p>
          <h1>{t("Candidate rankings")}</h1>
          <p className="page-subtitle">
            {t("Compare match evidence and review candidates with your team.")}
          </p>
        </div>
      </div>
      <RankingReview />
    </AppShell>
  );
}
