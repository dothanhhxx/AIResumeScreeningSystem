"use client";

import { CvUpload } from "@/components/cv-upload";
import { useI18n } from "@/i18n/provider";

export default function CvsPage() {
  const { t } = useI18n();

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("CANDIDATE PIPELINE")}</p>
          <h1>{t("CV library")}</h1>
          <p className="page-subtitle">
            {t(
              "Upload one resume at a time and track its current processing status.",
            )}
          </p>
        </div>
      </div>
      <CvUpload />
    </>
  );
}
