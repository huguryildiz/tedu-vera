# Architecture

## Routing

React Router v6 via `createBrowserRouter` in `src/router.jsx`. **Environment determined purely by URL pathname**: `/demo/*` → demo Supabase; everything else → prod. Resolved in `src/shared/lib/environment.js`, propagated via Proxy client in `src/shared/lib/supabaseClient.js`.

**Route tree:**

- `/` — Landing
- `/login` | `/register` | `/forgot-password` | `/reset-password` | `/invite/accept` — auth screens under `AuthRouteLayout`
- `/eval` — jury gate (entry-token verification)
- `/jury/*` — jury flow (guarded by `JuryGuard`). Child paths: `identity`, `period`, `pin`, `pin-reveal`, `locked`, `progress`, `evaluate`, `complete`
- `/admin/*` — admin panel under `AdminRouteLayout`. Child paths: `overview`, `rankings`, `analytics`, `heatmap`, `reviews`, `jurors`, `projects`, `periods`, `criteria`, `outcomes`, `entry-control`, `pin-blocking`, `audit-log`, `organizations`, `settings`
- `/demo` → `DemoAdminLoader` auto-login → `/demo/admin`
- `/demo/*` — all routes mirrored under demo namespace
- `/jury-entry` legacy redirect; catch-all → `/`

Layouts: `RootLayout`, `AuthRouteLayout`, `AdminRouteLayout`, `DemoLayout`. Guards: `JuryGuard`, `AuthGuard`. Pages are `React.lazy()`'d.

## Multi-Tenant Architecture

Admin uses **Supabase Auth + JWT**. Super-admin: `organization_id IS NULL` in `memberships`. Tenant-admin: `organization_id NOT NULL`. Legacy v1 password RPCs kept for backward compat. JWT RPCs named `rpc_admin_*` with `_assert_tenant_admin()`.

Auth flow: email/password or Google OAuth → tenant membership check → `PendingReviewGate` if pending. New Google OAuth users complete `CompleteProfileForm`. Entry tokens: 24h TTL, revocable. Jury flow is tenant-implicit (token → semester → tenant).

## Jury Evaluation Flow

`src/jury/shared/useJuryState.js` orchestrates sub-hooks in `src/jury/features/`. Steps: `identity → period → (pin | pin_reveal) → progress_check → eval → done`.

**Write strategy (critical):** `onChange` → React state only; `onBlur` → `writeGroup(pid)` upserts to DB; group nav + `visibilitychange` also save. `lastWrittenRef` deduplication prevents redundant RPCs.

## Admin Panel

Feature pages in `src/admin/features/`. Shared hooks and components in `src/admin/shared/`. Key: `useSettingsCrud` (orchestrator), `useAdminData` (score loading), `useAdminRealtime` (subscriptions).

## API Layer

Never call `supabase.rpc()` directly from components — go through `src/shared/api/`.

- `src/shared/api/index.js` — public surface; always import from here
- `src/shared/api/admin/` — modular admin RPC wrappers: auth, profiles, tenants, scores, semesters, projects, jurors, tokens, export, audit
- `src/shared/api/admin/scores.js` — score aggregation lives here. **Never re-aggregate scores client-side**: `getProjectSummary`, `getJurorSummary`, `getPeriodSummary` are thin wrappers around the three server-side aggregation RPCs (`rpc_admin_project_summary`, `rpc_admin_juror_summary`, `rpc_admin_period_summary`). Drawers and pages consume these via `useAdminContext()` and render the values directly (no `useMemo` reduces over `rawScores` for averages, std dev, rank, or "vs avg" deltas).
- `src/shared/api/juryApi.js` — jury RPCs
- `src/shared/api/fieldMapping.js` — UI↔DB mapping (`design`→`written`, `delivery`→`oral`); apply only here, never in components
- `src/shared/api/core/invokeEdgeFunction.js` — raw-fetch wrapper for Edge Functions (always POST)

## Edge Function Patterns

Full rules + gotchas: `.claude/rules/edge-functions.md`. Reference implementations: `supabase/functions/platform-metrics/index.ts` and `supabase/functions/admin-session-touch/index.ts`.

## Realtime Subscriptions

Full rules + cleanup contract: `.claude/rules/realtime.md`. Canonical hook: `src/admin/shared/useAdminRealtime.js` (score cluster only — `jurors` and `periods` subscriptions live in their feature hooks).

## Browser Storage Policy

Full policy: `docs/architecture/storage-policy.md`. Key rules:

- **All storage keys in `src/shared/storage/keys.js`** — no hardcoded key strings in components or hooks.
- **All storage access through abstraction layers** — `juryStorage.js`, `adminStorage.js`, `persist.js`. No raw `localStorage.setItem()` outside storage modules.
- **Never store secrets** — passwords, API keys, service-role tokens never touch browser storage. Supabase Auth tokens are SDK-managed only.
- **Never cache score data** — always fetched fresh from server (live evaluation days need real-time truth).
- **localStorage for persistent preferences** — theme, admin filters/sorts, remember-me, device ID, jury session resume.
- **sessionStorage for per-tab ephemeral state** — guided tour flags, one-time UI prompts.
- **Dual-write (both storages) for access gates** — jury access grants and admin raw tokens need both tab-level and restart-level persistence.
- **Wrap all storage calls in try/catch** — Safari private mode, full storage, and disabled cookies can throw.
- **Server is truth** — jury session tokens, access grants, and tenant membership are always validated server-side. Browser storage is convenience, not authorization.
