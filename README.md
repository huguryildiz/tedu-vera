# VERA

**TEDU Capstone Jury Evaluation Platform** · *Verdict & Evaluation Ranking Assistant*

VERA is an internal academic web application used by the Department of
Electrical & Electronics Engineering of TED University to conduct structured
poster-day evaluations for EE 491/492 Senior Project courses.

---

## Overview

On poster day, faculty jurors walk the poster exhibition hall, score student
projects across four rubric-based criteria, and submit their evaluations
through VERA's guided interface. Admins manage semesters, juror assignments,
and project data — and generate rankings, analytics, and MÜDEK outcome reports
from the admin dashboard.

**Usage pattern:** Active ~2–3 days per year (poster day + preparation).
Internal tool, not a public SaaS product.

---

## Core Features

- **PIN-based juror authentication** — 4-digit PINs assigned per juror per semester; bcrypt-hashed, rate-limited (3 failures → 15-minute lockout)
- **Structured 5-step evaluation flow** — identity → semester selection → project scoring → submission
- **4-criteria rubric scoring** — Technical Content (0–30), Written Communication (0–30), Oral Communication (0–30), Teamwork (0–10)
- **Auto-save on blur and tab-hide** — scores written to Supabase on field blur and `visibilitychange`
- **Admin dashboard** — live score grid, rankings, overview metrics, analytics charts
- **MÜDEK outcome tracking** — criteria mapped to 18 MÜDEK outcome codes; achievement level reporting
- **XLSX export** — score details, evaluation grid, rankings — all downloadable as formatted Excel files
- **Audit log** — all critical admin operations recorded with actor, action, and timestamp
- **Semester and juror management** — drag-and-drop group assignment, permission scoping

---

## User Roles

| Role | Access |
|---|---|
| **Juror** | Authenticates via PIN, scores assigned project groups, submits evaluations |
| **Admin** | Full access — manages semesters, projects, jurors, views analytics, exports data, resets PINs, locks evaluations |

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | React 18 + Vite |
| Backend | Supabase (PostgreSQL + RPC functions + RLS) |
| Auth | Admin: RPC password · Juror: 4-digit PIN (bcrypt) |
| Unit tests | Vitest + Testing Library |
| E2E tests | Playwright |
| Export | xlsx-js-style |
| Drag-and-drop | @dnd-kit |
| Charts | Custom SVG components (Recharts-free) |

---

## Project Structure

```text
src/
├── App.jsx                 # Root — state-based routing (home / jury / admin)
├── AdminPanel.jsx          # Admin interface root
├── JuryForm.jsx            # Jury flow root
├── config.js               # Evaluation criteria, MÜDEK outcomes, colors (single source of truth)
├── admin/                  # Admin tabs, hooks, export utilities
├── jury/                   # 5-step jury evaluation flow
│   ├── useJuryState.js     # Full jury state machine (critical)
│   ├── PinStep.jsx         # Step 1: PIN entry
│   ├── PinRevealStep.jsx   # Step 2: PIN reveal (first login)
│   ├── InfoStep.jsx        # Step 3: Name + department
│   ├── SemesterStep.jsx    # Step 4: Semester selection
│   └── EvalStep.jsx        # Step 5: Score entry
├── charts/                 # Modular analytics chart components
└── shared/
    ├── api.js              # All Supabase RPC calls + field mapping (critical)
    └── stats.js            # Statistical calculations
sql/
└── 000_bootstrap.sql       # Full DB schema, tables, RPC functions, grants
supabase/
└── functions/rpc-proxy/    # Edge Function — routes admin RPCs in production
```

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env.local`

```env
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_RPC_SECRET=<vault-rpc_secret-value>   # dev only
```

Create a `rpc_secret` secret in Supabase Vault and match its value to `VITE_RPC_SECRET`.

### 3. Bootstrap the database

Run in Supabase SQL Editor:

```sql
-- Full schema
\i sql/000_bootstrap.sql

-- Set initial admin passwords
SELECT rpc_admin_bootstrap_password('strong-admin-password');
SELECT rpc_admin_bootstrap_delete_password('delete-password', 'admin-password');
SELECT rpc_admin_bootstrap_backup_password('backup-password', 'admin-password');
```

Passwords can also be set from the admin panel → Security tab after first login.

### 4. Run the dev server

```bash
npm run dev          # localhost:5173
npm test             # unit tests (watch mode)
npm test -- --run    # unit tests (single run, CI-style)
npm run e2e          # Playwright E2E tests
npm run build        # production build
```

For E2E tests, add test juror credentials to `.env.local`:

```env
E2E_JUROR_NAME=Test Juror
E2E_JUROR_DEPT=EE
E2E_JUROR_PIN=1234
```

---

## Evaluation Criteria

| Criterion | Max Score |
|---|---|
| Technical Content | 30 |
| Written Communication | 30 |
| Oral Communication | 30 |
| Teamwork | 10 |
| **Total** | **100** |

Criterion definitions, rubric bands, and MÜDEK outcome mappings are defined in `src/config.js`.

---

## Security

- **RLS** — Row-level security enforced; only `SECURITY DEFINER` RPC functions can access tables
- **Admin auth** — Password passed as parameter on every RPC call; stored in `useRef`, never in state or localStorage
- **RPC proxy** — In production, admin RPCs route through a Supabase Edge Function so `rpc_secret` never reaches the browser
- **PIN auth** — Bcrypt-hashed; 3 incorrect attempts trigger a 15-minute lockout
- **Audit log** — All critical operations (PIN resets, eval lock, deletions) recorded in `audit_logs`

---

## Test Status

```text
Unit:  276/276 ✓
E2E:     9/10  ✓  (1 skipped — requires locked semester)
```

---

## Documentation

Project documentation is available in the `docs/` directory:

| Folder | Contents |
| --- | --- |
| [`docs/architecture/`](docs/architecture/) | System overview, database schema |
| [`docs/deployment/`](docs/deployment/) | Environment variables, Supabase setup, Vercel deployment, Git workflow |
| [`docs/qa/`](docs/qa/) | Vitest guide, E2E guide, smoke test plan, QA workbook, session records |
| [`docs/audit/`](docs/audit/) | Dated production audit reports (gitignored) |
| [`docs/reports/`](docs/reports/) | Tech debt register, release blockers (gitignored) |

---

## Branding

| Usage | Name |
|---|---|
| Product name | **VERA** |
| Institutional deployment | **TEDU VERA** |
| Full expansion | **VERA — Verdict & Evaluation Ranking Assistant** |
| Suggested repo name | `tedu-vera` |

VERA is the product brand. TEDU VERA is the name used in institutional or formal contexts (reports, headers, documentation).
