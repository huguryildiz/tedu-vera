# Periods — Reference Test Pattern

**Status:** Worked example. Other admin pages (Jurors, Projects, Criteria,
Outcomes, Settings, Reviews) should copy this shape rather than re-invent it.

**Companion spec:** `docs/qa/target-test-architecture.md`. Where this doc and
the architecture spec disagree, the architecture spec wins.

**Audience:** Anyone adding tests to an admin feature. Read end-to-end once,
then use as a quick lookup.

---

## 1. Why Periods is the reference

Periods is not the weakest admin page; it has the broadest *risk* surface.
A copy-paste of this pattern fits every admin page that needs:

- Tenant isolation across multiple tables (Periods touches `periods`,
  `period_criteria`, `period_outcomes`, `period_criterion_outcome_maps`,
  `unlock_requests`)
- Lifecycle transitions guarded by RPC + trigger (Draft → Live → Published →
  Closed)
- Realtime delivery to other admin tabs
- A super-admin-only path that some other role can attempt
- An edge function in the workflow

If your feature has fewer of those, *delete* the corresponding test layer —
do not stub it for symmetry. The architecture spec § 6 anti-pattern #8
prohibits coverage-for-coverage tests.

---

## 2. Inventory — what was added or modified in this pattern

### pgTAP layer

| File | New / modified | Plan | Catches |
|---|---|---|---|
| `sql/tests/_helpers.sql` | added `become_anon`, `seed_period_criteria`, `seed_period_outcomes`, `seed_unlock_requests` | n/a | reusable seed surface |
| `sql/tests/rls/periods_isolation.sql` | rewritten — was 4 SELECT-only tests, now 11 covering INSERT/UPDATE/DELETE matrix | 11 | every periods-table tenant-isolation regression |
| `sql/tests/rls/period_criteria_isolation.sql` | NEW | 7 | regressions in JOIN-derived tenant scope |
| `sql/tests/rls/period_outcomes_isolation.sql` | NEW | 5 | same JOIN-derived shape, paranoid sibling pin |
| `sql/tests/rls/unlock_requests_isolation.sql` | NEW | 8 | RPC-only-write architecture; revealed the real grant gap on `unlock_requests` |
| `sql/tests/rpcs/contracts/admin_publish_period.sql` | strengthened — replaced two `SELECT ok(true, …)` placeholders | 10 | publish-readiness response shape |
| `sql/tests/rpcs/contracts/admin_resolve_unlock_request.sql` | NEW | 12 | the entire approve/reject flow + double-resolve guard |
| `sql/tests/triggers/period_lock.sql` | NEW (extracted + expanded from `triggers/triggers.sql`) | 8 | dual-layer security regressions on EITHER layer |

Total pgTAP plan increase across these files: **53 assertions**, all green
on `vera-demo`. The `unlock_requests` grant fix was applied in-place to
`sql/migrations/002_tables.sql` and to both projects (vera-prod and
vera-demo) via Supabase MCP — see § 7.

### Edge Function layer

| File | New / modified | Coverage |
|---|---|---|
| `supabase/functions/notify-unlock-request/schema.ts` | NEW | Zod request + response shapes; both sides import it |
| `supabase/functions/notify-unlock-request/index.test.ts` | added 3 Zod-parse tests | response shape regressions |

Suite size: **15 Deno tests** (12 existing + 3 schema-parse), all green.

### Unit layer

| File | Action | Reason |
|---|---|---|
| `src/admin/features/periods/__tests__/useManagePeriods.lockEnforcement.test.js` | KEPT — cite as reference | 6 real-logic tests, mocks at `src/shared/api/` boundary |
| `src/admin/features/periods/__tests__/periodHelpers.test.js` | KEPT — cite as reference | pure-logic state machine, no mocks |
| `src/admin/features/periods/__tests__/AddEditPeriodDrawer.test.jsx` | KEPT | exercises duplicate-name validation conditional |
| `src/admin/features/periods/__tests__/ClosePeriodModal.test.jsx` | KEPT | type-name-to-enable button gate |
| `src/admin/features/periods/__tests__/DeletePeriodModal.test.jsx` | KEPT | three real conditional branches |
| `src/admin/features/periods/__tests__/PublishPeriodModal.test.jsx` | KEPT | onPublish callback wiring |
| `src/admin/features/periods/__tests__/PeriodCells.test.jsx` | KEPT | conditional render across multiple state combos |
| `src/admin/features/periods/__tests__/CompletionStrip.test.jsx` | KEPT | null-on-no-metrics branch |
| `src/admin/features/periods/__tests__/PeriodsTable.test.jsx` | TRIMMED (4 → 2 tests) | column-header / renders-rows tests were pure label assertions |
| `src/admin/features/periods/__tests__/PeriodsPage.test.jsx` | TRIMMED (6 → 1 test) | mocked every child then asserted hardcoded copy — anti-pattern #6 + #8 |
| `src/admin/features/periods/__tests__/useManagePeriods.test.js` | DELETED | mock-tautology — mock returned `[]`, test asserted `[]`. § 6 anti-pattern #1 |

Final unit count for Periods: **30 tests across 11 files** (a 12th file —
`useManagePeriods.test.js` — was deleted; `PeriodsTable` was trimmed
4 → 2 tests; `PeriodsPage` was trimmed 6 → 1; an unaudited 4-test file
in `components/__tests__/PeriodSmallComponents.test.jsx` was left as-is
for a future cleanup pass since its assertions are weak but harmless).
Full repo unit suite: 1058 passed, 11 skipped, 0 failed.

### E2E layer

| File | Action |
|---|---|
| `e2e/admin/periods.spec.ts` | KEPT — solid CRUD + E4-3 publish + E4-4 close-write-block |
| `e2e/admin/unlock-request.spec.ts` | KEPT as reference for the real-JWT pattern (signInWithPassword → makeUserClient → per-user RPC client) |
| `e2e/admin/periods-realtime.spec.ts` | NEW — canonical two-context Realtime pattern (see § 5) |

E2E run requires a live dev server + demo-DB credentials. The new spec was
**not executed in this session**; verification was performed via a static
trace through the POM API and the `realtime-score-update.spec.ts` companion
that the new spec is structurally modeled on. Full run is owed to the next
CI cycle.

### Integration layer (Vitest + real DB)

Architecture spec § 3.2 — **permanently absent in VERA per project decision
(2026-04-26).** No `vera-test` Supabase project will be provisioned; no
Vitest `integration` project will be added. All shape pins land in pgTAP
RPC contracts; all RLS pins land in pgTAP isolation files; all multi-RPC
sequences are covered by E2E real-DB specs (`unlock-request.spec.ts`
pattern). See § 11 #1 and `target-test-architecture.md` § 3.2 (revised).

---

## 3. Decision rationale, layer by layer

### 3.1 Why pgTAP gets the bulk of the new tests

Periods touches **89 RLS policies** and **~12 admin RPCs** along its
lifecycle. Architecture spec § 1 #1 ("tenant isolation is non-negotiable")
forbids relying on JS tests to prove tenant isolation. The pgTAP layer is
where:

- The per-table RLS matrix lives (`rls/<table>_isolation.sql` per § 7
  glossary).
- Each RPC's signature + happy/error envelopes are pinned.
- Triggers — the second layer of period-lock enforcement — are exercised
  independently from RLS so a regression in *either* layer is caught.

Anything that *can* live in pgTAP *should* — it runs in milliseconds, has
no flake surface, and is the only place that proves the database actually
behaves the way we believe.

### 3.2 Why VERA does not have an integration layer

See § 2 above. Architecture § 3.2's two stated needs ("RLS edge cases
awkward to express in pgTAP" and "each `src/shared/api/` function exercised
against a real test database") both have viable redirects in VERA's stack:
RLS edges fit cleanly into pgTAP isolation files (Periods § 4 dual-layer
pattern is the worked example), and src/shared/api/ wrappers stay as
mock-supabase unit tests with the DB-side guarantee covered by pgTAP RPC
contracts + the `db.generated.ts` diff gate. Cost + maintenance + CI
secret surface of a third Supabase project exceed the marginal value.

### 3.3 Why the unit layer was trimmed, not expanded

Unit tests in this codebase had drifted toward "render this component, then
assert that some hardcoded copy string exists in the DOM." Per architecture
spec § 6 anti-pattern #8: a test that fails only when a label changes is
not catching behavior — it is catching a typo. Three categories survived
the audit:

1. **Pure logic** (`periodHelpers.test.js`) — math + state-machine
   transitions. No mocks. Catches rounding drift and integer-division bugs
   that pgTAP cannot see.
2. **Hook gating logic** (`useManagePeriods.lockEnforcement.test.js`) —
   the JS-side `is_locked` short-circuit *before* the API call. Mocks at
   the `@/shared/api` boundary, asserts the API was NOT called when the
   short-circuit fires. The mutation sample in § 6 demonstrates this
   catches the intended class of regression.
3. **Form / modal conditional rendering** — type-to-enable gates,
   duplicate-name validation, null-on-no-metrics branches.

Anything outside those three categories was deleted or slimmed.

### 3.4 Why the E2E set is small

Architecture spec § 3.6 caps E2E at ~5% of total tests. The pre-existing
specs already cover CRUD, lifecycle (E4-3 publish, E4-4 close-write-block),
and the unlock flow. The only canonical pattern missing was the **two-tab
Realtime propagation**, which is now `periods-realtime.spec.ts`. We did
**not** add a cross-tenant E2E because architecture § 6 anti-pattern #2
explicitly disqualifies it: "asserting RLS behavior in E2E is an expensive
smoke test, not a proof; the proof belongs in pgTAP."

---

## 4. The dual-layer security pattern (canonical)

VERA enforces period-lock immutability on **two independent layers**, and
every period-lock-related test must exercise BOTH layers separately. This
is the most distinctive pattern other admin pages should copy whenever
they have a state machine with a "frozen" terminal state.

### Layer 1 — Row Level Security policies

```
sql/migrations/004_rls.sql
  period_criteria_select      — JOIN to periods.organization_id
  period_criteria_insert      — same scope; tenant must own the period
  period_outcomes_*           — same shape
```

These policies *filter* (silent 0-row) and *block with WITH CHECK* (42501).
Pinned by:

- [`sql/tests/rls/period_criteria_isolation.sql`](../../sql/tests/rls/period_criteria_isolation.sql)
- [`sql/tests/rls/period_outcomes_isolation.sql`](../../sql/tests/rls/period_outcomes_isolation.sql)
- [`sql/tests/rls/periods_isolation.sql`](../../sql/tests/rls/periods_isolation.sql)
- [`sql/tests/rls/unlock_requests_isolation.sql`](../../sql/tests/rls/unlock_requests_isolation.sql)

### Layer 2 — Postgres triggers

```
sql/migrations/003_helpers_and_triggers.sql
  _assert_period_unlocked()                 — central guard, raises 'period_locked'
  trigger_block_period_child_on_locked()    — used by 3 child tables
  trigger_block_projects_on_locked_period   — projects
  trigger_block_jurors_on_locked_period     — jurors
  trigger_block_periods_on_locked_mutate    — periods (super-admin escape hatch)
```

Triggers run via `SECURITY DEFINER` regardless of caller role. That is the
whole point of the second layer: even a SECURITY DEFINER admin RPC that
bypasses RLS still hits the trigger when it tries to insert into a
locked-period child relation. Pinned by:

- [`sql/tests/triggers/period_lock.sql`](../../sql/tests/triggers/period_lock.sql)

### Why test BOTH layers separately

A regression in **either** layer alone keeps the system "safe enough" via
the other layer — and so the bug ships unnoticed. Two independent failure
points mean the dual-layer property must be tested with two independent
assertion paths:

| Regression scenario | RLS test fires | Trigger test fires |
|---|---|---|
| RLS policy dropped on `period_criteria` | ✅ catches | ❌ trigger still blocks, "passes" |
| `_assert_period_unlocked` made no-op | ❌ RLS still filters reads, "passes" | ✅ catches |
| Both regress | ✅ ✅ | both fail loudly |

The `triggers/period_lock.sql` mutation sample in § 6.1 demonstrates this:
making the helper a no-op leaves RLS read-paths intact (test 5 of
`period_criteria_isolation` still passes for selects), but the trigger
test for INSERT-into-locked-period flips from `period_locked` raised to
"caught: no exception" — the kind of asymmetric break only the trigger
test surfaces.

### What the same pattern looks like for other features

Any feature with a "freeze" terminal state (closed periods, archived
projects, locked jurors) should mirror this:

1. RLS policy on the table — pinned in `rls/<table>_isolation.sql`.
2. A `BEFORE INSERT/UPDATE/DELETE` trigger that calls a central
   `_assert_<state>_<verb>()` guard helper.
3. A focused trigger test file in `sql/tests/triggers/<feature>_lock.sql`
   that exercises EACH child relation independently and asserts both the
   negative branch (raise) and the positive escape-hatch branch (super
   admin or whatever the architectural escape is).

---

## 5. The Realtime testing pattern (canonical)

Architecture spec § 3.6 lists Realtime as one of the few mandatory E2E
journey types, and § 6 anti-pattern #2 forbids using E2E for anything
testable in a lower layer. So Realtime gets exactly one E2E spec per
admin surface, and it follows a strict two-context shape.

### File: [`e2e/admin/periods-realtime.spec.ts`](../../e2e/admin/periods-realtime.spec.ts)

```
Context A — adminClient signs in via PomLoginPom.signIn(), navigates to
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

1. **Two contexts, not one.** A single-tab test can't distinguish "the
   page re-rendered because of the local state update I just dispatched"
   from "the page re-rendered because Realtime delivered an event." Two
   tabs forces the assertion to be about the second path.

2. **adminClient mutation, not a fixture insert.** The shape of the
   Realtime payload is determined by the actual production write code,
   not by a hand-rolled fixture. If `rpc_admin_publish_period` ever
   stops emitting an UPDATE on `periods` (e.g. switches to a new
   `period_states` table without updating the Realtime publication), this
   test catches that. A fixture-INSERT could not.

3. **No assertion that the local DB state is correct.** That is pgTAP's
   job. This test only asserts that *the UI saw the change without a
   refresh*.

4. **Cleanup unlocks before delete.** The `afterAll` flips
   `is_locked: false, closed_at: null` before deletion because the
   periods trigger blocks DELETE on a locked period (intentionally — see
   § 4). Other admin features will need analogous unlock steps in
   teardown when their state machine has a frozen terminal.

### Bug classes this catches

- The page's Realtime subscription not subscribing on mount.
- The Realtime publication on `periods` being dropped from migrations.
- An UPDATE handler ignoring `is_locked` transitions because of a stale
  closure over the row list (a useEffect dependency mistake).

### What this test does NOT cover

- Cross-tenant Realtime isolation — pgTAP RLS files cover that the
  subscription only delivers rows the caller can SELECT.
- Realtime publication membership — also pgTAP.
- The actual visual styling of the Published status pill — visual
  regression tests, not journey tests.

---

## 6. Mutation samples (one per layer, with documented results)

Each mutation was performed in a transaction that was rolled back, or
reverted via `Edit`, before the next layer was attempted. No production
state was changed.

### 6.1 pgTAP — replace `_assert_period_unlocked()` with a no-op

**Mutation:** make the helper return immediately without raising.

**Expected:** `triggers/period_lock.sql` test 1 ("INSERT period_criteria
into LOCKED → period_locked") flips to NOT OK because the trigger no
longer raises.

**Observed (verbatim from MCP run, transaction rolled back):**

```
not ok 1 - INSERT period_criteria into LOCKED → period_locked
# Failed test 1: "INSERT period_criteria into LOCKED → period_locked"
#       caught: no exception
#       wanted: 23514
```

**Conclusion:** the trigger test catches the canonical "lock guard is
broken" class of bug. Restoration via `ROLLBACK` left the function intact.

### 6.2 Unit — disable the JS-side lock short-circuit

**Mutation:** change `if (period?.is_locked)` to `if (false &&
period?.is_locked)` in `src/admin/features/periods/useManagePeriods.js`
line 452.

**Expected:** `useManagePeriods.lockEnforcement.test.js` should fail,
specifically the assertions that the RPC was NOT called when the period
is locked.

**Observed (vitest output):**

```
FAIL  src/admin/features/periods/__tests__/useManagePeriods.lockEnforcement.test.js
  > useManagePeriods — lock enforcement
  > Period starts draft; … period state changes to locked …
AssertionError: expected true to be false (mockSavePeriodCriteria not called)
2 failed | 4 passed (6)
```

**Conclusion:** the lock-enforcement test catches "the page forgot to
short-circuit before the RPC fires." Restoration verified — all 6 tests
green.

### 6.3 Edge function — add a required field the function never returns

**Mutation:** add `required_extra_field: z.string()` (no `.optional()`) to
`SuccessResponseSchema` in
`supabase/functions/notify-unlock-request/schema.ts`.

**Expected:** the schema-parse test fails because `SuccessResponseSchema.parse(body)`
throws on a missing required field.

**Observed (deno test output):**

```
notify-unlock-request — success response parses against SuccessResponseSchema ... FAILED
14 passed | 1 failed
```

**Conclusion:** the schema is load-bearing — a real shape mismatch is
caught loudly. Restoration verified — 15 / 15 green.

### 6.4 E2E — not executed in this session

Documented honestly: the new `periods-realtime.spec.ts` was not run end
to end in this session. The mutation that *would* catch a real regression:
remove the `usePageRealtime()` subscription wiring in `PeriodsPage.jsx`.
Tab A would then never observe the publish event from Tab B and the
expect-toContainText("Published") would time out at 15s. That mutation is
left to the next CI cycle to verify.

---

## 7. Production change discovered in flight

While writing `unlock_requests_isolation.sql` we observed that the
`unlock_requests` table had no `GRANT SELECT` to `authenticated` or `anon`.
The `unlock_requests_select` RLS policy was therefore dead code: tenant
admins received `42501 permission denied for table unlock_requests`
*before* RLS evaluated, on every direct SELECT. The frontend works only
because every read goes through `rpc_admin_list_unlock_requests`
(SECURITY DEFINER), which bypasses RLS.

This is the canonical "drift sentinel" property in architecture spec
§ 5.5 — a contract test caught a production gap that no other layer would
have surfaced.

**Fix landed:**

- `sql/migrations/002_tables.sql` — added `GRANT SELECT ON unlock_requests
  TO authenticated` and `GRANT SELECT, INSERT, UPDATE, DELETE ON
  unlock_requests TO service_role` in the GRANTS block.
- Applied to **both** `vera-prod` and `vera-demo` via Supabase MCP in the
  same session, per the project's "every migration runs on both projects
  in the same step" rule.

**Why we kept the `authenticated` grant SELECT-only (not full CRUD):**
Writes go exclusively through SECURITY DEFINER RPCs by design (section
header in 004_rls.sql: "INSERT/UPDATE go exclusively through SECURITY
DEFINER RPCs (no write policies)"). A full INSERT/UPDATE/DELETE grant
would have made a future "permissive UPDATE policy" PR silently
functional; SELECT-only keeps writes locked to the RPC path. The
unlock_requests test now asserts hard `42501` on direct UPDATE and
DELETE, which is stronger than RLS's silent 0-row filtering.

---

## 8. Helper additions to `sql/tests/_helpers.sql`

These are shared, opt-in fixtures. Other test files should call them
rather than re-roll their own seed inserts.

| Helper | Purpose |
|---|---|
| `pgtap_test.become_anon()` | drops to `anon` role with no JWT claims; mirrors a logged-out client |
| `pgtap_test.seed_period_criteria()` | 2 criteria per UNLOCKED period (A1 + B1) for tenant-isolation tests |
| `pgtap_test.seed_period_outcomes()` | 1 outcome per UNLOCKED period (A1 + B1) |
| `pgtap_test.seed_unlock_requests()` | 1 pending unlock_request per locked period (A2_locked + B2_locked) |

Grants on the `pgtap_test` schema were extended to `authenticated, anon`
(was `authenticated` only) so a test can call `become_reset()` from
inside an `anon` context without a permission error. See the comment
above the GRANT block in `_helpers.sql`.

---

## 9. The "what we deliberately did NOT test" inventory

Per architecture spec § 4 ("what does NOT need testing"). Each item below
was considered and rejected with a reason.

| Not tested | Why |
|---|---|
| `lucide-react` icon rendering on PeriodsPage | Third-party. § 4. |
| Specific colors / spacings / font sizes | Visual diff territory; not journey. § 4. |
| `react-router-dom` route resolution itself | Library. § 4. |
| Tailwind class names on PeriodsTable rows | Brittle and subjective. § 4. |
| `console.warn` in dev mode for stale closures | Not a contract. § 4. |
| Rendering the page when the user is not authenticated | One unit test for the redirect (in AuthGuard tests, not here). § 4. |
| Cross-tenant RLS in E2E | § 6 anti-pattern #2 — pgTAP is the proof; E2E would only smoke it. |
| The actual email content from `notify-unlock-request` | Provider concern; we test the wire shape, not Resend's HTML rendering. |
| 404 paths for each RPC | Each RPC's contract file already pins one 404 case; broader 404 suites duplicate the schema test. |
| Performance / latency of any layer | Out of scope for journey tests; tracked separately. |
| Localization of period names | i18n is a separate concern; not behavior. |

---

## 10. Time + budget data for future contributors

The architecture spec § 5.4 caps total CI runtime at ≤ 12 min. The
Periods-specific cost of this pattern, measured locally:

| Layer | New tests | Local wall time |
|---|---|---|
| pgTAP (5 RLS files + 4 RPC files + 1 trigger file) | 53 assertions | < 5s when run as a batch via `pg_prove` |
| Edge function Deno suite | 15 tests | 18 ms |
| Vitest periods folder only | 26 tests across 10 files | ~1.5 s |
| Vitest full repo | 1058 tests | ~10 s |
| E2E `periods-realtime.spec.ts` | 1 spec | not run; expected ~10–15 s with a 15 s observation window |

A like-for-like copy of this pattern to a new admin page typically takes:

- **2 hours** for the pgTAP RLS + RPC contract files (per-table SELECT/INSERT/UPDATE/DELETE matrix).
- **1 hour** for the Deno schema + Zod-parse tests (edge function only if the page has one).
- **1 hour** for unit-test cleanup + the keep/trim/delete audit.
- **1 hour** for the Realtime spec (copy the two-context structure verbatim).

Total: about half a day per admin page if the architecture is being followed.
Pages without an edge function or without Realtime save the corresponding
hour outright.

---

## 11. Divergence from the architecture spec

The following decisions diverge from the architecture spec; each is
documented here so a future reviewer can confirm or revert.

1. **No integration layer added — permanent project decision (2026-04-26).**
   Architecture § 3.2 calls for a `vera-test` Supabase project. VERA will
   not provision one and will not adopt the integration layer. Equivalent
   guarantees redirect to pgTAP RPC contracts + pgTAP RLS isolation +
   E2E real-DB asserts (`unlock-request.spec.ts` pattern) + the
   `db.generated.ts` diff gate. Settings — flagged here previously as the
   feature most likely to need integration first — gets E2E save specs
   instead. See
   `docs/superpowers/plans/test-reclassification/test-reclassification-plan.md`
   § 0a and `target-test-architecture.md` § 3.2 (revised).

2. **No `rpc_admin_list_unlock_requests` contract file added.**
   Architecture § 3.4 calls for one contract file per public RPC. The
   listing RPC is read-only, joins denormalized fields for UI
   convenience, and its shape is exercised end-to-end by
   `unlock-request.spec.ts` via the actual frontend wrapper. A
   stand-alone contract file would mostly assert column names already
   pinned by `Database['public']['Functions']` types. Deferred until
   `npx supabase gen types` is wired into CI (then the diff check
   replaces the explicit contract).

3. **One QA-catalog entry uses `coverageStrength: "Smoke"`.**
   `admin.periods.page.mounts` is intentionally a smoke test. The
   catalog vocabulary did not previously include "Smoke"; we used it
   anyway because the test class genuinely is "smoke", not "Strong" or
   "Medium". Future audits can either canonicalize "Smoke" or replace
   it with "Medium" if they prefer.

4. **The realtime E2E spec was not executed in this session.**
   Documented in § 2 + § 6.4. Owed to the next CI cycle.

---

## 12. Quick reference — files to copy-paste from for a new admin page

Order matters: pgTAP first, edge function second, unit third, E2E last.
Working in this order means each upper layer rests on a verified lower
layer.

1. **pgTAP RLS:** copy [`sql/tests/rls/periods_isolation.sql`](../../sql/tests/rls/periods_isolation.sql) — it covers
   anon, tenant-A, tenant-B, super-admin × SELECT/INSERT/UPDATE/DELETE
   matrix with the temp-table-row-count idiom for silent UPDATE/DELETE
   filtering.
2. **pgTAP RPC contract:** copy [`sql/tests/rpcs/contracts/admin_resolve_unlock_request.sql`](../../sql/tests/rpcs/contracts/admin_resolve_unlock_request.sql) — it shows
   signature pin → role gate → invalid-input gate → happy-path state-change
   verification → idempotency / double-resolve guard.
3. **pgTAP trigger:** copy [`sql/tests/triggers/period_lock.sql`](../../sql/tests/triggers/period_lock.sql) — the canonical
   per-child-relation INSERT-rejected loop + the super-admin escape-hatch
   positive branch.
4. **Edge fn schema + tests:** copy [`supabase/functions/notify-unlock-request/schema.ts`](../../supabase/functions/notify-unlock-request/schema.ts) and the
   3 schema-parse tests at the bottom of [`supabase/functions/notify-unlock-request/index.test.ts`](../../supabase/functions/notify-unlock-request/index.test.ts).
5. **Unit:** copy [`useManagePeriods.lockEnforcement.test.js`](../../src/admin/features/periods/__tests__/useManagePeriods.lockEnforcement.test.js) — the canonical
   hook-state-machine pattern with mocking only at `@/shared/api`.
6. **E2E Realtime:** copy [`periods-realtime.spec.ts`](../../e2e/admin/periods-realtime.spec.ts) — the two-context
   structure with publication-shaped mutation in Context B.

Do **not** copy the RPC list / table / page render tests; those are the
exception cases this audit slimmed back to "1 smoke test maximum" per
file. Default to the structures above and resist the pull to add render
tests for coverage symmetry.
