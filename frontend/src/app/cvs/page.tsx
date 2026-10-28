"use client";

import { AppShell } from "@/components/app-shell";
import { CvUpload } from "@/components/cv-upload";
import { useI18n } from "@/i18n/provider";

export default function CvsPage() {
  const { t } = useI18n();

  return (
    <AppShell activePath="/cvs">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("CANDIDATE PIPELINE")}</p>
          <h1>{t("CV library")}</h1>
          <p className="page-subtitle">
            {t(
              "Prepare resume uploads and review processing status when Person B's API is connected.",
            )}
          </p>
        </div>
      </div>
      <CvUpload />
    </AppShell>
  );
}
