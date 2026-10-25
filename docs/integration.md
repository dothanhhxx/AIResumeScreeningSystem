# Person D integration contracts

## Job model ↔ schema (Person A ↔ Person D)
Initial contract reviewed from Person A's `Job` model: integer ID; `created_by` owner ID from the authenticated user; lowercase `draft`, `active`, `closed`, and `archived` states; skills stored as JSON text; and database-managed timestamps. Person D's schema exposes skills as `list[str]`. The frontend job-management page is implemented against that contract; end-to-end use still depends on the shared API's auth dependencies and router registration.

## CV upload UI ↔ upload API (Person B ↔ Person D)
The upload screen accepts PDF/DOCX selections in the browser and does not transmit them yet. Before enabling upload, agree on endpoint, single/multiple-file behavior, multipart field names, size/type limits, duplicate handling, processing status, response fields, and authorization. Do not use real resumes in development or commit any resume files.

## Scoring response ↔ matching API ↔ ranking UI (Person C ↔ Person D)
The ranking screen is an intentionally empty integration scaffold; `app/api/matching.py` is not implemented until C's scoring/task contract is available. Its filters, ranking list, and evidence slots stay inactive rather than guessing response fields. Agree on request/response JSON, whether matching is asynchronous, run ID and status states, score fields and scale, evidence/provenance, pagination/sort order, ownership checks, and error format. Use C's actual `MatchResult` and task interfaces; do not infer persisted fields from the UI.

## Current integration gaps
- The shared backend foundation and Person A's job model/schema are available in the repo. The API dependency module and job-router registration still need to be confirmed in the shared backend before JD routes can be exercised end-to-end. Person D has not edited those backend-owned files.
- The frontend currently assumes credentialed cookie auth. Confirm CORS and session-cookie behavior with A before deployment; change the API client if A's auth contract uses bearer tokens.
- Person B's upload contract and Person C's scoring response/task files have not been supplied. The CV selection UI is intentionally local-only, and ranking/matching are not presented as live functionality. Fill the ranking placeholders only after C's real fields and task lifecycle are available.
