# VERA — Target Test Architecture

**Status:** Forward-looking design spec. Read this as the architecture future
contributors should aim at, not as a description of current state.

**Audience:** Contributors writing or reviewing tests, CI maintainers, and
anyone proposing a new test layer or tool.

**Scope of authority:** This document is canon for *what to test, where, and
with which tool*. Code-style conventions still come from `CLAUDE.md`.

---

## 1. Executive summary

VERA is a multi-tenant academic evaluation platform where four properties
are non-negotiable:

1. **Tenant isolation** — a juror or admin in tenant A must never read,
   write, or even infer the existence of data in tenant B.
2. **Score arithmetic correctness** — final scores feed rankings and
   accreditation outcome attainment; rounding errors and unit mistakes are
   accreditation-grade defects.
3. **Period lock immutability** — once a period is locked, no path
   (UI, RPC, Edge Function, direct SQL via RLS) may mutate scores.
4. **Jury-day reliability** — evaluation happens on a single live event;
   autosave, group-nav writes, and reconnect after a flaky network must
   not lose data.

Generic web SaaS pyramids ("70% unit / 20% integration / 10% E2E") are
wrong for VERA, because three of those four risks live in PostgreSQL, not
in JS. Most JS tests cannot prove tenant isolation; only a test that runs
SQL with a tenant-scoped JWT can. We therefore specialize the pyramid
around the database.

The target shape, by **test count** (not lines of code, not runtime):

```
                        ▲ E2E (Playwright)              ~5%
                       ▲▲ Edge Function tests (Deno)    ~5%
                     ▲▲▲▲ Contract tests (pgTAP+TS)     ~15%
                  ▲▲▲▲▲▲▲ Integration (Vitest + DB)     ~15%
              ▲▲▲▲▲▲▲▲▲▲▲ Unit (Vitest jsdom)           ~60%
```

The unusual choices versus typical React shops:

- **Contract tests are a first-class layer**, not a footnote. RLS policies
  and RPC signatures are pinned with pgTAP because nothing else can.
- **Integration tests run against a real Postgres**, never against MSW.
  Mocked SQL gives false confidence on RLS.
- **E2E count is held deliberately low** (≈30–40 specs). E2E is reserved
  for journeys that span auth + RPC + UI + Realtime; everything narrower
  is pushed down the pyramid.

CI runtime budget for the full suite: **≤ 12 minutes** on the default
runner. Anything that pushes past that gets moved to a nightly job, never
absorbed silently.

---

## 2. The test pyramid for VERA

### 2.1 Layers and what each owns

| Layer | Tool | What it owns | What it must NOT do |
|---|---|---|---|
| Unit | Vitest + jsdom | Pure logic, hooks, components in isolation | Hit network, hit DB, render full router tree |
| Integration | Vitest + real Supabase test project | Hooks/services against real RPCs and RLS, edge-case data shapes | Drive UI, span more than one feature |
| Contract — RLS | pgTAP | Tenant isolation matrix, role × table × tenant | Test business logic; just access control |
| Contract — RPC | pgTAP + a TS shape pin | Argument names, return columns, error codes | Test full happy path semantics |
| Contract — Edge | Deno test + a TS shape pin | HTTP request/response shape, auth gate | Run end-to-end DB scenarios |
| E2E | Playwright | User journeys spanning auth + RPC + UI + Realtime | Be the place we discover RLS bugs |
| Visual / a11y | Playwright + axe | Layout regressions, WCAG AA blockers | Replace component-level visual review |

### 2.2 Justification of the ratio for VERA specifically

A standard React pyramid puts ~70% in unit tests because most risk is
component logic. In VERA, most risk is in:

- **89 RLS policies across 27 RLS-enabled tables** (`sql/migrations/004_rls.sql`)
- **~89 unique `rpc_*` SECURITY DEFINER functions** across migrations
  005-009 (12 jury, 47 admin in 006a+006b, 3 identity, 14 platform, 17 audit;
  93 total definitions counting overrides)
- **21 Edge Functions** in `supabase/functions/` (folders with `index.ts`)
- Score-aggregation logic that runs in SQL, not JS

A bug in any of those will not be caught by a Vitest unit test, no matter
how many we write. So we deliberately allocate ~30% of total tests to the
contract + integration layers, even though that layer is more expensive
per test. The economics work because **a single RLS regression in
production is more expensive than a year of CI compute**.

Conversely, we keep E2E at ~5% because:

- Each E2E covers many lines of code, so 30–40 specs already covers every
  jury and admin journey we ship.
- Playwright's marginal cost (runtime, flakiness, debugging) grows
  super-linearly past ~50 specs.
- Anything an E2E catches that a contract test could have caught belongs
  in the contract layer; we resist the temptation to "just add an E2E."

---

## 3. Per-layer specifications

### 3.1 Unit tests (Vitest, jsdom)

#### Scope — bugs only this layer catches cheaply

- Field-mapping edges in `src/shared/api/fieldMapping.js`
  (`design`↔`written`, `delivery`↔`oral`).
- Score arithmetic in pure helpers (weighted average, normalization,
  outcome attainment percentages) — same SQL math is also pinned in
  contract tests, but unit tests catch JS-side rounding and `Number`
  drift.
- Hook state machines in `src/jury/hooks/`, particularly `lastWrittenRef`
  dedup logic and step transitions.
- Component conditional rendering — locked period disables score inputs,
  pending review gate, error states.
- Form validation, regex, parsers (CSV import, ID format).

#### Tool — Vitest

Already in repo. No reason to add Jest. jsdom is sufficient for everything
short of Realtime and IntersectionObserver edge cases (those go to E2E).

#### Authoring conventions

- **Location:** colocated under `src/<area>/__tests__/`. No `tests/` mirror
  tree. Tests live next to the code they exercise so a `git mv` keeps
  them together.
- **Naming:** `<subject>.test.{js,jsx,ts,tsx}`. One subject per file. A
  hook gets its own file; a component gets its own file; do not bundle.
- **`qaTest()` is mandatory** for any test referenced in QA reporting; the
  ID must already exist in `src/test/qa-catalog.json`. Untracked tests use
  `it()` and stay out of QA dashboards on purpose.
- **Mock policy** — three rules, in order:
  1. Mock at the boundary, never inside the unit. For UI, the boundary is
     `src/shared/api/`. For hooks, the boundary is the API module they
     import.
  2. **Never mock `fieldMapping.js`** — its whole job is the boundary
     translation, so mocking it makes the test prove nothing.
  3. **`supabaseClient` is always mocked at the unit layer**, per
     existing convention:
     `vi.mock("../../lib/supabaseClient", () => ({ supabase: {} }))`.
     A unit test that touches the real Supabase client is misclassified
     and belongs in integration.
- **Fixtures** — composed from `src/test/factories/` (`buildProject`,
  `buildJuror`, `buildPeriod`, …). Inline literals are allowed for the
  one or two fields under test; everything else comes from a factory so
  schema changes propagate.
- **Time** — `vi.useFakeTimers()` for any code that reads `Date.now()` or
  schedules a debounce. Real time in unit tests is a flake source.

#### CI gating

- **Hard fail** on any failure.
- **Hard fail** if line coverage on `src/shared/api/`, `src/shared/lib/`,
  and `src/jury/hooks/` drops below the per-folder threshold (§ 5).
- **Soft report** on global coverage; we do not gate the build on a global
  number because it incentivizes testing trivial getters.

#### Examples of bugs only unit tests catch

- `fieldMapping.toDb({ design: 80 })` returning `{ written: 80, design: 80 }`
  (field duplicated, not renamed).
- `useJuryAutosave` firing two writes for the same group when a blur and
  a visibilitychange land in the same tick.
- A period-locked `<ScoreInput>` rendering as enabled because the
  `disabled` prop was destructured but not forwarded.

---

### 3.2 Integration tests (Vitest, real Postgres)

> **VERA decision (2026-04-26): this layer is permanently absent.** The
> sections below remain for architectural reference and completeness, but
> no `vera-test` Supabase project will be provisioned and no Vitest
> `integration` project will be added. Cost + maintenance + CI secret
> surface exceed the marginal value for VERA's risk profile. Equivalent
> guarantees redirect as follows:
>
> | Spec demand | VERA replacement |
> |---|---|
> | RPC wire shape against real DB | pgTAP RPC contract files (§ 3.4) — 89/89 target |
> | RLS behavior against real DB | pgTAP RLS isolation files (§ 3.3) — 28/28 target |
> | Hook composing multiple RPCs | E2E real-DB spec, pattern from `e2e/admin/unlock-request.spec.ts` |
> | Trigger interleaving | pgTAP trigger files + Periods § 4 dual-layer pattern |
> | Frontend ↔ backend drift | `src/types/db.generated.ts` + CI diff gate (drift sentinel #1) |
>
> The ~50 wrapper tests in `src/shared/api/__tests__/` stay as
> mock-supabase unit tests — their job is to catch caller-side wiring bugs
> (wrong arg name, wrong return-field destructure). Tautology subset
> (mock returns X, test asserts X) is treated under § 6 anti-pattern #1.
>
> See `docs/superpowers/plans/test-reclassification/test-reclassification-plan.md`
> § 0a for the full reasoning. The remainder of this section describes
> what an integration layer **would** look like in a project that adopted
> it; VERA does not.

~~This is the layer most React projects skip. VERA needs it.~~ (Superseded
by the decision above.)

#### Why VERA specifically needs an integration layer

The seam between `src/shared/api/` and Postgres is dense: 64 RPCs, ~30 of
which take JSON arguments and return shaped rows. A unit test cannot tell
whether `rpc_admin_save_scores` actually accepts the payload our hook
sends; it can only tell whether the hook *thinks* it does. Catching that
in E2E is too expensive; mocking it in unit tests is the bug.

We also will not use MSW for this. MSW lets us pretend an RPC behaves a
certain way; it cannot tell us whether RLS, triggers, and constraints
behave that way. For tenant-isolation-grade correctness, fakes are
disqualified.

#### Scope

- Each `src/shared/api/` function is exercised at least once against a
  real test database, with realistic auth context.
- RLS edge cases that are awkward to express in pgTAP (e.g. "after this
  RPC fires, this view returns rows for caller A but not caller B").
- Trigger behavior: audit log rows actually appear, `updated_at`
  actually advances, score-edit requests transition state.
- Realtime subscription wiring (the Postgres side — payload shape and
  publication membership; the client subscriber stays in E2E).

#### Tool — Vitest with a `integration` project

We extend the existing Vitest config with a second project:

```ts
// vitest.config.ts (excerpt)
export default defineConfig({
  test: {
    projects: [
      { name: "unit",        environment: "jsdom",
        include: ["src/**/__tests__/**/*.test.{js,jsx,ts,tsx}"],
        exclude: ["src/**/__tests__/integration/**"] },
      { name: "integration", environment: "node",
        include: ["src/**/__tests__/integration/**/*.test.{ts,tsx}"],
        setupFiles: ["src/test/integration/setup.ts"],
        testTimeout: 15_000,
        pool: "forks", poolOptions: { forks: { singleFork: true } } },
    ],
  },
});
```

Single-fork is intentional: schema-level state (e.g. an inserted period)
is shared, and parallel forks against one DB cause non-determinism that
masquerades as flakiness. Parallelism is expressed via *separate Supabase
projects* in CI, not via parallel forks against one project.

#### Where the database comes from

A dedicated **`vera-test` Supabase project**, distinct from `vera-prod`
and `vera-demo`. It is reset to a known state by applying migrations
`001` → `009` plus a slim seed that:

- creates two tenant orgs (`tenant-a`, `tenant-b`),
- one super-admin, one admin per tenant, two jurors per tenant,
- one open period and one locked period per tenant,
- a handful of projects, criteria, outcomes, and existing scores.

The seed is **not** `sql/seeds/demo_seed.sql` — that one is the
demo-app seed, which contains UI-friendly fluff. The integration seed
(`sql/seeds/integration_seed.sql`) is small, deterministic, and has
known IDs hard-coded so assertions can use them directly.

CI resets the test DB per workflow run via `apply_migration` MCP calls
or the equivalent shell script. Local runs reset on demand:
`npm run test:integration:reset`.

#### Authoring conventions

- **Location:** `src/<area>/__tests__/integration/<subject>.test.ts`.
  Integration tests live next to unit tests but in an `integration/`
  subfolder so the unit project excludes them cleanly.
- **No mocks of Supabase.** If a test needs to mock Supabase, it is a
  unit test, full stop.
- **Auth helpers:**
  `src/test/integration/asAdmin(tenantSlug)` and `asJuror(token)` return
  a Supabase client signed in as the named role. Tests never construct
  JWTs themselves.
- **State isolation:** every test starts a transaction (`BEGIN`) via a
  helper RPC and rolls back in `afterEach`. Tests that need to verify
  triggers or audit log writes (which read in a separate transaction)
  use a dedicated `withCleanup()` helper that records inserted IDs and
  deletes them in `afterEach` instead.
- **Fixtures:** rely on the seed for read-mostly scenarios. For
  write-heavy scenarios, factories produce *valid-by-construction*
  inserts via a helper RPC `_test_insert_project(jsonb)`, defined in
  `sql/migrations/000_dev_teardown.sql` guarded by
  `current_setting('app.env') = 'test'`.

#### CI gating

- **Hard fail** on any failure.
- Runs in a CI job parallel to unit tests but on a dedicated
  `integration` matrix entry, because it needs the test Supabase
  project URL + service-role key as secrets.
- Skipped on draft PRs older than 30 minutes (cost control); always run
  on merge to `main`.

#### Examples of bugs only integration catches

- `rpc_admin_create_period` claims to return `{ id, slug }` but actually
  returns `{ id, name }` because someone renamed the column without
  updating the wrapper.
- A trigger that should mark `audit_log.subject_id` populates the wrong
  column under a NULL edge case.
- The `score_summary` view double-counts a juror who scored a project
  twice across re-runs.

---

### 3.3 Contract tests — RLS matrix (pgTAP)

#### Scope

Tenant isolation is a property of the **database**. We pin it at the
database. The matrix dimensions:

```
roles      = { anon, juror_a, juror_b, admin_a, admin_b, super_admin }
tables     = every table with RLS enabled
operations = { SELECT, INSERT, UPDATE, DELETE }
tenants    = { tenant_a, tenant_b }
```

Total cells = roles × tables × operations × tenants. Most cells are
"forbidden"; the test asserts that the operation either fails or returns
zero rows. The few "allowed" cells assert the correct row count.

#### File layout

```
sql/tests/rls/
  _bootstrap.sql              -- creates two tenants + role-impersonation helpers
  organizations_isolation.sql
  memberships_isolation.sql
  periods_isolation.sql
  projects_isolation.sql
  jurors_isolation.sql
  scores_isolation.sql
  entry_tokens_isolation.sql
  audit_logs_isolation.sql
  frameworks_isolation.sql
  public_select.sql           -- explicitly enumerate what `anon` can read
```

One file per protected table. Filename suffix `_isolation.sql` is the
contract: every protected table must own exactly one such file.

#### Authoring pattern (canonical)

```sql
-- sql/tests/rls/projects_isolation.sql
BEGIN;
SELECT plan(8);

-- Setup: pgtap_test.* helpers are already loaded via sql/tests/_helpers.sql
-- (see § 8 appendix). Seed orgs + admins for this test transaction:
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();
SELECT pgtap_test.seed_projects();  -- 3 projects per period

-- 1. Admin A sees only tenant_a projects
SELECT pgtap_test.become_a();
SELECT results_eq(
  $$SELECT count(*)::int FROM projects$$,
  $$VALUES (3)$$,
  'admin_a sees exactly 3 tenant_a projects'
);

-- 2. Admin A cannot SELECT tenant_b projects (zero rows, NOT an error)
SELECT is(
  (SELECT count(*) FROM projects
   WHERE organization_id = '22220000-0000-4000-8000-000000000002'::uuid),
  0::bigint,
  'admin_a sees zero tenant_b projects via direct table'
);

-- 3. Admin A cannot UPDATE tenant_b projects
SELECT throws_ok(
  $$UPDATE projects SET title = 'pwned'
    WHERE organization_id = '22220000-0000-4000-8000-000000000002'::uuid$$,
  '42501',
  NULL,
  'admin_a UPDATE on tenant_b is rejected'
);

-- 4. Anon cannot SELECT projects at all
SELECT pgtap_test.become_reset();
SET LOCAL role anon;
SELECT throws_ok(
  $$SELECT * FROM projects LIMIT 1$$,
  '42501',
  NULL,
  'anon cannot SELECT from projects'
);

-- ... INSERT, DELETE, become_b(), juror cells

SELECT * FROM finish();
ROLLBACK;
```

Conventions:

- Always `BEGIN ... ROLLBACK` so the file is idempotent.
- Always `SELECT plan(N)` and `SELECT * FROM finish()`.
- Use `pgtap_test.become_a()` / `become_b()` / `become_super()` /
  `become_reset()` helpers from `sql/tests/_helpers.sql`. Never
  `SET LOCAL role` ad hoc — the helpers also set `request.jwt.claims`
  to mimic Supabase Auth (see § 8 for bodies).
- Tenant UUIDs are stable constants from `seed_two_orgs()`:
  org A = `11110000-...-0001`, org B = `22220000-...-0002`. Use them as
  literals; an SQL constant function (e.g. `pgtap_test.tenant_a_id()`)
  is acceptable but not required.
- Allowed-cell assertions use `results_eq` with exact counts. Forbidden
  cells use `throws_ok` (for explicit denials) or `is(..., 0)` (for RLS
  filtering, which is silent).
- Distinguishing the two failure modes is intentional: a policy that is
  meant to *throw* but only *filters* is a real bug — it leaks the
  existence of rows via timing.

#### CI gating

- **Hard fail** on any pgTAP failure.
- **Hard fail** if a table with `ENABLE ROW LEVEL SECURITY` exists but
  has no `<table>_isolation.sql` file — enforced by a static check
  (`scripts/check-rls-tests-exist.mjs`) that diffs `pg_class` against the
  `sql/tests/rls/` directory.

---

### 3.4 Contract tests — RPC signatures (pgTAP + TS shape pin)

Two shapes need pinning, on two sides of the wire.

#### Side A: pgTAP — argument names, types, return columns

```
sql/tests/rpcs/
  jury/
    rpc_jury_submit_scores.sql
    rpc_jury_request_pin_reset.sql
    ...
  admin/
    rpc_admin_create_period.sql
    rpc_admin_lock_period.sql
    rpc_admin_save_scores.sql
    ...
  contracts/
    _signature_helpers.sql      -- has_function_args, has_function_returns
```

Canonical pattern:

```sql
-- sql/tests/rpcs/admin/rpc_admin_lock_period.sql
BEGIN;
SELECT plan(4);

-- 1. Function exists
SELECT has_function('public', 'rpc_admin_lock_period');

-- 2. Argument names + types
SELECT function_args_eq(
  'public', 'rpc_admin_lock_period',
  ARRAY['p_period_id uuid']
);

-- 3. Return shape
SELECT function_returns(
  'public', 'rpc_admin_lock_period',
  'TABLE(period_id uuid, locked_at timestamptz)'
);

-- 4. Calling as non-admin raises insufficient_privilege
SELECT _as_juror('tenant_a');
SELECT throws_ok(
  $$SELECT rpc_admin_lock_period('00000000-0000-0000-0000-000000000001')$$,
  '42501'
);

SELECT * FROM finish();
ROLLBACK;
```

One file per RPC. Filename mirrors the function name 1:1 — this is how we
catch "RPC was renamed but old contract test still passes against a stale
name."

A static check (`scripts/check-rpc-tests-exist.mjs`) lists all
`public.rpc_*` functions in `pg_proc` and ensures each has a contract
file. New RPC without a contract = build fails.

#### Side B: TypeScript — what the frontend believes

Generated types from `npx supabase gen types typescript` are committed to
`src/types/db.generated.ts`. CI step:

```bash
npx supabase gen types typescript --project-id $TEST_PROJECT_REF \
  > /tmp/db.generated.ts
diff src/types/db.generated.ts /tmp/db.generated.ts
```

A non-empty diff fails CI. This catches "DB shape changed in a migration
but generated types were not regenerated", which is the root cause of
~80% of frontend↔backend drift.

For each RPC the frontend calls, `src/shared/api/admin/*.ts` (and
`juryApi.ts`) imports the generated `Database['public']['Functions']`
types and the wrapper's argument/return types are derived from that
type, not redeclared:

```ts
type Args = Database['public']['Functions']['rpc_admin_lock_period']['Args'];
type Ret  = Database['public']['Functions']['rpc_admin_lock_period']['Returns'];

export async function lockPeriod(periodId: string): Promise<Ret> {
  const { data, error } = await supabase.rpc('rpc_admin_lock_period', {
    p_period_id: periodId,
  } satisfies Args);
  if (error) throw error;
  return data;
}
```

The `satisfies Args` cast is the load-bearing line. If the DB renames
`p_period_id` to `period_id`, generation produces a new `Args` type, and
this file fails to compile. That is the entire frontend↔backend drift
prevention story.

#### CI gating — RPC contracts

- pgTAP suite: hard fail on any failure.
- TypeScript build: hard fail (already gated).
- "Generated types match DB" diff: hard fail.

---

### 3.5 Contract tests — Edge Functions (Deno test + TS shape pin)

#### Scope

Each Edge Function gets one or more tests in
`supabase/functions/_test/`, asserting:

- Method must be POST (matches `invokeEdgeFunction.js`'s contract).
- Auth gate: missing token → 401; invalid token → 401; valid token but
  wrong role → 403.
- Success response shape matches a Zod schema co-located with the
  function in `supabase/functions/<fn>/schema.ts`.
- Error response shape matches `{ error: { code, message } }`.

#### Canonical pattern

```ts
// supabase/functions/_test/platform-metrics.test.ts
import { assertEquals } from "jsr:@std/assert";
import { z } from "https://deno.land/x/zod/mod.ts";
import { harness } from "./harness.ts";
import { ResponseSchema } from "../platform-metrics/schema.ts";

Deno.test("platform-metrics: rejects GET", async () => {
  const res = await harness.invoke("platform-metrics", { method: "GET" });
  assertEquals(res.status, 405);
});

Deno.test("platform-metrics: rejects unauthenticated POST", async () => {
  const res = await harness.invoke("platform-metrics", { method: "POST" });
  assertEquals(res.status, 401);
});

Deno.test("platform-metrics: super-admin success returns valid shape", async () => {
  const res = await harness.invokeAs("super_admin", "platform-metrics", {
    method: "POST",
    body: {},
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  ResponseSchema.parse(body); // throws on shape mismatch
});

Deno.test("platform-metrics: tenant admin gets 403", async () => {
  const res = await harness.invokeAs("admin_a", "platform-metrics", {
    method: "POST",
    body: {},
  });
  assertEquals(res.status, 403);
});
```

#### Shape pin on the frontend side

`src/shared/api/core/invokeEdgeFunction.js` is wrapped by a typed helper:

```ts
import type { z } from 'zod';

export async function invokeEdge<T extends z.ZodTypeAny>(
  fn: string,
  body: unknown,
  schema: T,
): Promise<z.infer<T>> {
  const raw = await invokeEdgeFunction(fn, body); // existing JS
  return schema.parse(raw);
}
```

The frontend imports the *same* `schema.ts` from the Edge Function
folder. One source of truth; mismatch = compile or runtime failure on
the very next call.

#### CI gating

- Hard fail on Deno test failures.
- Hard fail if any Edge Function lacks a `schema.ts` and a matching test
  file (static check: every `supabase/functions/<fn>/index.ts` has a
  sibling `schema.ts` and an `_test/<fn>.test.ts`).

---

### 3.6 E2E tests (Playwright)

#### Which journeys deserve E2E

Only journeys that span **at least three of**: auth, RPC, RLS, Realtime,
Edge Function, autosave, browser storage. Anything narrower is pushed
down.

The canonical E2E set, capped at ~40 specs, covers:

**Jury (must-have, single-event-day risk):**

- Entry-token redemption → identity → period → PIN → progress → evaluate →
  submit → done. The full happy path, on at least Chromium and one mobile
  viewport.
- Group navigation autosave: type, blur, navigate, refresh — values
  persist.
- Reconnect after offline: kill network, type, restore network, blur —
  values reach DB.
- Locked-period: locked period blocks score submission with the correct
  error.
- Wrong tenant: a juror's token from tenant A cannot reach tenant B's
  evaluate page even via direct URL.

**Admin (must-have):**

- Email/password login + remember-me persistence across browser restart.
- Google OAuth callback → complete-profile → tenant membership pending →
  approval → access.
- Period lifecycle: create, open, lock; locked period disables score
  edits in UI.
- Score-edit request: request, approve, reflected in admin grid.
- Tenant application → super-admin approval → admin invite acceptance →
  first login.
- Realtime: two admin tabs open; juror submits a score; both tabs reflect
  it.

**Cross-cutting (must-have):**

- Tenant cross-pollination smoke: opening tenant A admin in one context
  and tenant B in another, with overlapping IDs, never leaks UI rows
  across tabs.
- Maintenance mode: super-admin enables, all non-super admins are blocked
  with the maintenance screen, super-admin still in.

**Explicitly NOT E2E** (pushed down):

- Field validation regex, date picker logic, CSV row parsing — unit.
- Score arithmetic correctness — pgTAP + integration. E2E may smoke a
  single weighted-average value but is not the authority.
- RLS isolation per table — pgTAP, never E2E.
- Edge Function shape — Deno, never E2E.

#### Fixture strategy

E2E uses a **dedicated `vera-e2e` Supabase project** (or the existing
`vera-demo` if cost is the constraint, with a clear "do not hand-edit"
policy). The project is reset to a known state by:

1. Applying migrations `001`→`009`.
2. Running `sql/seeds/e2e_seed.sql` — distinct from
   `integration_seed.sql` because E2E needs UI-realistic volumes (10+
   projects, 5+ jurors per tenant) to exercise pagination, scrolling,
   and Realtime debouncing.

Per-test setup is **append-only**: tests insert what they need with
unique IDs (`test-${workerIndex}-${randomUUID()}`) and a
`afterEach` cleanup deletes by that prefix. We do *not* truncate
between tests — that serializes the suite and balloons runtime.

#### Data isolation between parallel workers

- Playwright workers are partitioned by `workerIndex`. Each worker uses
  a **dedicated tenant slug** (`e2e-tenant-${workerIndex}`) seeded once.
- Cross-tenant tests run in their own non-parallel project
  (`projects: [{ name: "isolation", workers: 1 }]` in
  `playwright.config.ts`).

#### Auth strategy

- Per-role storage states are pre-built in `e2e/fixtures/auth/` via a
  `globalSetup` that logs in once per role (super-admin, admin-a,
  admin-b, juror-a, juror-b) and saves each `storageState`.
- Tests load `storageState` rather than re-doing login. Tests *of* login
  flows are explicit and do not use the saved state.

#### CI gating

- Hard fail on any spec failure.
- Hard fail on any new `test.skip` or `test.fixme` introduced in the PR
  (lint rule); skipping must be a deliberate, reviewed action documented
  in `docs/qa/e2e-security-skip-audit.md` (the existing pattern).
- Soft report on visual diffs and axe violations (see § 3.7).

#### Examples of bugs only E2E catches

- Jury autosave silently dropping the last group's writes because
  `visibilitychange` fires after the page has already navigated.
- Realtime subscription not subscribing to the right channel after a
  Supabase Auth refresh, so admin tabs go stale.
- Maintenance mode banner rendering but a backdoor route still loading
  data because the gate was on the layout, not the route.

---

### 3.7 Visual and accessibility tests

Distinct sub-layer of E2E with different gating.

- Tooling already in repo: `@axe-core/playwright`,
  Playwright screenshot comparisons.
- **Scope:** axe scan on every page once per PR; visual diff on a
  curated set of "design-stable" screens (landing, login, admin
  overview, jury identity, score grid).
- **Authoring:** `e2e/a11y/<page>.spec.ts` and `e2e/visual/<page>.spec.ts`.
- **Gating:**
  - axe **serious / critical** violations: hard fail.
  - axe **moderate / minor**: report only.
  - Visual diffs: report only by default; promoted to hard fail per
    screen via an explicit allowlist in `playwright.config.ts` so visual
    flakes do not block unrelated PRs.

---

## 4. What does NOT need testing

Tests are not free. Each test is code we maintain forever. The following
are net-negative and contributors should refuse to write them.

| Area | Why not |
|---|---|
| Lucide icon rendering | Third-party. We do not own correctness. |
| `react-router-dom` route resolution itself | Library. Test our guards instead. |
| `@base-ui/react` primitives | Library. Test our composed components. |
| Trivial getters / 1-line wrappers | The test reproduces the implementation. |
| `src/types/db.generated.ts` | Generated; the diff check is the test. |
| Tailwind/CSS class names in JSX | Brittle and subjective; visual tests cover what matters. |
| Supabase Auth's session refresh internals | SDK. We test our reaction to expiry. |
| Google OAuth provider redirect | We do not control Google. We test our callback handler. |
| `react-window` virtualization math | Library. We test our row renderer. |
| `recharts` SVG output | Library. We test our data transform. |
| `xlsx-js-style` cell encoding | Library. We test our row builder. |
| Specific colors, spacings, font sizes | Design system tokens; covered by visual diff if at all. |
| `console.warn` / dev-mode warnings | Not a contract. |
| 404 / catch-all rendering an empty page | One unit test for the redirect, then nothing. |

If a test would only fail because we rewrote an internal helper without
behavior change, that test is wrong by definition. Delete it.

---

## 5. Success metrics

The architecture is "working" iff the following hold simultaneously:

### 5.1 Coverage thresholds (per layer, per folder)

| Folder | Layer responsible | Line coverage floor |
|---|---|---|
| `src/shared/api/` | unit + integration | 90% |
| `src/shared/lib/` | unit | 85% |
| `src/jury/hooks/` | unit + E2E | 90% |
| `src/jury/useJuryState.js` | unit + E2E | 95% |
| `src/admin/hooks/` | unit + integration | 80% |
| `src/shared/storage/` | unit | 90% (Safari private mode branches) |
| `src/admin/pages/`, `src/jury/`, `src/landing/` (UI) | E2E + visual | not gated by coverage |
| `sql/migrations/00[5-9]*.sql` (RPCs) | pgTAP + integration | 100% of RPCs have a contract file |
| `sql/migrations/004_rls.sql` | pgTAP | 100% of RLS-enabled tables have an isolation file |
| `supabase/functions/*/index.ts` | Deno + integration | 100% have schema + test file |

A coverage drop in a gated folder fails the PR. A drop in non-gated
folders is reported but does not gate.

### 5.2 Mutation testing — targeted, not blanket

Mutation testing is expensive; we only run it where false positives are
catastrophic:

- `src/shared/api/fieldMapping.js`
- Any TypeScript helper that computes a weighted score, normalization,
  or outcome attainment percentage (in `src/shared/lib/scoring/` once
  consolidated)
- SQL helper functions in `sql/migrations/003_helpers_and_triggers.sql`
  that participate in score aggregation (run via pg_mutate or a custom
  script)

Target mutation score on those files: **≥ 80%**, run weekly, report-only
on PR but tracked on a dashboard.

### 5.3 Flakiness budget

- **Unit / integration / pgTAP / Deno:** zero flakes tolerated. A flaky
  test is a bug in the test; quarantine within 24h, fix or delete within
  one week. Quarantine bucket: `_pending/` (matching the existing
  pgTAP quarantine convention).
- **E2E:** ≤ 1% spec-level flake rate over a rolling 30 days, measured
  by Playwright retries-that-passed. Budget breach freezes new E2E specs
  until burned down.

### 5.4 CI runtime budget

| Layer | Budget |
|---|---|
| Unit | ≤ 90s |
| Integration | ≤ 4 min |
| pgTAP (RLS + RPC contracts) | ≤ 2 min |
| Deno (Edge Functions) | ≤ 1 min |
| E2E (default Chromium project) | ≤ 5 min sharded |
| Visual + a11y | runs in parallel with E2E, budgeted against E2E shard |
| **Total wall clock** | **≤ 12 min** |

Anything slower is split across shards, moved to nightly, or rejected.
"Adding two more E2E specs" is fine; "adding two more E2E specs that
each take 90s" is not.

### 5.5 Drift sentinels

Three properties are checked on every PR; failures gate merge:

1. Generated DB types match the test DB (§ 3.4).
2. Every public RPC has a pgTAP contract file.
3. Every RLS-enabled table has an isolation file.
4. Every Edge Function has a schema + test.

These are simple `scripts/check-*.mjs` files. They run in <2s combined.

---

## 6. Anti-patterns to avoid

Specific to this stack and this codebase. Reviewers should reject PRs
that do these.

1. **Mocking RLS.** Any unit test that mocks `supabase.rpc` to "return
   tenant A data" is fine *as a unit test*, but treating it as proof of
   isolation is the bug. Isolation lives in pgTAP.

2. **Asserting RLS behavior in E2E.** "We verified juror_a cannot see
   tenant_b" via Playwright is an expensive smoke test, not a proof.
   The proof belongs in
   `sql/tests/rls/<table>_isolation.sql`. E2E gets one cross-tenant
   smoke spec and stops.

3. **`supabase.auth.signInWithPassword` inside a test body.** Logins
   happen once in `globalSetup` (E2E) or via SQL claims helpers
   (integration / pgTAP). In-test logins serialize the suite and
   produce auth-rate-limit flakes.

4. **Truncating tables between tests.** Forces single-worker execution.
   Use prefix-based cleanup or transactional rollback instead.

5. **`vi.mock("react")`, `vi.mock("react-router-dom")`, or any framework
   global mock.** The mock is virtually always wrong and the bug it hides
   is virtually always real.

6. **One mega `setup.js` that mocks every module.** Each test should
   declare its own mocks. Shared mocks live in `src/test/helpers/` as
   *factories* that the test calls, not as auto-applied side effects.

7. **Snapshot-testing JSX trees.** A snapshot of a component is a snapshot
   of the implementation. Snapshots are acceptable for the exact wire
   shape of an RPC response, where the shape *is* the contract.

8. **Adding a test "for coverage."** Coverage is an outcome, not a goal.
   If the test does not catch a class of bug listed in this document,
   delete it.

9. **Running the demo seed against the test DB.** The demo seed is for
   demos; it has UI fluff. Use `integration_seed.sql` or `e2e_seed.sql`.
   Crossing the streams produces flakes that look like real bugs.

10. **`expect(..).toBeTruthy()` on Supabase responses.** Always assert
    on the exact shape (or use a Zod parse). Truthy assertions silently
    pass when an RPC returns `{ error: ... }`.

11. **Skipping pgTAP because "it'd be caught in E2E."** It would be, four
    minutes later, on one row of one table, after twelve other tests
    failed for unrelated reasons. Catch it in 200ms in pgTAP.

12. **Adding a new tool.** We have Vitest, Playwright, pgTAP, Deno test,
    axe. Anything else needs a written justification that explains why
    one of those five cannot do the job.

---

## 7. Glossary — test type ↔ folder convention

| Layer | Tool | Folder | File pattern | Run command |
|---|---|---|---|---|
| Unit (component) | Vitest jsdom | `src/<area>/__tests__/` | `<Component>.test.{jsx,tsx}` | `npm test -- --run --project=unit` |
| Unit (hook) | Vitest jsdom | `src/<area>/__tests__/` | `use<Name>.test.{js,ts}` | same |
| Unit (pure logic) | Vitest node | `src/<area>/__tests__/` | `<helper>.test.{js,ts}` | same |
| Integration | Vitest node + real DB | `src/<area>/__tests__/integration/` | `<feature>.test.ts` | `npm test -- --run --project=integration` |
| Contract — RLS | pgTAP | `sql/tests/rls/` | `<table>_isolation.sql` | `npm run test:sql:rls` |
| Contract — RPC | pgTAP | `sql/tests/rpcs/{jury,admin,contracts}/` | `<rpc_name>.sql` | `npm run test:sql:rpcs` |
| Contract — DB types | TS compiler + diff | `src/types/db.generated.ts` | n/a | `npm run check:db-types` |
| Contract — Edge Function | Deno test | `supabase/functions/_test/` | `<fn>.test.ts` | `npm run test:edge` |
| Contract — Edge schema | Zod (shared) | `supabase/functions/<fn>/schema.ts` | n/a | imported by both sides |
| E2E — admin | Playwright | `e2e/admin/` | `<feature>.spec.ts` | `npm run e2e -- --project=admin` |
| E2E — jury | Playwright | `e2e/jury/` | `<feature>.spec.ts` | `npm run e2e -- --project=jury` |
| E2E — auth | Playwright | `e2e/auth/` | `<flow>.spec.ts` | `npm run e2e -- --project=auth` |
| E2E — security / cross-tenant | Playwright (1 worker) | `e2e/security/` | `<scenario>.spec.ts` | `npm run e2e -- --project=security` |
| Visual | Playwright screenshot | `e2e/visual/` | `<screen>.spec.ts` | `npm run e2e -- --project=visual` |
| A11y | Playwright + axe | `e2e/a11y/` | `<page>.spec.ts` | `npm run e2e -- --project=a11y` |
| QA-tracked | Vitest via `qaTest()` | anywhere | catalog ID required | indexed by `qa-catalog.json` |
| Quarantined | n/a | `_pending/` mirror under any test root | original filename | excluded from CI |

---

## 8. Appendix — minimal seed shapes

For reproducibility, the integration and E2E seeds expose **stable
hard-coded UUIDs** so test bodies can use them directly.

`sql/seeds/integration_seed.sql` shape (illustrative IDs):

```
organizations
  11111111-...-1111  tenant_a   slug=tenant-a
  22222222-...-2222  tenant_b   slug=tenant-b

memberships
  super_admin → organization_id IS NULL
  admin_a     → tenant_a
  admin_b     → tenant_b
  juror_a1, juror_a2 → tenant_a
  juror_b1, juror_b2 → tenant_b

periods
  aaaaaaaa-...-aaaa  tenant_a / open
  aaaaaaaa-...-bbbb  tenant_a / locked
  bbbbbbbb-...-aaaa  tenant_b / open

projects
  3 per period, deterministic IDs

scores
  juror_a1 has scored project[0] in open period (one full sheet)
```

`sql/seeds/e2e_seed.sql` is the same shape but with realistic volume
(≥10 projects/period, ≥5 jurors/tenant, mixed completion states).

**Helpers already exist** at `sql/tests/_helpers.sql` under namespace
`pgtap_test.*`. They are idempotent (`CREATE OR REPLACE`) and installed
once per test database. Test files do **not** redefine them — they call
the existing functions.

The load-bearing helper is `pgtap_test.become(p_user_id uuid)` — every
role-shortcut delegates to it:

```sql
CREATE OR REPLACE FUNCTION pgtap_test.become(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format(
    'SET LOCAL request.jwt.claims = %L',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text
  );
  SET LOCAL role authenticated;
END;
$$;

CREATE OR REPLACE FUNCTION pgtap_test.become_a() RETURNS void LANGUAGE sql AS $$
  SELECT pgtap_test.become('aaaa0000-0000-4000-8000-000000000001'::uuid);
$$;

CREATE OR REPLACE FUNCTION pgtap_test.become_b() RETURNS void LANGUAGE sql AS $$
  SELECT pgtap_test.become('bbbb0000-0000-4000-8000-000000000002'::uuid);
$$;

CREATE OR REPLACE FUNCTION pgtap_test.become_super() RETURNS void LANGUAGE sql AS $$
  SELECT pgtap_test.become('eeee0000-0000-4000-8000-00000000000e'::uuid);
$$;

CREATE OR REPLACE FUNCTION pgtap_test.become_reset()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RESET role;
  RESET request.jwt.claims;
END;
$$;
```

**Anon impersonation:** the existing helper file does NOT yet expose a
`become_anon()`. For now, drop back via `become_reset()` then
`SET LOCAL role anon` directly (one-line idiom shown in § 3.3 example).
Adding a `pgtap_test.become_anon()` wrapper to `_helpers.sql` is a
welcome small contribution — keep the same `RESET role; RESET request.jwt.claims;`
exit pattern.

**Juror impersonation:** jurors do not have `auth.users` rows; they
authenticate via `rpc_jury_authenticate(entry_token, juror_no, pin)`
which sets a session token. For pgTAP isolation tests the relevant
authenticated calls are admin/super-admin; juror-side scoring is
covered by `sql/tests/rpcs/jury/*.sql` contracts plus E2E.

**Stable UUIDs** (from `seed_two_orgs()`, do not redefine):

| Role / org | UUID |
|---|---|
| admin_a (auth.users) | `aaaa0000-0000-4000-8000-000000000001` |
| admin_b (auth.users) | `bbbb0000-0000-4000-8000-000000000002` |
| super_admin (auth.users) | `eeee0000-0000-4000-8000-00000000000e` |
| organization_a | `11110000-0000-4000-8000-000000000001` |
| organization_b | `22220000-0000-4000-8000-000000000002` |
| period_a (open) | `cccc0000-0000-4000-8000-000000000001` |
| period_a_locked | `cccc0000-0000-4000-8000-000000000011` |
| period_b (open) | `dddd0000-0000-4000-8000-000000000002` |
| period_b_locked | `dddd0000-0000-4000-8000-000000000022` |

These rows use a `pgtap_` prefix on text fields so they are obviously
test-only and easy to clean up if a `BEGIN ... ROLLBACK` envelope is
broken. The fixture is keyed by deterministic UUIDs, not random ones,
so assertions can use literals directly.

**Scope guard:** `pgtap_test.*` is a separate schema. It is never
referenced by application code and must never be granted to roles other
than `authenticated`. Do not move these helpers into `public` or
`auth`, and do not extend them with anything that bypasses RLS — the
helper layer's job is to *impersonate* roles, not to *escape* them.

---

## 9. Closing — how to use this document

- **New feature?** Decide which layer owns each property of the feature
  before writing code. Write the contract test first when the property
  is access control or a wire shape; write the unit test first when the
  property is logic.
- **New bug?** Locate the layer that *should* have caught it. If no
  layer would have, this document is wrong; open a PR to update it
  rather than retrofitting an ad hoc test.
- **New tool proposal?** Justify against § 6 anti-pattern #12.
- **New "skip"?** Justify in `docs/qa/e2e-security-skip-audit.md`-style
  audit and link from the PR.

The architecture is correct when a contributor can read § 7 and know,
within five seconds and without asking, where their next test goes.
