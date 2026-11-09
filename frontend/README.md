# TalentLens Frontend (`talentlens-frontend`)

Enterprise-grade **Next.js App Router** + **React 19** + **TypeScript** frontend for the **TalentLens AI Resume Screening System**.

## Architectural Organization (`src/`)

The frontend follows a strict **Feature-Based & Layered Architecture** with clear Separation of Concerns (SoC) and Single Responsibility Principle (SRP):

```text
frontend/src/
├── app/                                # Next.js App Router (Thin Route Controllers & Layouts ONLY)
│   ├── (marketing)/                    # Public Marketing & Live Demo Route Group
│   │   ├── page.tsx                    # Landing page (/)
│   │   └── demo/page.tsx               # Read-only synthetic workspace (/demo)
│   ├── (auth)/                         # Authentication Route Group
│   │   ├── login/page.tsx              # Sign-in (/login)
│   │   └── register/page.tsx           # Account registration (/register)
│   ├── (workspace)/                    # Authenticated HR, Recruiter & Admin Workspace Route Group
│   │   ├── dashboard/page.tsx          # Executive overview & KPI metrics (/dashboard)
│   │   ├── jobs/page.tsx               # Job Description (JD) management & auto-fill (/jobs)
│   │   ├── cvs/page.tsx                # CV Library & batch upload queue (/cvs)
│   │   ├── rankings/page.tsx           # Explainable AI candidate ranking & review (/rankings)
│   │   ├── history/page.tsx            # Historical screening records (/history)
│   │   ├── analytics/page.tsx          # Pipeline charts & distribution insights (/analytics)
│   │   ├── audit/page.tsx              # Admin compliance & immutable audit trail (/audit)
│   │   ├── users/page.tsx              # Admin RBAC user & role management (/users)
│   │   └── settings/page.tsx           # Account, privacy preferences & AI engine status (/settings)
│   ├── globals.css
│   ├── icon.svg
│   └── layout.tsx                      # Root application layout
├── components/                         # Shared Reusable Presentation Layer
│   ├── ui/                             # Atomic Design System Primitives (BrandLogo, Charts, Dialog, Icon, MetricCard, Skeleton)
│   └── layout/                         # Structural Shells & Navigation (AppShell, AuthLayout, LanguageSwitcher)
├── features/                           # Domain-Specific Business Modules (State, Workflows & Views)
│   ├── auth/                           # AuthForm, RegistrationGate
│   ├── dashboard/                      # DashboardOverview
│   ├── jobs/                           # JobsManager (CRUD, PDF/DOCX JD extraction, default scoring weights)
│   ├── cvs/                            # CvUpload, CvDetailPanel, CvUploadQueue, PipelineSteps
│   ├── rankings/                       # RankingReview, ScoringWeightsEditor, RankingEvidenceDemo
│   ├── history/                        # ScreeningHistory
│   ├── analytics/                      # AnalyticsDashboard
│   ├── audit/                          # AuditLogViewer
│   ├── users/                          # AdminUserManager
│   ├── settings/                       # SettingsWorkspace
│   └── marketing/                      # LandingPage, LandingProcess, DemoWorkspace
├── hooks/                              # Reusable Custom React Hooks (useCvUploadQueue, useFlip)
├── providers/                          # Application Context Providers (AuthSessionProvider)
├── i18n/                               # Bilingual Translation Engine (Vietnamese / English)
├── lib/                                # Typed HTTP API Clients & Pure Domain Utilities
│   ├── api.ts                          # Base HTTP client, envelope validation & binary downloads
│   ├── auth-api.ts
│   ├── audit-api.ts
│   ├── cvs-api.ts
│   ├── dashboard-api.ts
│   ├── insights-api.ts
│   ├── jobs-api.ts
│   ├── matching-api.ts
│   ├── users-api.ts
│   ├── demo-fixtures.ts
│   ├── preferences.ts
│   └── score-tone.ts
├── styles/                             # CSS Design Tokens & Workspace Stylesheets
└── __tests__/                          # Automated Unit & Integration Tests (Vitest + React Testing Library)
```

## Requirements

- **Node.js:** `20+` (recommended `24+`)
- **Package Manager:** `pnpm 11+` or `npm`

## Development Setup

```powershell
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Quality Gates

```powershell
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## Default Seeded Accounts (Local Dev)

- **Admin:** `admin@talentlens.ai` / `Admin@123`
- **Recruiter:** `recruiter@talentlens.ai` / `Recruiter@123`
