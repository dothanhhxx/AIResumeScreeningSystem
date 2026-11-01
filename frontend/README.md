# TalentLens Frontend

Next.js App Router application for the Person D frontend work.

## Requirements

- Node.js 24+
- pnpm 11.19+

## Setup

```powershell
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Routes currently available:

- `/login` — signs in through Person A's `POST /api/v1/auth/login` endpoint.
- `/register` — creates an account through `POST /api/v1/auth/register`. The first account bootstraps as admin; subsequent accounts require an admin session.
- `/users` — admin-only account creation inside the authenticated workspace; new accounts default to the recruiter role.
- `/dashboard` — responsive recruiter overview with clearly labeled sample metrics.
- `/jobs` — list, create, edit, filter, and archive jobs through the backend jobs API.
- `/cvs` — upload PDF/DOCX resumes, follow processing status, and review CV records through the backend CV API.
- `/rankings` — start asynchronous matching, review ranked results and evidence, and save recruiter decisions through the matching API.
- `/demo` — read-only synthetic workspace for trying the interface without making API requests or changing real records.

## Checks

```powershell
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## UI foundation

Shared colors, typography, and control/panel radii live in `src/styles/tokens.css`.
Use the CSS variables (for example, `var(--green)`) in the existing component
stylesheet, or use the corresponding Tailwind utilities such as `bg-brand`,
`text-ink`, `border-line`, `font-sans`, and `rounded-panel` in new components.

The `VI / EN` control switches the interface language and saves the preference in
browser storage. App labels and guidance are translated; job descriptions,
candidate names, and resume content remain as entered or supplied.

Authentication sends bearer tokens in the `Authorization` header and keeps the
access token in tab-scoped `sessionStorage` until its API-provided expiry. Sign
out clears the browser session; the backend does not currently provide a token
revocation endpoint. The auth API client also includes the `/me` request for
retrieving the current account.

Dashboard metrics and `/demo` candidate examples are fictional and must not be used as hiring evidence. No CVs or personal data should be committed.

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_BASE_URL` to the backend API root (for example, `http://localhost:8000`). The frontend API clients append `/api/v1` and the relevant resource path. The backend must allow the frontend origin through CORS and accept the `Authorization` header. The jobs, CV, matching, decision, and account-creation screens use the shared API contracts documented in `../docs/integration.md`; API availability and permissions still depend on the backend being configured and running.
