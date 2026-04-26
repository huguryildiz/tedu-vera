<p align="center">
  <img src="src/assets/vera_logo_dark.png" alt="VERA" width="480">
</p>

<p align="center">
  <strong>Visual Evaluation, Reporting & Analytics</strong><br>
  <sub>A modern platform for academic juries, capstone evaluations, and accreditation workflows.</sub>
</p>

<p align="center">
  <a href="https://vera-eval.app"><img src="https://img.shields.io/badge/vera--eval.app-0f172a?style=for-the-badge&logo=vercel&logoColor=white" alt="vera-eval.app"></a>
  &nbsp;
  <img src="https://img.shields.io/badge/React%2018-0b1220?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 18">
  <img src="https://img.shields.io/badge/Supabase-0b1220?style=for-the-badge&logo=supabase&logoColor=3ECF8E" alt="Supabase">
  <img src="https://img.shields.io/badge/PostgreSQL-0b1220?style=for-the-badge&logo=postgresql&logoColor=4169E1" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Playwright-0b1220?style=for-the-badge&logo=playwright&logoColor=2EAD33" alt="Playwright">
</p>

<br>

<p align="center">
  <em>From QR scan to accreditation report — one guided flow, no paper, no spreadsheets.</em>
</p>

---

## Overview

**VERA** is a multi-tenant evaluation platform purpose-built for structured academic assessment — capstone juries, senior design reviews, hackathon judging, and any multi-juror scoring operation.

Jurors enter through a QR code, authenticate with a PIN, and score projects against a configurable rubric on any device. Administrators watch the grid fill live, review rankings and analytics the moment scoring closes, and export accreditation-ready reports without manual compilation.

VERA replaces paper rubrics, shared spreadsheets, and after-the-fact score merging with a single tenant-isolated workspace that holds every part of the operation — periods, projects, jurors, criteria, scores, analytics, audit trails, and exports.

---

## Why VERA

Evaluation days are short, crowded, and consequential. Dozens of jurors rotate across stations under tight timing. Paper rubrics get lost. Spreadsheets drift. Manual compilation delays results for hours or days — and leaves no trustworthy audit trail.

- **Frictionless jury entry** — QR to first score in under a minute. No signup, no install, no training.
- **Real-time admin visibility** — Scores appear as they're written. No refresh loops, no polling lag.
- **Instant rankings & analytics** — Results, distributions, and outcome reports are ready the moment scoring closes.
- **Accreditation-ready reporting** — Per-period framework selection (MÜDEK, ABET, or custom) drives how analytics render.
- **Audit-ready by design** — Every admin action logged with tamper-evident hash chaining. Tenants isolated end-to-end.
- **Mobile-first, production-minded** — Auto-save on blur and tab-hide. Built for real operations on real event days.

---

## Core Capabilities

### Guided Jury Flow

A mobile-first scoring experience that requires no accounts and no app installs. The flow runs a strict step sequence — identity → period → PIN → evaluation → submission — with scores persisted on every field blur, tab-hide, and navigation event. Jurors can pause and resume on any device; the server is always the source of truth.

### Admin Workspace

A dedicated operator surface covering the full event lifecycle: live score grids, project rankings, juror activity, period and criteria configuration, entry-token control, audit review, and formatted XLSX export. Updates are event-driven through Supabase Realtime — subscriptions on `score_sheets`, `score_sheet_items`, `juror_period_auth`, `projects`, `periods`, and `jurors` trigger debounced re-fetches so the grid reflects live activity within roughly a second.

### Criteria & Accreditation Frameworks

Criteria labels, weights, rubric bands, and outcome mappings are fully configurable per evaluation period. Defaults ship with a 100-point rubric (Technical 30, Written 30, Oral 30, Teamwork 10), but any structure is supported. Framework selection (MÜDEK, ABET, or custom) is per-period and propagates through analytics and outcome reports.

### Reporting & Analytics

Purpose-built chart components cover score distributions, attainment rates, threshold gaps, outcome heatmaps, juror consistency matrices, programme averages, and submission timelines. Every chart renders against the framework configured on the active period. Rankings, score details, and evaluation grids export to formatted XLSX for program committees and accreditation files.

### Multi-Tenant & Secure by Default

Each organization operates in complete isolation — periods, projects, jurors, criteria, and scores are scoped to a single tenant at the database layer. Super-admins oversee the tenant lifecycle; tenant admins never see another organization's data. New tenants onboard through a structured approval workflow with server-side user provisioning.

---

## Experience by Role

**Juror** — Scan a QR code, enter a 4-digit PIN, score assigned projects against a guided rubric, and submit. Works on any modern browser. No account, no install.

**Tenant Admin** — Run the event. Configure periods, projects, jurors, and criteria for your organization. Monitor scoring live. Review rankings, analytics, and outcome reports. Export results and audit logs.

**Super Admin** — Govern the platform. Approve new tenants, manage the global tenant lifecycle, and maintain cross-tenant oversight without reaching into tenant-scoped data.

---

## Technical Architecture

| Layer | Stack |
|---|---|
| **Frontend** | React 18 · Vite · React Router v6 · Recharts · custom SVG charts |
| **UI** | lucide-react · cmdk · Vaul · @dnd-kit · Embla · Sonner · TanStack Table · react-window |
| **Backend** | Supabase — PostgreSQL 15 · PL/pgSQL RPCs · Row-Level Security · Realtime |
| **Edge** | Deno Edge Functions — auth events, email delivery, notifications, audit, backups, exports, admin sessions |
| **Auth** | Supabase Auth (email/password, Google OAuth, 30-day sessions) · juror QR token + bcrypt PIN |
| **Testing** | Vitest · Testing Library · vitest-axe · Playwright E2E |
| **Data & Export** | Zod validation · xlsx-js-style |
| **Deployment** | Vercel (frontend) · Supabase (backend, auth, functions) |

### System shape

```text
┌──────────────────────────────────────┐
│          React SPA (Vite)            │
│                                      │
│  ┌─────────┐ ┌──────────┐ ┌───────┐  │
│  │  Jury   │ │  Admin   │ │ Auth  │  │
│  │  Flow   │ │  Panel   │ │ JWT   │  │
│  └────┬────┘ └────┬─────┘ └───┬───┘  │
│       └───────────┼────────────┘     │
│                   ▼                  │
│           src/shared/api/            │
│      (all RPCs mediated here)        │
└───────────────────┬──────────────────┘
                    │
        ┌───────────┼──────────┐
        ▼           ▼          ▼
  ┌──────────┐ ┌─────────┐ ┌───────┐
  │ Supabase │ │PL/pgSQL │ │ Edge  │
  │   Auth   │ │  RPCs   │ │  Fns  │
  └──────────┘ └────┬────┘ │(Deno) │
                    │      └───────┘
              ┌─────┴─────┐
              │ PostgreSQL│
              │   + RLS   │
              └───────────┘
```

All database access is mediated through `src/shared/api/` — components never call Supabase directly. In production, admin RPCs route through a Supabase Edge Function so privileged secrets never reach the browser. Environment (prod vs. demo) is resolved from the URL pathname alone; `/demo/*` targets a sandbox instance, everything else runs against production.

---

## Security & Operational Trust

- **Row-Level Security** on every table — tenant isolation enforced in the database, not the app.
- **Edge-protected admin operations** — privileged RPCs proxied through Edge Functions; service keys never shipped to the client.
- **Hashed juror PINs** — bcrypt with a 3-attempt lockout.
- **Revocable entry tokens** — 24-hour TTL, per-token revocation, event-bound.
- **JWT admin sessions** — Supabase Auth with 30-day persistence and OAuth support.
- **Tamper-evident audit log** — PIN resets, locks, deletions, and critical admin actions chained with SHA-256 hashing.
- **Server-side user provisioning** — tenant onboarding creates users through Edge Functions, never client-side.

---

## Project Structure

```text
src/
├── admin/              Admin workspace
│   ├── features/       Per-feature pages, hooks, drawers, modals (overview, rankings, periods, jurors…)
│   ├── analytics/      Analytics charts and dataset builders
│   ├── layout/         Admin shell — sidebar, header, route layout
│   └── shared/         Cross-feature admin hooks and components
├── jury/               Guided jury flow
│   ├── features/       Step-by-step screens (identity, period, PIN, evaluate, complete)
│   └── shared/         useJuryState orchestrator + sub-hooks
├── auth/               Authentication — login/register/reset screens, AuthProvider, guards
├── shared/
│   ├── api/            Centralised Supabase API — all RPC wrappers
│   ├── ui/             Shared UI primitives (drawers, selects, alerts, tooltips)
│   ├── criteria/       Criteria helpers and validation
│   ├── storage/        Browser storage abstraction (jury, admin, persist)
│   ├── lib/            Environment, Supabase client, utilities
│   ├── schemas/        Zod validation schemas
│   └── constants.js    Default criteria, rubric bands, outcome mappings
├── charts/             Reusable chart components
├── components/         Cross-cutting standalone components
├── landing/            Public landing page
├── layouts/            Top-level route layouts
├── styles/             Component CSS
├── router.jsx          React Router v6 tree
└── main.jsx            App entry

sql/migrations/         Sequential schema migrations (000–009)
supabase/functions/     Deno Edge Functions
e2e/                    Playwright specs + helpers + page objects
docs/                   Architecture, deployment, decisions, walkthroughs
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- A Supabase project (PostgreSQL 15+)

### Install

```bash
npm install
```

### Configure

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_RPC_SECRET=<rpc-secret>   # dev only — injected server-side in production
```

### Database

Apply migrations sequentially in the Supabase SQL Editor. On an existing database, skip `000_dev_teardown.sql`.

```text
sql/migrations/001_extensions.sql → 009_audit.sql
```

### Run

```bash
npm run dev           # Development server — localhost:5173
npm run build         # Production build
npm test -- --run     # Unit tests (CI-style)
npm run e2e           # Playwright E2E suite
```

---

## URL Structure

VERA uses React Router v6 with path-based routing. The active database is resolved from the pathname alone — no query params, no session flags.

```text
/demo/*          →  demo Supabase instance
everything else  →  prod Supabase instance
```

Key entry points:

- `/` — Landing
- `/login` · `/register` · `/forgot-password` — authentication screens
- `/eval?t=TOKEN` — jury gate (QR / entry-token verification)
- `/jury/*` — guided jury evaluation flow
- `/admin/*` — admin workspace (auth required)
- `/demo` · `/demo/admin/*` · `/demo/jury/*` — demo sandbox

Full route tree, guards, and environment resolution: [`docs/architecture/url-routing.md`](docs/architecture/url-routing.md).

---

## Documentation

- [`docs/`](docs/) — Full documentation index (start here)
- [`docs/architecture/`](docs/architecture/) — System overview, routing, storage policy, multi-tenancy, security model
- [`docs/decisions/`](docs/decisions/) — Architectural Decision Records (pathname routing, auth, entry tokens, migrations)
- [`docs/walkthroughs/`](docs/walkthroughs/) — End-to-end narratives for jury day, tenant onboarding, period lifecycle, audit trail
- [`docs/operations/`](docs/operations/) — Backup & recovery, demo environment, audit system, incident runbooks
- [`docs/deployment/`](docs/deployment/) — Environment variables, Supabase setup, Vercel config, migrations guide
- [`docs/testing/`](docs/testing/) — Unit, E2E, SQL (pgTAP), and Edge Function test guides; smoke checklist

---

## Deployment

VERA runs on **Vercel** for the frontend and **Supabase** for database, auth, and Edge Functions. The Vite build ships as a static SPA; the backend is managed independently and scales on Supabase's managed Postgres. Production and demo instances are mirrored — same code, separate data, resolved at the URL.

See [`docs/deployment/`](docs/deployment/) for the full configuration reference.

---

<p align="center">
  <strong>VERA</strong> · Visual Evaluation, Reporting & Analytics<br>
  <sub>Built for institutions that evaluate seriously.</sub>
</p>
