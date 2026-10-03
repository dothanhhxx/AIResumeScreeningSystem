# Person D Frontend

Next.js App Router application for the Person D frontend work.

## Requirements

- Node.js 24+
- pnpm 11.19+

## Setup

```powershell
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Routes available in this first increment:

- `/login` — responsive sign-in UI; authentication is not connected yet.
- `/register` — registration UI; account creation is not connected yet.
- `/dashboard` — responsive recruiter dashboard with clearly labeled synthetic sample data.
- `/jobs` — list, create, edit, filter, and archive jobs through the Person D JD API.
- `/cvs` — PDF/DOCX selection and upload preparation UI. Files stay in the browser until Person B's API contract is integrated.
- `/rankings` — review integration placeholder pending Person C's scoring contract.

## Checks

```powershell
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run build
```

The dashboard numbers and candidate examples are fictional and must not be used as hiring evidence. No CVs or personal data should be committed.

For the JD page, copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_BASE_URL` to the backend API root. Requests currently include browser credentials; the backend must allow credentialed CORS and use the agreed session-cookie authentication. If Person A uses bearer tokens, wire the token after the auth response contract is available.
