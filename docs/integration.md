# Integration contracts (agreed)

All integration points from the team plan are now implemented and covered by
`backend/tests/test_api/` (offline end-to-end) and the frontend tests.

## A ↔ B — CV model, status, schema

- `CV.status` lifecycle: `uploaded → parsing → parsed → extracting → extracted → scoring → scored`, or `error`.
- Enum columns persist the lowercase **values** (`values_callable=enum_values`) to match the Postgres enum types from migration 0001.
- `CV.error_message` holds the last pipeline error; `POST /cvs/{id}/reprocess` restarts parsing.
- Storage backend is configurable (`STORAGE_BACKEND=minio|local`); `GET /cvs/{id}/file` works with both.

## A ↔ C — MatchResult, embeddings

Migration `0002_scoring_pipeline` adds:

- `cvs.embedding`, `jobs.embedding` — JSON `{"model": "...", "v": [...]}`. Stored as text so the same code runs on
  Postgres and SQLite; cosine similarity is computed in Python (fine at this scale, pgvector not required).
  Vectors are only compared when produced by the same model. Updating a JD's text clears its embedding.
- `match_results.rule_score / semantic_score / llm_score / details / updated_at`, unique `(cv_id, job_id)` so
  re-running a match updates the row.
- `decisions.score_override` — recruiter-adjusted score used for ranking when set.

## A ↔ D — Job model / schema

Unchanged from the original contract; JD writes require `admin` or `recruiter`. Jobs remain owner-scoped
(admins can open any job in matching).

## B ↔ C — raw_text format and task chain

- `raw_text` = output of `parsing.base.clean_text`: LF line endings, single spaces, at most one blank line between
  blocks, pages concatenated, no markup. The extraction prompt explains this format to the LLM.
- Chain: `parse_cv_task` → `extract_info_task` → (on demand) `score_match_task`, dispatched through
  `app/workers/dispatch.py` either to Celery queues `parse` / `extract` / `score` or to the in-process inline runner.
- Celery tasks use a NullPool session factory per task (each task runs its own event loop).

## C ↔ D — Scoring response ↔ ranking UI

- Matching is asynchronous. `POST /matching/run {job_id, cv_ids?}` → `202 {job_id, queued, cv_ids, skipped}`;
  the UI polls `GET /matching/jobs/{job_id}/results` while `pending_cvs > 0`.
- Every score is 0–100. `overall_score` = Σ weight·score over the engines that ran; weights are in `details.weights`,
  engine provenance in `details.sources` and `model_name` (`heuristic` when no LLM was used).
- `effective_score` = `decision.score_override ?? overall_score`; ranking order is `effective_score` desc, `rank` is 1-based.
- `details.evidence[]` = `{requirement, category, status: found|unclear|not_found, quote}`; quotes come from the
  PII-stripped CV text. `details.strengths / gaps / interview_questions` are short strings.
- Decisions: `PUT /matching/results/{id}/decision {status, reason, note, score_override}`; the UI requires a reason
  when the score is overridden. Each create/update is written to the audit log with the AI score for comparison.
