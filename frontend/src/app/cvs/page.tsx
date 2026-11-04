"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CvUpload } from "@/components/cv-upload";
import { useI18n } from "@/i18n/provider";

function CvLibrary() {
  const searchParams = useSearchParams();
  const requestedCvId = Number(searchParams.get("cv"));
  const selectedCvId =
    Number.isSafeInteger(requestedCvId) && requestedCvId > 0
      ? requestedCvId
      : null;
  const requestedJob = Number(searchParams.get("job"));
  const selectedJobId =
    Number.isSafeInteger(requestedJob) && requestedJob > 0
      ? requestedJob
      : null;

  return (
    <CvUpload
      key={`${selectedCvId ?? "library"}-${selectedJobId ?? "pool"}`}
      requestedCvId={selectedCvId}
      requestedJobId={selectedJobId}
    />
  );
}

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
      <Suspense fallback={<p className="cv-library-state">{t("Loading…")}</p>}>
        <CvLibrary />
      </Suspense>
    </>
  );
}
