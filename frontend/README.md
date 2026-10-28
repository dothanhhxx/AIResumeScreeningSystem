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
- `/dashboard` — responsive recruiter dashboard with clearly labeled synthetic sample data.
- `/jobs` — list, create, edit, filter, and archive jobs through the Person D JD API.
- `/cvs` — PDF/DOCX selection and upload preparation UI. Files stay in the browser until Person B's API contract is integrated.
- `/rankings` — review scaffold pending Person C's scoring contract and the shared decision API; decision controls stay disabled until real match results can be saved.

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

The dashboard numbers and candidate examples are fictional and must not be used as hiring evidence. No CVs or personal data should be committed.

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_BASE_URL` to the backend API root (for example, `http://localhost:8000`). The auth client appends `/api/v1/auth` to this value. The backend must allow the frontend origin through CORS and accept the `Authorization` header. Job API mounting and CV/matching integrations remain pending their respective backend contracts.
