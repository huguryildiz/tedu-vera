# P1 Item 11 — Concurrent-jury performance test

## Goal

Validate the platform's event-day workload: N jurors scoring projects simultaneously. Today nothing tests this; the only real exercise is the actual TEDU event itself.

## Approach

A Playwright fan-out test that uses N parallel browser contexts, each acting as a different juror, all scoring the same set of projects in the same period within a small time window.

## Spec file

`e2e/perf/concurrent-jury.spec.ts`

## Test outline

```ts
import { test, expect, BrowserContext } from "@playwright/test";
import { adminClient } from "../helpers/supabaseAdmin";
import { setupScoringFixture, teardownScoringFixture } from "../helpers/scoringFixture";

const N_JURORS = 8;          // realistic event-day size for one TEDU jury panel
const PROJECTS_PER_JUROR = 5;
const SCORE_WINDOW_MS = 60_000; // SLO: all jurors finish within 60s

test("N jurors score concurrently without RPC failures", async ({ browser }) => {
  // 1) Set up fixture: 1 period, N jurors, PROJECTS_PER_JUROR projects, criteria
  const fixture = await setupScoringFixture({ jurors: N_JURORS, projects: PROJECTS_PER_JUROR });

  // 2) Open N browser contexts in parallel, each authenticating as a different juror
  const contexts: BrowserContext[] = await Promise.all(
    Array.from({ length: N_JURORS }, () => browser.newContext())
  );

  // 3) Drive each context through pin verify → score every project → submit
  const start = Date.now();
  const results = await Promise.all(
    contexts.map((ctx, i) => driveJuror(ctx, fixture.jurorIds[i], fixture))
  );
  const duration = Date.now() - start;

  // 4) Assertions
  expect(results.every((r) => r.ok)).toBe(true);                      // no RPC failures
  expect(duration).toBeLessThan(SCORE_WINDOW_MS);                      // SLO met
  const { count } = await adminClient
    .from("score_sheet_items")
    .select("*", { count: "exact", head: true })
    .eq("period_id", fixture.periodId);
  expect(count).toBe(N_JURORS * PROJECTS_PER_JUROR * /* criteria */ 4); // every (juror,project,criterion) cell written

  await teardownScoringFixture(fixture);
});
```

## Implementation notes

- `setupScoringFixture` already supports `jurors: N` — extend if needed for `projects: M`
- `driveJuror(ctx, jurorId, fixture)` is a new helper in `e2e/helpers/concurrentJuror.ts`. It performs the same actions as the existing happy-path single-juror flow but parameterized by jurorId.
- Run only against demo (`E2E_BASE_URL`), never prod
- This test is HEAVY — gate it on a separate workflow_dispatch step (do not run on every PR)

## Workflow integration

Add a job to `e2e.yml` (or a new `perf.yml`):

```yaml
perf:
  name: Concurrent-jury perf
  if: github.event_name == 'workflow_dispatch'
  needs: e2e
  steps:
    - run: npx playwright test e2e/perf/concurrent-jury.spec.ts --reporter=list
```

## Acceptance

- 8 parallel jurors × 5 projects × 4 criteria = 160 score items written within 60s, zero RPC failures, no fixture corruption
- Test is opt-in (workflow_dispatch only)
- Failure surface: P95 RPC latency, partial-write states, deadlocks

## Out of scope

- Sustained load (this is a burst test, not a soak)
- Auth fan-out (jury PIN auth, not OAuth)
- Real tenant isolation under load (covered by separate rbac-boundary.spec)
