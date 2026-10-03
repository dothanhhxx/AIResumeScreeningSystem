# Job description API contract

This module follows Person A's `Job` model and shared `AppBaseModel`, `ApiResponse`, and `PaginatedResponse` schemas.

## Field mapping

| API field | Model field | Contract |
| --- | --- | --- |
| `id` | `id` | Integer assigned by the database; output only. |
| `title` | `title` | Required, nonblank, at most 255 characters. |
| `department` | `department` | Optional text, at most 255 characters. |
| `location` | `location` | Optional text, at most 255 characters. |
| `description` | `description` | Required, nonblank text. |
| `requirements` | `requirements` | Optional free text. |
| `required_skills` | `required_skills` | JSON text in the model, `list[str]` in API requests and responses. |
| `experience_years` | `experience_years` | Optional integer, zero or greater. |
| `education_level` | `education_level` | Optional text, at most 100 characters. |
| `status` | `status` | `draft`, `active`, `closed`, or `archived`; creation always starts as `draft`. |
| `created_by` | `created_by` | Optional integer in the model; API sets it from the authenticated user, never from request input. |
| `created_at`, `updated_at` | matching timestamps | Database-managed timestamps, returned by the API. |

## Endpoints

- `POST /jobs` creates a draft for the authenticated user.
- `GET /jobs` returns that user's jobs, with `page`, `page_size`, and optional `status` filters.
- `GET /jobs/{job_id}` returns a job owned by the authenticated user.
- `PATCH /jobs/{job_id}` updates only supplied fields.
- `DELETE /jobs/{job_id}` sets status to `archived` so related match history is retained.

Responses use Person A's `ApiResponse` wrapper. The list's `data` value is a `PaginatedResponse[JobRead]`.

The router expects `get_db` and `get_user` from `app.api.deps`, `User.id` from `app.models.user`, and the model/common schemas from the shared backend. Those foundation files are not in the isolated Person D workspace yet; the router must be mounted by Person A's main API app during integration.

The current frontend client sends browser credentials and expects this router at the configured API base URL plus `/jobs`. This assumes the auth dependency accepts a session cookie; if Person A's login returns bearer tokens instead, the client auth header must be connected to that response contract before end-to-end use.
