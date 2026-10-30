# Person D integration contracts

## Job model ↔ schema (Person A ↔ Person D)

Initial contract reviewed from Person A's `Job` model: integer ID; `created_by` owner ID from the authenticated user; lowercase `draft`, `active`, `closed`, and `archived` states; skills stored as JSON text; and database-managed timestamps. Person D's schema exposes skills as `list[str]`. The Person D job service/router now use `AsyncSession`; the frontend client targets `/api/v1/jobs` and sends the current Bearer token. End-to-end use still depends on Person A registering the jobs router in `app/main.py`.

## CV upload UI ↔ upload API (Person B ↔ Person D)

Person D's CV page now sends one PDF/DOCX file with `candidate_name` and optional `candidate_email` to `POST /api/v1/cvs/upload`. It reads paginated summaries from `GET /api/v1/cvs` and displays only the processing status returned by the API. The batch endpoint applies one candidate name/email to every file, so the UI intentionally uploads one candidate at a time. The client enforces the current 10 MB limit for usability; the backend remains authoritative for file validation. Person A must register the CV router in `app/main.py` before these requests work end-to-end. Person B's newer parser commit is still on a separate branch, so extraction completion depends on that work being merged and configured. Use synthetic resumes during development and never commit personal CV files.

## Scoring response ↔ matching API ↔ ranking UI (Person C ↔ Person D)

The ranking screen is an intentionally empty integration scaffold; `app/api/matching.py` is not implemented until C's scoring/task contract is available. Its filters, ranking list, and evidence slots stay inactive rather than guessing response fields. Agree on request/response JSON, whether matching is asynchronous, run ID and status states, score fields and scale, evidence/provenance, pagination/sort order, ownership checks, and error format. Use C's actual `MatchResult` and task interfaces; do not infer persisted fields from the UI.

## Current integration gaps

- Person A's job model/schema and async database dependency are available. The Person D jobs router/service now match the async dependency, but `app/main.py` still does not register the jobs router. Its existing TODO comment still describes the old synchronous implementation; Person A can correct that comment while registering the router.
- Person D's CV client and page match Person B's single-upload and list response contracts. Person A still needs to register the CV router in `app/main.py`; the newer Person B parser work has not been merged into `main`.
- The ranking screen remains an integration scaffold. `app/api/matching.py` and Person C's final scoring/task contract are still unavailable; keep ranking placeholders inactive until the real response and task lifecycle are agreed.
