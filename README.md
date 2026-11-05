# TalentLens — AI Resume Screening System

Upload CVs (PDF/DOCX/scans), describe a job, and get an **explainable ranking** of candidates:
every score comes with per-requirement evidence quoted from the CV, strengths, gaps and
suggested interview questions. Recruiters make the decision (and can override the score);
every action is written to an audit log.

```
Next.js (3000) ──► FastAPI (8000) ──► PostgreSQL · MinIO · Redis
                         │
                         └─► Celery worker: parse ─► extract ─► score
                                             (PDF/DOCX/OCR)  (Gemini or offline heuristic)
```

## Features

| Area | What it does |
|------|--------------|
| Auth & RBAC | JWT login; first account becomes **admin**; admins create `recruiter` / `viewer` accounts. Viewers are read-only. |
| Job descriptions | Create / edit / activate / archive JDs with required skills, years of experience and education level. |
| CV pipeline | Upload PDF/DOCX (≤10 MB), SHA-256 de-duplication, storage in MinIO (or local disk), text extraction with pypdf → PyMuPDF → pdfplumber → Tesseract OCR (eng+vie). |
| AI extraction | PII (email, phone, URL, DOB, labelled addresses, name) is masked **before** anything is sent to the LLM. Gemini returns a structured profile (skills, experience, education, certifications, languages). |
| Scoring | Hybrid score = rule-based (skills/experience/education) + semantic (embeddings cosine) + LLM judgement, with configurable weights. Evidence per requirement: `found` / `unclear` / `not_found`. |
| Offline mode | Without a Gemini key (or when the free quota runs out) the system falls back to a deterministic heuristic extractor + rule/semantic scoring and labels results as `heuristic`. |
| Review | Ranked list, identity hiding, evidence, recruiter decision (pending / shortlisted / interview / rejected / hired) with optional score override + reason. |
| Dashboard & audit | Live pipeline metrics, review queue, admin-only audit log of logins, uploads, matching runs and decisions. |
| i18n | English / Vietnamese UI. |

## Quick start with Docker (full stack)

```bash
cp .env.example .env          # optionally set GEMINI_API_KEY=...
docker compose up --build
```

- Frontend: http://localhost:3000 — open **Create account** first; that account becomes the admin.
- API docs (Swagger): http://localhost:8000/docs
- MinIO console: http://localhost:9001 (minioadmin / minioadmin)

The backend container runs `alembic upgrade head` on start; the `worker` service runs Celery
on the `parse`, `extract` and `score` queues.

## Local quick start (no Docker)

Runs everything on SQLite + local files, with the pipeline as background tasks inside the API.

### Daily run (after first-time setup)

On Windows, run everything with one command (or double-click `start-dev.bat`):

```powershell
.\start-dev.ps1
```

Or run each service in its own terminal:

```powershell
# Terminal 1 — Backend
cd backend
.\.venv\Scripts\Activate.ps1        # Linux/macOS: source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
pnpm dev
```

### First-time setup only

```bash
# Backend
cd backend
python -m venv .venv && .venv/Scripts/activate      # Linux/macOS: source .venv/bin/activate
pip install -e ".[dev]"
cat > .env <<'EOF'
DATABASE_URL=sqlite+aiosqlite:///./dev.db
AUTO_CREATE_TABLES=true
STORAGE_BACKEND=local
PIPELINE_MODE=inline
GEMINI_API_KEY=            # optional
EOF

# Frontend
cd frontend
pnpm install
echo NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 > .env.local
```

OCR of scanned PDFs needs the Tesseract binary installed locally (it is included in the Docker image).

## Demo flow

1. **Create account** → you are admin. (Admins can create more accounts from the register page while signed in.)
2. **Job descriptions** → create a JD, add required skills, set it to *Active*.
3. **CV library** → upload resumes (one candidate per file). Status moves `uploaded → parsing → parsed → extracting → extracted`; click a CV to see the extracted profile.
4. **Candidate review** → pick the job → **Run AI matching**. Results appear as they are scored.
5. Select a candidate → check evidence → record a decision (optionally adjust the score with a reason).
6. **Overview** shows the pipeline; **Audit log** (admin) shows who did what.

Use synthetic resumes while developing — never commit real CVs.

## Configuration

All settings live in `.env` (see [.env.example](.env.example)). The important ones:

| Variable | Default | Meaning |
|----------|---------|---------|
| `DATABASE_URL` | *(built from `POSTGRES_*`)* | Full override, e.g. `sqlite+aiosqlite:///./dev.db` |
| `STORAGE_BACKEND` | `minio` | `minio` or `local` (`LOCAL_STORAGE_DIR`) |
| `PIPELINE_MODE` | `celery` | `celery` (Redis + worker) or `inline` (in-process) |
| `LLM_PROVIDER` | `gemini` | `gemini` or `heuristic` (always offline) |
| `GEMINI_API_KEY` | — | Free key from https://aistudio.google.com/apikey |
| `LLM_FALLBACK_TO_HEURISTIC` | `true` | Use offline engines when Gemini is missing/failing |
| `SCORE_WEIGHT_RULE / _SEMANTIC / _LLM` | `0.4 / 0.2 / 0.4` | Hybrid score weights (renormalised over engines that ran) |

## API overview (`/api/v1`)

| Method & path | Purpose |
|---------------|---------|
| `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | Accounts & JWT |
| `GET/POST /jobs`, `GET/PATCH/DELETE /jobs/{id}` | JD management (delete = archive) |
| `POST /cvs/upload`, `POST /cvs/upload/batch`, `GET /cvs`, `GET/DELETE /cvs/{id}` | CV upload & library |
| `GET /cvs/{id}/file`, `POST /cvs/{id}/reprocess` | Download original, re-run pipeline |
| `POST /matching/run` | Queue scoring of ready CVs against a JD (async, returns 202) |
| `GET /matching/jobs/{job_id}/results?decision_status=` | Ranked candidates with evidence |
| `GET /matching/results/{id}`, `PUT /matching/results/{id}/decision` | Detail, recruiter decision / override |
| `GET /dashboard/summary` | Overview metrics |
| `GET /audit` | Audit log (admin) |

All responses use the envelope `{ "success": true, "message": "...", "data": ... }`.

## Tests

```bash
cd backend && pytest            # 75 tests: parsers, PII, extraction, scorers, full API flows (offline)
cd frontend && pnpm test        # component + API client tests
pnpm lint && pnpm typecheck && pnpm build
```

## Project layout

```
backend/app
├── api/            auth, jobs, cvs, matching, dashboard, audit routers
├── core/           config-driven DB engine, JWT/bcrypt, exceptions
├── models/         User, Job, CV, MatchResult, Decision, AuditLog
├── services/
│   ├── parsing/    PDF / DOCX / OCR parsers
│   ├── extraction/ PII stripper, Gemini extractor, offline heuristic extractor
│   ├── matching/   rule, semantic, LLM scorers + aggregator, skill vocabulary
│   └── *_service   business logic per module
├── llm/            provider-agnostic LLM interface + Gemini
└── workers/        Celery app, parse / extract / score tasks, inline dispatcher
frontend/src        Next.js app router pages, components, API clients, i18n
```

Team ownership and the original plan are in [docs/team-distribution.md](docs/team-distribution.md);
integration contracts in [docs/integration.md](docs/integration.md).
