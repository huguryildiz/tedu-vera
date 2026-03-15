# Architecture — VERA (TEDU Capstone Jury Evaluation Portal)

## Overview

Single-page React application (Vite) communicating with a Supabase backend exclusively through PostgreSQL RPC functions. No traditional REST API, no custom backend server.

---

## State-Based Routing

`App.jsx` manages a top-level `page` state with three values: `"home"`, `"jury"`, `"admin"`.

```text
home  ──→  jury   (JuryForm.jsx)
home  ──→  admin  (AdminPanel.jsx, password-gated)
```

**Why no React Router?** This tool has no URL-sharing or deep-linking requirements. Evaluators open the app on a shared device, complete the flow, and leave. State-based routing keeps the bundle smaller and eliminates browser-history complexity in a multi-step evaluation flow.

---

## Demo Mode

Controlled by two environment variables set at build time:

| Variable | Effect |
| --- | --- |
| `VITE_DEMO_MODE=true` | Enables demo mode — pre-fills the admin password field and restricts certain settings |
| `VITE_DEMO_ADMIN_PASSWORD` | The password pre-filled in demo mode |

In demo mode, the Settings tab may have restricted access to prevent accidental data changes on a shared demo deployment. This is the only behavioral difference from a standard deployment.

---

## Admin Panel Architecture

```text
App.jsx
└── AdminPanel.jsx                  ← receives adminPass via prop (useRef in App)
    ├── OverviewTab.jsx             ← summary stats, juror activity
    ├── ScoresTab.jsx               ← score grid with freeze/export
    │   ├── ScoreGrid.jsx
    │   ├── ScoreDetails.jsx
    │   └── useScoreGridData.js     ← data loading, filtering, sorting
    ├── RankingsTab.jsx             ← project rankings
    ├── AnalyticsTab.jsx            ← MÜDEK charts (lazy-rendered)
    │   └── src/charts/*            ← individual chart components
    └── SettingsPage.jsx            ← manage semesters, projects, jurors
        ├── ManageSemesterPanel.jsx
        ├── ManageProjectsPanel.jsx
        ├── ManageJurorsPanel.jsx
        └── ManagePermissionsPanel.jsx
```

**Admin password flow:**

1. User enters password on login screen
2. `rpc_admin_login` verifies it; password stored in `useRef` (never in React state)
3. Every subsequent admin RPC call passes the password as `p_admin_password`
4. On logout or auth failure, ref is cleared

---

## Jury Evaluation Flow

```text
JuryForm.jsx
└── useJuryState.js                 ← state machine for 6-step flow
    ├── PinStep.jsx                 ← Step 1: 4-digit PIN entry
    ├── PinRevealStep.jsx           ← Step 2: PIN display (first login only)
    ├── InfoStep.jsx                ← Step 3: name + department
    ├── SemesterStep.jsx            ← Step 4: active semester selection
    ├── EvalStep.jsx                ← Step 5: score all projects
    │   └── SheetsProgressDialog   ← submission progress
    └── DoneStep.jsx                ← Step 6: confirmation screen
```

`PinRevealStep` is shown only on first login when the juror's PIN has been newly generated and has not yet been acknowledged.

**State persistence:** `juror_id` and `semester_id` survive page refreshes via `localStorage` for same-device convenience. Cleared on final submission.

---

## Supabase RPC Integration

All backend communication goes through `src/shared/api.js`. Components never call `supabase.rpc()` directly.

```text
Component
  → api.js function
    → supabase.rpc("rpc_function_name", { params })
      → PostgreSQL function (RLS-enforced)
        → returns data
      → api.js normalizes field names
    → component receives typed data
```

**Field name normalization** happens exclusively in `api.js`:

- DB `written` → UI `design`
- DB `oral` → UI `delivery`

**Auth model:**

- Jurors: 4-digit PIN verified via `rpc_juror_login` (rate-limited in DB — 3 failures → lockout)
- Admin: password passed per-call to protected RPCs (stateless)
- RLS: all tables protected; access granted only through SECURITY DEFINER RPC functions

**Production security:** In production, all admin RPC calls go through the `rpc-proxy` Supabase Edge Function (`supabase/functions/rpc-proxy/index.ts`). This keeps the `RPC_SECRET` out of the browser — it lives in Supabase Vault. In development, RPCs are called directly using `VITE_RPC_SECRET` from `.env.local`.

---

## Chart Analytics System

Charts live in `src/charts/`. Each file exports a primary component and a `*Print` variant for print/PDF rendering.

```text
src/charts/
├── index.js                    ← barrel export (re-exported by src/Charts.jsx shim)
├── chartUtils.jsx              ← CHART_OUTCOMES, OUTCOMES, shared SVG helpers
├── OutcomeOverviewChart.jsx    ← MÜDEK outcome overview (bar chart)
├── OutcomeTrendChart.jsx       ← cross-semester outcome trend (line chart)
├── OutcomeByGroupChart.jsx     ← per-group outcome breakdown
├── CompetencyRadarChart.jsx    ← radar chart per criterion
├── CriterionBoxPlotChart.jsx   ← score distribution box plots
├── JurorHeatmapChart.jsx       ← juror consistency heatmap
├── RubricAchievementChart.jsx  ← MÜDEK achievement band chart
└── MudekBadge.jsx              ← outcome code badge component
```

`src/Charts.jsx` is a compatibility shim: `export * from "./charts/index"`. It preserves any old import paths.

Data flows: `AnalyticsTab.jsx` fetches data via `api.js`, then passes it as props to chart components. Charts are pure rendering components with no data fetching.

---

## Configuration

`src/config.js` is the single source of truth for:

- Evaluation criteria (id, label, color, max score, MÜDEK codes, rubric bands)
- MÜDEK outcome definitions (18 outcomes, EN + TR text)
- `TOTAL_MAX` (derived: sum of all criteria max scores = 100)
- `MUDEK_THRESHOLD` (70 — reference line on outcome charts)
- `BAND_COLORS` (achievement band color tokens)

**Never hardcode criterion IDs or max scores in components.** Always import from `config.js`.

---

## Source Layout

```text
src/
├── App.jsx                 ← root, state-based routing, admin auth via useRef
├── AdminPanel.jsx          ← admin interface root
├── JuryForm.jsx            ← jury flow root
├── config.js               ← evaluation criteria, MÜDEK outcomes, colors
├── Charts.jsx              ← compatibility shim for charts/index
├── admin/                  ← admin tabs, hooks, panels, export utilities
│   └── settings/           ← settings sub-components (dialogs, panels)
├── jury/                   ← 6-step evaluation flow + state machine
├── charts/                 ← modular SVG chart components
├── components/             ← shared UI components
│   ├── Toast.jsx / ToastContainer.jsx / useToast.js
│   ├── AdminSecurityPanel.jsx
│   ├── DeleteConfirmDialog.jsx
│   └── DangerIconButton.jsx
├── shared/                 ← cross-cutting utilities
│   ├── api.js              ← all Supabase RPC calls + field mapping (critical)
│   ├── ErrorBoundary.jsx
│   ├── Icons.jsx
│   └── stats.js, dateBounds.js, semesterSort.js, scrollIndicators.js
├── lib/
│   └── supabaseClient.js   ← Supabase client initialization
├── styles/                 ← one CSS file per major area
└── test/                   ← qaTest helper, qa-catalog.json, setup.js
```

---

## Styling

Plain CSS files in `src/styles/`. Each major area has its own file:

| File | Scope |
| --- | --- |
| `home.css` | Landing page |
| `jury.css` | Jury evaluation flow |
| `admin-layout.css` | Admin panel layout |
| `admin-dashboard.css` | Admin tab content |
| `admin-matrix.css` | Score grid |
| `admin-manage.css` | Settings panels |
| `shared.css` | Cross-cutting tokens and utilities |
| `toast.css` | Toast notifications |

---

## Testing Architecture

- **Unit tests** — Vitest + Testing Library. 276 tests across 36 files in `src/admin/__tests__/`, `src/jury/__tests__/`, `src/shared/__tests__/`, and `src/test/`.
- **E2E tests** — Playwright. 6 spec files in `e2e/`. 9 of 10 tests pass; 1 skipped (requires a locked semester in the demo DB).
- **Reporting** — Allure dashboard via `npm run test:report && npm run allure:generate`. Excel reports via `npm run report:all`.
- **CI** — GitHub Actions runs unit tests on every push/PR. E2E job is currently disabled (`if: false`) — run locally with `npm run e2e`.

See [docs/qa/vitest-guide.md](../qa/vitest-guide.md) and [docs/qa/e2e-guide.md](../qa/e2e-guide.md) for full testing guides.
