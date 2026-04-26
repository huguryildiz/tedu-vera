# Architecture — VERA

## Overview

Multi-tenant academic jury evaluation platform. Jurors score student capstone
projects; admins manage tenants, evaluation periods, projects, jurors, and
analytics.

Single-page React application (Vite) backed by Supabase (PostgreSQL + Auth +
Edge Functions). All backend communication goes through PostgreSQL RPC functions
or Supabase Edge Functions — no traditional REST API, no custom backend server.

---

## Routing

React Router v6 via `createBrowserRouter` in `src/router.jsx`.

**Environment is determined purely by URL pathname:**
`/demo/*` → demo Supabase project; everything else → production. Resolved in
`src/shared/lib/environment.js`, propagated via Proxy client in
`src/shared/lib/supabaseClient.js`.

**Route tree:**

```text
/                        Landing
/login | /register | /forgot-password | /reset-password | /invite/accept
                         Auth screens (AuthRouteLayout)
/eval                    Jury entry-token gate
/jury/*                  Jury flow (JuryGuard)
  identity → period → (pin | pin-reveal) → locked → progress → evaluate → complete
/admin/*                 Admin panel (AdminRouteLayout + AuthGuard)
  overview | rankings | analytics | heatmap | reviews
  jurors | projects | periods | criteria | outcomes
  entry-control | pin-blocking | audit-log | organizations | settings
/demo                    DemoAdminLoader → auto-login → /demo/admin
/demo/*                  All routes mirrored under demo namespace
```

---

## Roles & Permissions

VERA has three distinct actor types. All rely on Supabase Auth JWTs — the
`memberships` table determines what each authenticated user can do.

### Super-Admin

A user whose membership row has `organization_id IS NULL`. Has platform-wide
access: can list/create/delete organizations, approve tenant applications,
manage all org admins, and access the Audit Log.

Checked in DB via `_assert_super_admin()` helper (raises `unauthorized` if not).

### Org Admin (Tenant Admin)

A user with a membership row scoped to a specific org (`organization_id NOT NULL`,
`role = 'org_admin'`, `status = 'active'`). Can manage their org's evaluation
periods, projects, jurors, criteria, scores, and admin team.

Checked in DB via `_assert_tenant_admin(p_org_id)`.

### Owner vs Regular Admin

Within an org's admin team, one member holds the **Owner** role (`is_owner = true`
on their membership row). Only one owner per org at a time.

| Capability | Owner | Regular Admin |
|---|---|---|
| Invite new admins | Always | Only if `admins_can_invite = true` |
| Cancel pending invites | Always | Only if `admins_can_invite = true` |
| Remove other admins | Yes | No |
| Transfer ownership | Yes (gives up own owner flag) | No |
| Toggle "admins can invite" | Yes | No |
| All other admin actions | Yes | Yes |

**`admins_can_invite`** is a per-org flag on the `organizations` table. When
enabled, all active admins in the org can invite and cancel invites; otherwise
only the owner can.

Ownership transfer is atomic: `rpc_org_admin_transfer_ownership` sets the target's
`is_owner = true` and clears the caller's in one transaction.

### Invite Flow

1. Owner (or delegated admin) calls `invite-org-admin` Edge Function with an email.
2. If the email has no confirmed auth account → `generateLink(invite)` creates an
   unconfirmed `auth.users` row + sends branded email via Resend. A membership row
   with `status = 'invited'` is inserted.
3. If the email already has a confirmed auth account → returns `409 already_exists_in_auth`
   (the admin must ask that person to sign in and request access normally).
4. Invitee clicks the link → `rpc_accept_invite` promotes all `invited` memberships
   for that user to `active`.
5. If the invite is cancelled before acceptance → `rpc_org_admin_cancel_invite`
   deletes the membership row, the profile row, and the `auth.users` row (only if
   the user has no other org memberships).

### Juror (Non-auth)

Jurors do not have Supabase Auth accounts. They authenticate via:

1. Entry token (QR code / URL `?t=<token>`) — 24h TTL, revocable
2. 4-digit PIN per semester — rate-limited (3 failures → 15 min lockout per semester)

---

## Admin Auth Flow

1. User signs in via email/password or Google OAuth → Supabase Auth session.
2. `AuthProvider` checks `memberships` table: no active membership → `PendingReviewGate`.
3. New Google OAuth users complete `CompleteProfileForm` before entering admin.
4. JWT attached to every request; RLS enforces org scope on all tables.
5. Production admin RPCs route through `supabase/functions/rpc-proxy/index.ts`
   (keeps `RPC_SECRET` out of the browser — lives in Supabase Vault).
   In dev, RPCs called directly using `VITE_RPC_SECRET` from `.env.local`.

---

## Jury Evaluation Flow

`src/jury/useJuryState.js` orchestrates sub-hooks. Step components are dumb
(receive state + callbacks via hook).

```text
JuryGatePage.jsx                    ← QR / entry-token verification
└── (on success) → jury flow
    └── useJuryState.js             ← orchestrates sub-hooks
        ├── identity                ← juror name + department
        ├── period                  ← select active evaluation period
        ├── pin | pin_reveal        ← 4-digit PIN entry / first-login PIN display
        ├── (progress_check)        ← internal gate, no dedicated component
        ├── evaluate                ← score all projects
        └── complete                ← confirmation screen
```

**Write strategy (critical):** `onChange` → React state only; `onBlur` →
`writeGroup(pid)` upserts to DB. Group navigation and `visibilitychange` also
save. `lastWrittenRef` deduplication prevents redundant RPCs.

**Sub-hooks** (`src/jury/hooks/`):

- `useJurorIdentity` — juror name, dept, auth error
- `useJurorSession` — PIN / session token
- `useJuryLoading` — period/project loading + abort ref
- `useJuryScoring` — scoring state + pending refs
- `useJuryEditState` — edit/lock state + polling effect
- `useJuryWorkflow` — step navigation, derived values
- `useJuryAutosave` — `writeGroup`, visibility auto-save
- `useJuryHandlers` — cross-hook callbacks

---

## Admin Panel Architecture

Pages in `src/admin/pages/`. Hooks in `src/admin/hooks/`.

```text
AdminRouteLayout
└── AdminPanel.jsx
    ├── OverviewPage       ← summary metrics, juror activity
    ├── RankingsPage       ← project rankings
    ├── AnalyticsPage      ← MÜDEK/ABET charts (lazy-loaded)
    ├── HeatmapPage        ← juror consistency heatmap
    ├── ReviewsPage        ← per-project score details
    ├── JurorsPage         ← juror management
    ├── ProjectsPage       ← project CRUD
    ├── PeriodsPage        ← evaluation period management
    ├── CriteriaPage       ← rubric criteria + outcome mappings
    ├── OutcomesPage       ← learning outcomes
    ├── EntryControlPage   ← entry token management
    ├── PinBlockingPage    ← PIN lockout management
    ├── AuditLogPage       ← platform audit log
    ├── OrganizationsPage  ← (super-admin) org + admin team management
    └── SettingsPage       ← org-level settings
```

**Key hooks:**

- `useSettingsCrud` — orchestrator wiring domain hooks
- `useAdminData` — score data loading + project summary
- `useAdminRealtime` — Supabase Realtime subscriptions
- `useAdminTeam` — admin team members, invite flow, ownership, delegation flag
- `useManageOrganizations` — super-admin org list + per-org admin management

---

## Supabase RPC Integration

All backend communication goes through `src/shared/api/`. Components never call
`supabase.rpc()` directly.

```text
Component
  → src/shared/api/<module>.js function
    → supabase.rpc(...)  or  invokeEdgeFunction(...)
      → PostgreSQL SECURITY DEFINER function (RLS-enforced)
        → returns data
      → api normalizes field names (fieldMapping.js)
    → component receives normalized data
```

**API module structure** (`src/shared/api/`):

- `index.js` — re-exports everything; always import from here
- `adminApi.js` — all admin RPC wrappers
- `admin/` — modular: auth, profiles, organizations, scores, semesters, projects,
  jurors, tokens, export, audit
- `juryApi.js` — jury RPC wrappers
- `fieldMapping.js` — UI ↔ DB field name translation (`design`↔`written`, `delivery`↔`oral`)
- `core/client.js` — Supabase client init + Proxy config
- `core/invokeEdgeFunction.js` — raw-fetch wrapper for Edge Functions (always POST)

---

## Multi-Tenant Architecture

Each organization is a row in `organizations`. Membership rows scope users to orgs.

```text
organizations
  └── memberships (user_id, organization_id, role, status, is_owner)
        ├── status: 'active' | 'invited' | 'requested'
        ├── role: 'org_admin'
        └── is_owner: boolean (one per org)
```

RLS policies enforce org isolation on all tenant data. RPCs use
`_assert_tenant_admin(p_org_id)` or `_assert_super_admin()` as first statement.

**Edge Function auth pattern (critical):** Use `auth.getUser(token)` (Auth-v1,
tolerates ES256 JWTs) + service role for DB ops. Do not use `caller.rpc()` for
caller verification — PostgREST rejects ES256 JWTs in some projects.

---

## Configuration

`src/config.js` is the single source of truth for evaluation criteria (id,
label, color, max score, MÜDEK codes, rubric bands), MÜDEK outcome definitions,
`TOTAL_MAX`, `MUDEK_THRESHOLD`, and `BAND_COLORS`.

Never hardcode criterion IDs or max scores in components — always import from
`config.js`.

---

## Database Migration Policy

Snapshot-based (final state, not historical patches). Migration files in
`sql/migrations/` numbered `000`–`009`. Every migration runs on both vera-prod
and vera-demo in the same step. See `sql/README.md` for the full policy.

---

## Source Layout

```text
src/
├── router.jsx              ← React Router v6 route tree
├── config.js               ← evaluation criteria, MÜDEK outcomes, colors
├── admin/
│   ├── pages/              ← one file per admin page
│   ├── hooks/              ← focused hooks (useAdminTeam, useSettingsCrud, etc.)
│   ├── components/         ← shared admin components + cards
│   ├── drawers/            ← drawer components
│   ├── modals/             ← modal components
│   └── utils/              ← auditUtils, sorting helpers
├── jury/
│   ├── useJuryState.js     ← jury flow orchestrator
│   ├── hooks/              ← 8 focused hooks
│   └── utils/              ← scoreState, progress, scoreSnapshot
├── shared/
│   ├── api/                ← API layer (never call supabase directly from components)
│   ├── auth/               ← AuthProvider, AuthGuard, Google OAuth
│   ├── hooks/              ← useToast, useCardSelection, etc.
│   ├── lib/                ← supabaseClient (Proxy), environment
│   ├── storage/            ← keys.js, juryStorage, adminStorage, persist
│   └── ui/                 ← shared UI components (FbAlert, CustomSelect, etc.)
├── styles/                 ← one CSS file per major area + variables.css
└── test/                   ← qaTest helper, qa-catalog.json
```

---

## Testing

- **Unit tests** — Vitest + Testing Library. `src/admin/__tests__/`,
  `src/jury/__tests__/`, `src/shared/__tests__/`.
- **E2E tests** — Playwright. `e2e/` spec files.
- **Run:** `npm test -- --run` (unit), `npm run e2e` (E2E).
- **CI** — GitHub Actions runs unit tests on every push/PR.

See [docs/testing/unit-tests.md](../testing/unit-tests.md) and
[docs/testing/e2e-tests.md](../testing/e2e-tests.md) for full guides.
