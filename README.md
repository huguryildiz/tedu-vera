<p align="center">
  <img src="src/assets/vera_logo_white.png" alt="VERA Logo" width="600">
</p>

<h3 align="center">Academic Jury Evaluation Platform</h3>

<p align="center">
  Structured, transparent, and scalable capstone project assessment — built for universities.
</p>

<p align="center">
  <a href="https://vera-eval.app"><img src="https://img.shields.io/badge/Production-vera--eval.app-0f172a?style=for-the-badge&logo=vercel&logoColor=white" alt="Production"></a>
  &nbsp;
  <a href="https://demo.vera-eval.app"><img src="https://img.shields.io/badge/Live%20Demo-demo.vera--eval.app-e67e22?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Live Demo"></a>
</p>

---

## 💡 Why VERA?

Capstone evaluation events are high-stakes, time-constrained, and involve dozens of jurors moving across project stations. Paper rubrics get lost, spreadsheets lag behind, and results take days to compile.

**VERA replaces all of that.** Jurors scan a QR code, authenticate with a PIN, score projects on a guided rubric, and submit — all from their phone or tablet. Admins see live rankings, analytics, and accreditation-ready reports as scores come in.

---

## ✨ Core Features

| Feature | Description |
|---|---|
| 📱 **QR / token jury entry** | Jurors scan a QR code or follow a link — no sign-up, no app download |
| 🔐 **PIN-based juror auth** | 4-digit PINs per juror per semester; bcrypt-hashed, rate-limited (3 failures → 15 min lockout) |
| 🧭 **Guided evaluation flow** | Identity → semester → PIN → project scoring → submission — impossible to skip a step |
| 📝 **Configurable rubric** | Default: Technical (0–30), Written (0–30), Oral (0–30), Teamwork (0–10). Fully customizable criteria, weights, and rubric bands |
| 💾 **Real-time auto-save** | Scores persist on field blur and tab-hide — no data lost if browser closes |
| 📊 **Live admin dashboard** | Score grid, rankings, overview metrics, and analytics charts — updated in real time |
| 🏛️ **Multi-tenant architecture** | Each university/department is an isolated tenant with its own semesters, projects, and jurors |
| 🔑 **Google OAuth + email login** | Admins sign in with Google or email/password; remember-me for 30-day sessions |
| 📋 **Self-service registration** | Admins apply for tenant access; existing admins approve applications |
| 🎓 **[MÜDEK](https://www.mudek.org.tr/tr/belge/doc.shtm) outcome tracking** | Criteria mapped to 18 MÜDEK learning outcomes with achievement-level reporting |
| 📥 **XLSX export** | Score details, evaluation grid, rankings — all downloadable as formatted Excel files |
| 🕵️ **Audit log** | Every critical admin operation recorded with actor, action, and timestamp |
| ⏱️ **Entry token security** | 24-hour TTL, revocable tokens with active session tracking |

---

## 👥 User Roles

| Role | Access |
|---|---|
| **Juror** | QR/token entry → PIN auth → score assigned project groups → submit evaluations |
| **Tenant Admin** | Manage semesters, projects, jurors within their organization; view analytics; export data |
| **Super Admin** | Global scope — manage all tenants, approve applications, cross-tenant analytics |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Backend | Supabase (PostgreSQL + RPC functions + RLS) |
| Auth | Supabase Auth (email/password + Google OAuth) · Juror: QR token + 4-digit PIN (bcrypt) |
| Edge Functions | Deno (application approval, password reset emails, notifications) |
| Unit Tests | Vitest + Testing Library |
| E2E Tests | Playwright |
| Export | xlsx-js-style |
| Drag & Drop | @dnd-kit |
| Charts | Custom SVG components |
| Icons | lucide-react |
| Virtual Scrolling | react-window |
| Validation | Zod |

---

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                     React SPA (Vite)                     │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │ Jury Flow│  │Admin Panel│  │ Auth (Google/Email/PIN)│ │
│  └────┬─────┘  └────┬─────┘  └───────────┬────────────┘ │
│       │              │                    │              │
│       └──────────────┼────────────────────┘              │
│                      │                                   │
│              src/shared/api/                              │
│         (all Supabase calls here)                        │
└──────────────────────┬───────────────────────────────────┘
                       │
          ┌────────────┼────────────────┐
          │            │                │
          ▼            ▼                ▼
   ┌────────────┐ ┌─────────┐  ┌──────────────┐
   │ Supabase   │ │ RPC     │  │ Edge         │
   │ Auth       │ │ Functions│  │ Functions    │
   │ (JWT/OAuth)│ │ (PLPGSQL)│  │ (Deno/TS)   │
   └────────────┘ └────┬────┘  └──────────────┘
                       │
                  ┌────┴────┐
                  │PostgreSQL│
                  │ + RLS    │
                  └─────────┘
```

---

## 📁 Project Structure

```text
src/
├── App.jsx                 # Root — state-based routing (home / jury_gate / jury / admin)
├── config.js               # Evaluation criteria, MÜDEK outcomes, colors (single source of truth)
├── admin/
│   ├── AdminPanel.jsx      # Admin interface root
│   ├── hooks/              # 15+ focused hooks (useManageSemesters, useManageJurors, etc.)
│   ├── components/         # TenantSwitcher, UserAvatarMenu, PendingReviewGate, analytics/
│   ├── settings/           # PinResetDialog, AuditLogCard, ExportBackupPanel
│   ├── criteria/           # CriteriaManager decomposition
│   ├── projects/           # ManageProjectsPanel decomposition
│   ├── analytics/          # AnalyticsTab: datasets, export, UI components
│   └── xlsx/               # Excel export utilities
├── jury/
│   ├── useJuryState.js     # Thin orchestrator for jury flow state
│   ├── hooks/              # 7+ focused hooks (useJuryScoring, useJuryAutosave, etc.)
│   ├── JuryForm.jsx        # Jury flow root
│   ├── JuryGatePage.jsx    # QR / entry token verification
│   └── *Step.jsx           # Step components (Info, Semester, Pin, PinReveal, Eval, Done)
├── charts/                 # Analytics charts (Radar, BoxPlot, Heatmap, Outcome, Trend)
├── components/
│   ├── auth/               # LoginForm, RegisterForm, CompleteProfileForm, ForgotPassword, etc.
│   └── toast/              # Toast notification system
└── shared/
    ├── api/                # Modularized API layer
    │   ├── admin/          # auth, profiles, tenants, scores, semesters, projects, jurors, tokens
    │   ├── core/           # Supabase client, retry mechanism
    │   ├── juryApi.js      # Jury RPC wrappers
    │   └── fieldMapping.js # UI ↔ DB field mapping
    ├── auth/               # AuthProvider (Supabase Auth + Google OAuth + remember-me)
    ├── schemas/            # Zod validation schemas
    ├── ErrorBoundary.jsx   # Top-level error boundary
    └── ConfirmDialog.jsx   # Unified confirmation dialog

sql/
├── migrations/             # 001–023: modular migrations (apply in order)
└── seeds/                  # 001_multi_tenant_seed.sql: demo data

supabase/functions/
├── rpc-proxy/              # Routes admin RPCs, injects RPC_SECRET server-side
├── approve-admin-application/  # Creates Supabase Auth user on approval
├── password-reset-email/   # Sends reset email via Resend API
├── password-changed-notify/# Notifies user of password change
└── notify-application/     # Notifies applicant of status change
```

---

## 🚀 Quick Start

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

### 3. Bootstrap the database

Run migrations in order in Supabase SQL Editor:

```sql
-- Apply all migrations (001–023)
\i sql/migrations/001_core_schema.sql
\i sql/migrations/002_triggers.sql
-- ... through 023
```

### 4. Run the dev server

```bash
npm run dev          # localhost:5173
npm test             # unit tests (watch mode)
npm test -- --run    # unit tests (single run)
npm run build        # production build
```

### 5. E2E tests

Requires `.env.e2e.local` (copy from `.env.e2e.example`):

```bash
npm run e2e          # Playwright E2E tests
npm run e2e:report   # open HTML report
```

---

## 📐 Evaluation Criteria

| Criterion | Max Score |
|---|---|
| Technical Content | 30 |
| Written Communication | 30 |
| Oral Communication | 30 |
| Teamwork | 10 |
| **Total** | **100** |

Criteria, rubric bands, and MÜDEK outcome mappings are fully configurable via the admin panel and defined in `src/config.js`.

---

## 🔒 Security

| Layer | Mechanism |
|---|---|
| **Row-Level Security** | All tables RLS-enforced; only `SECURITY DEFINER` RPCs can access data |
| **Admin auth** | Supabase Auth (JWT) — email/password + Google OAuth; remember-me with 30-day sessions |
| **RPC proxy** | Production admin RPCs route through Edge Function — `rpc_secret` never reaches the browser |
| **Juror PIN auth** | Bcrypt-hashed; 3 incorrect attempts → 15-minute lockout |
| **Entry tokens** | Short-lived (24h TTL), revocable, hash-verified; QR code or URL param `?t=` |
| **Tenant isolation** | Multi-tenant RLS — each tenant sees only its own data |
| **Application workflow** | Anonymous tenant applications → admin approval → server-side user creation |
| **Audit log** | All critical operations (PIN resets, eval lock, deletions) recorded in `audit_logs` |

---

## 📚 Documentation

| Folder | Contents |
|---|---|
| [`docs/architecture/`](docs/architecture/) | System overview, database schema |
| [`docs/deployment/`](docs/deployment/) | Environment variables, Supabase setup, Vercel deployment, Git workflow |
| [`docs/qa/`](docs/qa/) | Vitest guide, E2E guide, smoke test plan, QA workbook, session records |
| [`docs/refactor/`](docs/refactor/) | Phase 0–6 refactor documentation |

---

## 🏷️ Branding

| Usage | Name |
|---|---|
| Product name | **VERA** |
| Full expansion | **Verdict & Evaluation Ranking Assistant** |
| Institutional deployment | **TEDU VERA** (or `<University> VERA`) |

---

<p align="center">
  Built with Supabase, React, and Vite<br>
  <sub>First deployed at TED University · Designed for broader university adoption</sub>
</p>
