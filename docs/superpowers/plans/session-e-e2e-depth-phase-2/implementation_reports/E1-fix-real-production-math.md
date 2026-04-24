# E1-fix — Outcome attainment: real production path

**Branch:** `test/e1-fix-real-production-math` (off `test/e4-export-lifecycle`; E1 commit `c32fbaab` present)
**Date:** 2026-04-25
**Status:** Complete — 4 tests green, 12/12 flake-free, deliberately-break now probes production code.

---

## The problem E1 left behind

The original E1 sprint ([E1-outcome-attainment.md](E1-outcome-attainment.md)) locked outcome
attainment into 4 E2E tests, but the read path (`readAttainment` in
[e2e/helpers/outcomeFixture.ts](../../../../e2e/helpers/outcomeFixture.ts)) was a **TypeScript replica**
of the production formula from
[src/shared/api/admin/scores.js:259-345](../../../../src/shared/api/admin/scores.js#L259-L345).
A bug in production (e.g. `* 100` → `* 200`, dropping the weight denominator, skipping effective-weight
filtering) would not propagate to the test, because the test computed its own expected value from the
same DB rows using its own code. The E1 report's "Risks" section flagged this explicitly.

Tautology: "does `readAttainment(DB state)` equal 65? yes, because I told it to."

## What E1-fix changes

`readAttainment` now invokes the real `getOutcomeAttainmentTrends` from
[src/shared/api/admin/scores.js](../../../../src/shared/api/admin/scores.js) via `page.evaluate` +
dynamic import against the Vite dev server:

```ts
export async function readAttainment(page: Page, periodId: string): Promise<Record<string, number>> {
  const result = await page.evaluate(async (pid) => {
    // @ts-expect-error Vite resolves this absolute-from-root URL at runtime
    const mod = await import("/src/shared/api/admin/scores.js");
    const trends = await mod.getOutcomeAttainmentTrends([pid]);
    // ...collapse to { [code]: avg }
  }, periodId);
  return result;
}
```

The test signs the admin in (`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`, tenant-admin of
`E2E_PERIODS_ORG_ID`), navigates to `/admin/overview` (so the app bundle and the supabase client's
auth session are both live), then runs the read. The same module the production Analytics page uses
returns the answer — any regression in scores.js surfaces directly in the test.

## Which option was used — and why A won

The plan offered two routes:

- **Option A** — import production function directly
- **Option B** — add new UI-driven tests alongside the original replica tests

I took **Option A** via the `page.evaluate` variant the E1 report itself suggested as a follow-up.
The direct Node-side import route hits a wall: `src/shared/api/core/client.js` reads
`import.meta.env.VITE_SUPABASE_URL`, which is Vite syntax — Playwright's Node worker doesn't run
through Vite, so a bare `import` from `../src/...` would either resolve the env to empty strings or
fail depending on the loader. The `page.evaluate` variant sidesteps that entirely: Vite already
serves the module to the admin page, the singleton supabase client is already initialized with the
correct URL and auth session, and the dynamic import reuses the same module graph. No service-role
shim, no env var plumbing, no dual build.

Option B was the fallback for when `page.evaluate` hit issues — it didn't, so I didn't need UI testids
or chart-text scraping. Analytics UI is unchanged.

## Files

### Modified

- `e2e/helpers/outcomeFixture.ts`
  - `readAttainment(periodId)` → `readAttainment(page, periodId)`; body replaced with page.evaluate
    + dynamic import of production scores.js
  - docstring rewritten to explain the coupling and prereqs (admin signed in, on `/admin/*` route)
- `e2e/admin/outcome-attainment.spec.ts`
  - Added `signInAsAdmin(page)` helper using `LoginPom` + `AdminShellPom` + `admin.active_organization_id`
    seeded to `E2E_PERIODS_ORG_ID`
  - Each of the 4 tests now takes `{ page }`, calls `signInAsAdmin(page)` after fixture setup, and
    calls `readAttainment(page, fixture.periodId)`
  - No test count change (4 tests in, 4 tests out) — same assertions, new read path

### Untouched

- `src/shared/api/admin/scores.js` — only temporarily mutated for the deliberately-break proof, then reverted
- Analytics UI components — Option B path not taken

## Deliberately-break proof

**What changed:** `scores.js:314` — `* 100` → `* 200` (double the raw-to-percent constant)

**Command:**

```bash
npm run e2e -- --grep "outcome attainment" --workers=1
```

**Output (first test's assertion failure, subsequent tests skipped by serial mode):**

```text
  1) outcome attainment math correctness › single criterion full weight → attainment = (raw/max)*100

    Error: expect(received).toBeCloseTo(expected, precision)
    Expected: 80
    Received: 160

    Expected precision:    1
    Expected difference: < 0.05
    Received difference:   80

      73 |     // (8/10) * 100 * 1.0 / 1.0 = 80.0
    > 74 |     expect(result["OA"]).toBeCloseTo(80, 1);
```

The test read `80 * 2 = 160` — the value the bug produced — because the read path ran the mutated
production code. After reverting the change in scores.js, all 4 tests pass again; `git diff` is empty
on scores.js.

Before E1-fix, the same mutation would have left tests green: the replica kept its `* 100` literal
independent of the production file. The behavioral difference is the entire point of this sprint.

## Flake check

```bash
npm run e2e -- --grep "outcome attainment" --repeat-each=3 --workers=1
```

```text
Running 12 tests using 1 worker
  ✓  1..4  (run 1) — 2.7–3.5s each
  ✓  5..8  (run 2)
  ✓  9..12 (run 3)

  12 passed (37.0s)
```

12/12 green. Slightly slower per test than E1's pure-DB reads (2.7–3.5s vs 1.3–1.7s) because each test
now pays the admin sign-in + navigate cost (~1.5s). Worth it.

## Why the old replica was deleted rather than kept as a "schema contract" test

The E1 report offered a fallback where the replica could stay alongside the new read path as a schema
contract test. I deleted it instead. The replica duplicates SQL queries, pivot logic, and the formula —
all of which are already covered now by the real function running against the real DB. Keeping it
would have meant:

- Two sources of truth for attainment math that must be kept in sync
- Double maintenance burden every time scores.js evolves
- No additional guarantee — schema drift would break both paths simultaneously

The Option B fallback ("add new UI tests alongside") was specifically for the scenario where Option A
failed. It didn't, so there's no justification for keeping the replica.

## What the new tests actually exercise

A read from `readAttainment(page, periodId)` now traverses:

1. Admin auth — `LoginPom.signIn` → Supabase token → localStorage session injected by SDK
2. Vite dev server — `/src/shared/api/admin/scores.js` served on demand
3. Production module — `getOutcomeAttainmentTrends([periodId])`
4. Production supabase client — `@/shared/lib/supabaseClient` with admin JWT
5. RLS — policies on `period_criteria`, `period_criterion_outcome_maps`, `period_outcomes`,
   `score_sheets`, `score_sheet_items` resolve against the admin's membership
6. The formula — `Σ(raw/max × 100 × weight) / Σ weight` per eval, mean across evals, round to 1 dec
7. Returned data shape — `[{ periodId, periodName, nEvals, outcomes: [{code, label, avg, attainmentRate}] }]`

Regressions at any of those layers will fail the tests.

## Sprint exit checklist

- [x] `readAttainment` bound to production `getOutcomeAttainmentTrends`
- [x] Replica formula deleted (no schema-contract duplicate kept)
- [x] 4 tests pass; 12/12 `--repeat-each=3 --workers=1`
- [x] Deliberately-break proof: production mutation makes tests fail; revert restores green
- [x] `git diff src/shared/api/admin/scores.js` empty after revert
- [x] No new UI testids added (Option B not needed)
- [x] Committed locally, **not pushed**
