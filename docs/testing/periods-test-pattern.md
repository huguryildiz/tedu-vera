# Periods — Reference Test Pattern

> _Last updated: 2026-04-28_

Periods is the worked example for an admin feature with the broadest
risk surface in VERA. New admin features (Jurors, Projects, Criteria,
Outcomes, Settings, Reviews) should copy this shape rather than
re-invent it.

**Companion spec:** [target-test-architecture.md](target-test-architecture.md).
Where this doc and the architecture spec disagree, the architecture
spec wins.

**Audience:** anyone adding tests to an admin feature. Read once
end-to-end, then use as a quick lookup.

---

## 1. Why Periods is the reference

Periods is not the weakest admin page; it has the broadest *risk*
surface. The test pattern fits any admin feature that needs:

- **Tenant isolation across multiple tables** — Periods touches
  `periods`, `period_criteria`, `period_outcomes`,
  `period_criterion_outcome_maps`, and `unlock_requests`.
- **Lifecycle transitions guarded by RPC + trigger** — Draft → Live →
  Published → Closed.
- **Realtime delivery to other admin tabs** — when one admin publishes
  a period, every other open admin tab must reflect it without manual
  refresh.
- **A super-admin-only path** that some other role might attempt.
- **An Edge Function in the workflow** — `notify-unlock-request`.

If your feature has fewer of those properties, **delete the
corresponding test layer** rather than stub it for symmetry.
Coverage-for-coverage tests are forbidden by
[target-test-architecture.md](target-test-architecture.md) §6.

---

## 2. The dual-layer security pattern (canonical)

VERA enforces period-lock immutability on **two independent layers**,
and every period-lock-related test must exercise BOTH layers
separately. This is the most distinctive pattern other admin features
should copy whenever they have a state machine with a "frozen"
terminal state.

### Layer 1 — Row Level Security policies

Defined in [`sql/migrations/004_rls.sql`](../../sql/migrations/004_rls.sql):

```
period_criteria_select   — JOIN to periods.organization_id
period_criteria_insert   — same scope; tenant must own the period
period_outcomes_*        — same shape
```

These policies *filter* (silent 0-row) and *block with WITH CHECK*
(`42501`).

Pinned by:

- [`sql/tests/rls/period_criteria_isolation.sql`](../../sql/tests/rls/period_criteria_isolation.sql)
- [`sql/tests/rls/period_outcomes_isolation.sql`](../../sql/tests/rls/period_outcomes_isolation.sql)
- [`sql/tests/rls/periods_isolation.sql`](../../sql/tests/rls/periods_isolation.sql)
- [`sql/tests/rls/unlock_requests_isolation.sql`](../../sql/tests/rls/unlock_requests_isolation.sql)

### Layer 2 — Postgres triggers

Defined in [`sql/migrations/003_helpers_and_triggers.sql`](../../sql/migrations/003_helpers_and_triggers.sql):

```
_assert_period_unlocked()                 — central guard, raises 'period_locked'
trigger_block_period_child_on_locked()    — used by 3 child tables
trigger_block_projects_on_locked_period   — projects
trigger_block_jurors_on_locked_period     — jurors
trigger_block_periods_on_locked_mutate    — periods (super-admin escape hatch)
```

Triggers run via `SECURITY DEFINER` regardless of caller role. That is
the whole point of the second layer: even a `SECURITY DEFINER` admin
RPC that bypasses RLS still hits the trigger when it tries to insert
into a locked-period child relation.

Pinned by:

- [`sql/tests/triggers/period_lock.sql`](../../sql/tests/triggers/period_lock.sql)

### Why test BOTH layers separately

A regression in **either** layer alone keeps the system "safe enough"
via the other layer — and so the bug ships unnoticed. Two independent
failure points need two independent assertion paths:

| Regression scenario | RLS test fires | Trigger test fires |
|---|---|---|
| RLS policy dropped on `period_criteria` | ✅ catches | ❌ trigger still blocks, "passes" |
| `_assert_period_unlocked` made no-op | ❌ RLS still filters reads, "passes" | ✅ catches |
| Both regress | ✅ ✅ | both fail loudly |

### How to apply this pattern to a new feature

Any feature with a "freeze" terminal state (closed periods, archived
projects, locked jurors) should mirror the structure:

1. **RLS policy** on the table — pinned in
   `sql/tests/rls/<table>_isolation.sql`.
2. A `BEFORE INSERT/UPDATE/DELETE` **trigger** that calls a central
   `_assert_<state>_<verb>()` guard helper.
3. A focused **trigger test file** in
   `sql/tests/triggers/<feature>_lock.sql` that exercises EACH child
   relation independently and asserts both the negative branch (raise)
   and the positive escape-hatch branch (super-admin or whatever the
   architectural escape is).

---

## 3. The Realtime testing pattern (canonical)

[target-test-architecture.md](target-test-architecture.md) §3.6 lists
Realtime as one of the few mandatory E2E journey types, and §6
anti-pattern #2 forbids using E2E for anything testable in a lower
layer. So Realtime gets exactly **one E2E spec per admin surface**,
following a strict two-context shape.

### Reference spec: [`e2e/admin/periods-realtime.spec.ts`](../../e2e/admin/periods-realtime.spec.ts)

```
Context A — admin signs in via LoginPom.signIn(), navigates to
            /admin/periods, observes the seeded Draft period in the table.

[ Tab A is now subscribed to the periods Realtime channel through the
  page's existing live-updates wiring. The page is doing the work; the
  test is just observing. ]

Context B — service-role adminClient calls rpc_admin_publish_period()
            on the same period. The publish is a real production-shaped
            mutation, not a direct UPDATE.

Context A — within 15s, expect the row's status pill to re-render as
            "Published" with NO manual refresh.
```

### Why this exact shape

1. **Two contexts, not one.** A single-tab test cannot distinguish
   "the page re-rendered because of the local state update I just
   dispatched" from "the page re-rendered because Realtime delivered an
   event." Two tabs forces the assertion to be about the second path.

2. **adminClient mutation, not a fixture insert.** The shape of the
   Realtime payload is determined by the actual production write code,
   not by a hand-rolled fixture. If `rpc_admin_publish_period` ever
   stops emitting an UPDATE on `periods` (e.g. switches to a new
   `period_states` table without updating the Realtime publication),
   this test catches it. A fixture INSERT could not.

3. **No assertion that the local DB state is correct.** That is
   pgTAP's job. This test only asserts that *the UI saw the change
   without a refresh*.

4. **Cleanup unlocks before delete.** The `afterAll` flips
   `is_locked: false, closed_at: null` before deletion because the
   periods trigger blocks DELETE on a locked period (intentionally —
   see §2). Other admin features will need analogous unlock steps in
   teardown when their state machine has a frozen terminal.

### Bug classes this pattern catches

- The page's Realtime subscription not subscribing on mount.
- The Realtime publication on `periods` being dropped from migrations.
- An UPDATE handler ignoring `is_locked` transitions because of a
  stale closure over the row list (a `useEffect` dependency mistake).

### What this pattern does NOT cover

- Cross-tenant Realtime isolation — pgTAP RLS files cover that the
  subscription only delivers rows the caller can SELECT.
- Realtime publication membership — also pgTAP.
- The actual visual styling of the Published status pill — visual
  regression tests, not journey tests.

---

## 4. Layer-by-layer file inventory

The Periods feature has tests across every applicable layer. Use this
inventory to know where each kind of property is asserted.

### pgTAP

| File | What it pins |
|---|---|
| [`sql/tests/rls/periods_isolation.sql`](../../sql/tests/rls/periods_isolation.sql) | Tenant isolation on `periods` across SELECT/INSERT/UPDATE/DELETE × {anon, tenant A, tenant B, super-admin}. |
| [`sql/tests/rls/period_criteria_isolation.sql`](../../sql/tests/rls/period_criteria_isolation.sql) | JOIN-derived tenant scope (no `organization_id` column on the table). |
| [`sql/tests/rls/period_outcomes_isolation.sql`](../../sql/tests/rls/period_outcomes_isolation.sql) | Same shape as `period_criteria` — paranoid sibling pin. |
| [`sql/tests/rls/unlock_requests_isolation.sql`](../../sql/tests/rls/unlock_requests_isolation.sql) | RPC-only-write architecture; revealed a real grant gap on `unlock_requests` when first written. |
| [`sql/tests/rpcs/contracts/admin_publish_period.sql`](../../sql/tests/rpcs/contracts/admin_publish_period.sql) | Publish-readiness response shape; rejects publish when criteria/outcomes are missing. |
| [`sql/tests/rpcs/contracts/admin_resolve_unlock_request.sql`](../../sql/tests/rpcs/contracts/admin_resolve_unlock_request.sql) | The full approve/reject flow + double-resolve guard. |
| [`sql/tests/triggers/period_lock.sql`](../../sql/tests/triggers/period_lock.sql) | Dual-layer security regressions on EITHER layer. |

### Edge Function

| File | What it pins |
|---|---|
| [`supabase/functions/notify-unlock-request/schema.ts`](../../supabase/functions/notify-unlock-request/schema.ts) | Zod request + response shapes; both sides import it. |
| [`supabase/functions/notify-unlock-request/index.test.ts`](../../supabase/functions/notify-unlock-request/index.test.ts) | Auth gate + happy-path + Zod schema parse. |

### Unit (Vitest)

| File | Why it earns its place |
|---|---|
| [`useManagePeriods.lockEnforcement.test.js`](../../src/admin/features/periods/__tests__/useManagePeriods.lockEnforcement.test.js) | Real-logic hook tests, mocks at `@/shared/api` boundary. The canonical hook test pattern. |
| [`periodHelpers.test.js`](../../src/admin/features/periods/__tests__/periodHelpers.test.js) | Pure-logic state machine, no mocks. |
| `AddEditPeriodDrawer.test.jsx` | Duplicate-name validation conditional. |
| `ClosePeriodModal.test.jsx` | Type-name-to-enable button gate. |
| `DeletePeriodModal.test.jsx` | Three real conditional branches. |
| `PublishPeriodModal.test.jsx` | `onPublish` callback wiring. |
| `PeriodCells.test.jsx` | Conditional render across multiple state combos. |
| `CompletionStrip.test.jsx` | Null-on-no-metrics branch. |
| `PeriodsTable.test.jsx` | Trimmed to behavior-only assertions. |
| `PeriodsPage.test.jsx` | Trimmed to a single integration smoke. |

### E2E (Playwright)

| File | What it covers |
|---|---|
| [`e2e/admin/periods.spec.ts`](../../e2e/admin/periods.spec.ts) | CRUD + lifecycle (Create → Activate → Publish → Close). |
| [`e2e/admin/period-lifecycle.spec.ts`](../../e2e/admin/period-lifecycle.spec.ts) | Integrated lifecycle with scoring in between. |
| [`e2e/admin/periods-realtime.spec.ts`](../../e2e/admin/periods-realtime.spec.ts) | The two-context Realtime pattern (§3 above). |
| [`e2e/admin/unlock-request.spec.ts`](../../e2e/admin/unlock-request.spec.ts) | Tenant requests unlock → super-admin resolves. |

---

## 5. Why each layer was chosen

### Why pgTAP gets the bulk of the new tests

The properties under test are:

- Cross-tenant data leakage (RLS).
- Lifecycle-state immutability (triggers).
- RPC contract stability (signature, return shape, error codes).

All three are **Postgres-level** properties. They are cheap to assert
in pgTAP, expensive to assert in Playwright, and impossible to assert
in Vitest (whose Supabase client is mocked). pgTAP is the only place
RLS / triggers / RPC contracts run real.

### Why VERA does not have an integration layer

VERA has no Vitest-against-real-Postgres layer. The properties an
integration layer would catch are split between pgTAP (data layer) and
E2E (app-layer flows). Adding a third layer would duplicate coverage
without adding distinct catches.

### Why the unit layer was trimmed, not expanded

Unit tests catch:

- Pure-function bugs (`periodHelpers.js`).
- Hook state-machine bugs (`useManagePeriods.lockEnforcement.test.js`).
- Component conditional render bugs (drawers, modals).

Unit tests **cannot** catch tenant-isolation, RLS, trigger, or
production-RPC-contract bugs. So the unit suite stays focused on
in-jsdom logic and structural component behavior — never on mocked
"the RPC was called" tautologies. See
[page-test-mock-audit.md](page-test-mock-audit.md).

### Why the E2E set is small

Each E2E spec is expensive to maintain (selectors, timing, fixtures).
E2E earns its place only when the property under test cannot be
asserted at a lower layer:

- **Realtime delivery** — the only test that has to observe the
  rendered DOM in tab A after a write in tab B.
- **Lifecycle integration** — the only place where Create →
  Activate → Publish → Close is exercised against the real RPC chain.
- **Unlock-request flow** — tenant + super-admin contexts running
  against a real DB.

Tab assertions like "the periods table renders 5 rows" are smoke;
silent regressions there are caught by the unit + pgTAP suites. The
E2E periods spec deliberately does not duplicate those.

---

## 6. Quick reference — files to copy from for a new admin feature

Order matters: pgTAP first, Edge Function second, unit third, E2E
last. Working in this order means each upper layer rests on a verified
lower layer.

1. **pgTAP RLS:** copy
   [`sql/tests/rls/periods_isolation.sql`](../../sql/tests/rls/periods_isolation.sql)
   — covers anon, tenant-A, tenant-B, super-admin ×
   SELECT/INSERT/UPDATE/DELETE matrix with the temp-table-row-count
   idiom for silent UPDATE/DELETE filtering.
2. **pgTAP RPC contract:** copy
   [`sql/tests/rpcs/contracts/admin_resolve_unlock_request.sql`](../../sql/tests/rpcs/contracts/admin_resolve_unlock_request.sql)
   — shows signature pin → role gate → invalid-input gate → happy-path
   state-change verification → idempotency / double-resolve guard.
3. **pgTAP trigger:** copy
   [`sql/tests/triggers/period_lock.sql`](../../sql/tests/triggers/period_lock.sql)
   — the canonical per-child-relation INSERT-rejected loop + the
   super-admin escape-hatch positive branch.
4. **Edge Function schema + tests:** copy
   [`supabase/functions/notify-unlock-request/schema.ts`](../../supabase/functions/notify-unlock-request/schema.ts)
   and the schema-parse tests at the bottom of
   [`supabase/functions/notify-unlock-request/index.test.ts`](../../supabase/functions/notify-unlock-request/index.test.ts).
5. **Unit:** copy
   [`useManagePeriods.lockEnforcement.test.js`](../../src/admin/features/periods/__tests__/useManagePeriods.lockEnforcement.test.js)
   — the canonical hook-state-machine pattern with mocking only at
   `@/shared/api`.
6. **E2E Realtime:** copy
   [`e2e/admin/periods-realtime.spec.ts`](../../e2e/admin/periods-realtime.spec.ts)
   — the two-context structure with publication-shaped mutation in
   Context B.

Do **not** copy the page render / table / dropdown component tests
without a clear behavioral property to assert. Default to the
structures above and resist the pull to add render tests for coverage
symmetry.
