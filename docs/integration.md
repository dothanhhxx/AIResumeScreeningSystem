# Person D integration contracts

## Job model ↔ schema (Person A ↔ Person D)
Initial contract reviewed from Person A's `Job` model: integer ID; `created_by` owner ID from the authenticated user; lowercase `draft`, `active`, `closed`, and `archived` states; skills stored as JSON text; and database-managed timestamps. Person D's schema exposes skills as `list[str]`. Confirm these assumptions with A when merging into the shared backend.

## CV upload UI ↔ upload API (Person B ↔ Person D)
The upload screen accepts PDF/DOCX selections in the browser and does not transmit them yet. Before enabling upload, agree on endpoint, single/multiple-file behavior, multipart field names, size/type limits, duplicate handling, processing status, response fields, and authorization. Do not use real resumes in development or commit any resume files.

## Scoring response ↔ matching API ↔ ranking UI (Person C ↔ Person D)
The ranking screen remains an integration placeholder and `app/api/matching.py` is not implemented until C's scoring/task contract is available. Agree on request/response JSON, whether matching is asynchronous, run ID and status states, score fields and scale, evidence/provenance, pagination/sort order, ownership checks, and error format. Use C's actual `MatchResult` and task interfaces; do not infer persisted fields from the UI.

## Current integration gaps
- Person A's `common.py` and `job.py` were supplied as references, but the shared backend foundation (`Base`, database, user/dependencies, app entry point) is not in this workspace, so JD routes cannot yet be exercised end-to-end.
- The frontend currently assumes credentialed cookie auth. Confirm CORS and session-cookie behavior with A before deployment; change the API client if A's auth contract uses bearer tokens.
- Person B's upload contract and Person C's scoring response/task files have not been supplied. The CV selection UI is intentionally local-only, and ranking/matching are not presented as live functionality.
