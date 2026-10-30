"use client";

import { RankingEvidenceDemo } from "@/components/ranking-evidence-demo";
import { useI18n } from "@/i18n/provider";

export function RankingReview() {
  const { t } = useI18n();

  return (
    <>
      <div
        className="ranking-integration-banner"
        role="status"
        aria-live="polite"
      >
        <span className="sample-banner-icon" aria-hidden="true">
          i
        </span>
        <span>
          <strong>{t("Waiting for Person C's scoring contract.")}</strong>{" "}
          {t(
            "No candidate scores or ranking data are shown until the real response fields are agreed.",
          )}
        </span>
      </div>

      <RankingEvidenceDemo />

      <section
        className="panel ranking-workspace"
        aria-label={t("Candidate ranking review")}
      >
        <div className="ranking-toolbar">
          <label className="ranking-filter-field">
            <span>{t("Job")}</span>
            <select disabled defaultValue="">
              <option value="">{t("Available after API integration")}</option>
            </select>
          </label>
          <label className="ranking-filter-field">
            <span>{t("Review status")}</span>
            <select disabled defaultValue="">
              <option value="">{t("Available after API integration")}</option>
            </select>
          </label>
          <label className="ranking-search-field">
            <span>{t("Search candidates")}</span>
            <input
              disabled
              placeholder={t("Waiting for ranking response fields")}
            />
          </label>
          <span className="ranking-result-count">{t("Not connected")}</span>
        </div>

        <div className="ranking-content-grid">
          <section
            className="ranking-list-panel"
            aria-labelledby="ranking-list-title"
          >
            <div className="ranking-list-heading">
              <div>
                <h2 id="ranking-list-title">{t("Ranked candidates")}</h2>
                <p>{t("List and sorting will follow Person C's response.")}</p>
              </div>
            </div>
            <div className="ranking-empty-state" role="status">
              <span className="empty-icon" aria-hidden="true">
                ⌁
              </span>
              <h3>{t("Ranking data will appear here")}</h3>
              <p>
                {t(
                  "Waiting for the scoring response, rank order, and pagination contract.",
                )}
              </p>
            </div>
          </section>

          <section
            className="ranking-detail-panel"
            aria-labelledby="evidence-title"
          >
            <header className="ranking-detail-header">
              <div>
                <p className="eyebrow">{t("HUMAN REVIEW")}</p>
                <h2 id="evidence-title">{t("Candidate evidence")}</h2>
                <p>
                  {t("Details stay empty until a real result is selected.")}
                </p>
              </div>
            </header>
            <div className="ranking-detail-body">
              <div className="ranking-placeholder-slot">
                <strong>{t("Overall score and component scores")}</strong>
                <span>
                  {t("Waiting for C's agreed score fields and scale.")}
                </span>
              </div>
              <div className="ranking-placeholder-slot">
                <strong>{t("Matched and missing skills")}</strong>
                <span>{t("Waiting for the evidence field format.")}</span>
              </div>
              <div className="ranking-placeholder-slot">
                <strong>{t("Explanation and provenance")}</strong>
                <span>
                  {t("Waiting for explanation, model, and source details.")}
                </span>
              </div>
            </div>
            <section
              className="decision-panel"
              aria-labelledby="decision-title"
            >
              <div className="decision-panel-heading">
                <div>
                  <p className="eyebrow">{t("RECRUITER DECISION")}</p>
                  <h3 id="decision-title">{t("Review outcome")}</h3>
                </div>
                <span className="decision-pending-label">
                  {t("Not connected")}
                </span>
              </div>
              <p className="decision-integration-note">
                {t(
                  "Decision controls will be enabled after a real match result and the decision API are available.",
                )}
              </p>
              <label className="decision-form-field">
                <span>{t("Decision status")}</span>
                <select disabled defaultValue="pending">
                  <option value="pending">{t("Pending review")}</option>
                  <option value="shortlisted">{t("Shortlisted")}</option>
                  <option value="interview">{t("Interview")}</option>
                  <option value="rejected">{t("Rejected")}</option>
                  <option value="hired">{t("Hired")}</option>
                </select>
              </label>
              <label className="decision-form-field">
                <span>{t("Reason")}</span>
                <input
                  disabled
                  maxLength={500}
                  placeholder={t("Awaiting API integration")}
                />
              </label>
              <label className="decision-form-field">
                <span>{t("Reviewer note")}</span>
                <textarea
                  disabled
                  rows={3}
                  placeholder={t("Awaiting API integration")}
                />
              </label>
              <button className="button button-primary" type="button" disabled>
                {t("Save recruiter decision")}
              </button>
            </section>
            <div className="human-review-note ranking-human-note">
              <span className="human-review-icon">♡</span>
              <div>
                <strong>{t("People make hiring decisions.")}</strong>
                <span>
                  {t(
                    "Match indicators will support review and will not decide for the recruiter.",
                  )}
                </span>
              </div>
            </div>
          </section>
        </div>
      </section>
    </>
  );
}
