"use client";

import { JobsManager } from "@/components/jobs-manager";
import { useI18n } from "@/i18n/provider";

export default function JobsPage() {
  const { t } = useI18n();

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("HIRING PIPELINE")}</p>
          <h1>{t("Job descriptions")}</h1>
          <p className="page-subtitle">
            {t("Create and manage the roles your team is hiring for.")}
          </p>
        </div>
      </div>
      <JobsManager />
    </>
  );
}
