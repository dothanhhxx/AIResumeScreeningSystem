export function RankingReview() {
  return (
    <>
      <div className="ranking-integration-banner" role="note">
        <span className="sample-banner-icon">i</span>
        <span>
          <strong>Waiting for Person C&apos;s scoring contract.</strong> No
          candidate scores or ranking data are shown until the real response
          fields are agreed.
        </span>
      </div>

      <section
        className="panel ranking-workspace"
        aria-label="Candidate ranking review"
      >
        <div className="ranking-toolbar">
          <label className="ranking-filter-field">
            <span>Job</span>
            <select disabled defaultValue="">
              <option value="">Available after API integration</option>
            </select>
          </label>
          <label className="ranking-filter-field">
            <span>Review status</span>
            <select disabled defaultValue="">
              <option value="">Available after API integration</option>
            </select>
          </label>
          <label className="ranking-search-field">
            <span>Search candidates</span>
            <input disabled placeholder="Waiting for ranking response fields" />
          </label>
          <span className="ranking-result-count">Not connected</span>
        </div>

        <div className="ranking-content-grid">
          <section
            className="ranking-list-panel"
            aria-labelledby="ranking-list-title"
          >
            <div className="ranking-list-heading">
              <div>
                <h2 id="ranking-list-title">Ranked candidates</h2>
                <p>List and sorting will follow Person C&apos;s response.</p>
              </div>
            </div>
            <div className="ranking-empty-state">
              <span className="empty-icon">⌁</span>
              <h3>Ranking data will appear here</h3>
              <p>
                Waiting for the scoring response, rank order, and pagination
                contract.
              </p>
            </div>
          </section>

          <section
            className="ranking-detail-panel"
            aria-labelledby="evidence-title"
          >
            <header className="ranking-detail-header">
              <div>
                <p className="eyebrow">HUMAN REVIEW</p>
                <h2 id="evidence-title">Candidate evidence</h2>
                <p>Details stay empty until a real result is selected.</p>
              </div>
            </header>
            <div className="ranking-detail-body">
              <div className="ranking-placeholder-slot">
                <strong>Overall score and component scores</strong>
                <span>Waiting for C&apos;s agreed score fields and scale.</span>
              </div>
              <div className="ranking-placeholder-slot">
                <strong>Matched and missing skills</strong>
                <span>Waiting for the evidence field format.</span>
              </div>
              <div className="ranking-placeholder-slot">
                <strong>Explanation and provenance</strong>
                <span>Waiting for explanation, model, and source details.</span>
              </div>
            </div>
            <div className="human-review-note ranking-human-note">
              <span className="human-review-icon">♡</span>
              <div>
                <strong>People make hiring decisions.</strong>
                <span>
                  Match indicators will support review and will not decide for
                  the recruiter.
                </span>
              </div>
            </div>
          </section>
        </div>
      </section>
    </>
  );
}
