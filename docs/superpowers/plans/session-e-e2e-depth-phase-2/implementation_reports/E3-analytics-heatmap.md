# E3 Implementation Report — Analytics + Heatmap data accuracy

**Sprint:** Session E — E2E Depth Phase 2, Sprint E3
**Branch:** `test/e3-analytics-heatmap-data`
**Date:** 2026-04-25

## Summary

6 new E2E tests added in two describes (3 analytics + 3 heatmap). All 6 pass on
first run, no flake across 30 executions (10 tests × 3 repeats, `--workers=1`).
C4 scoring-correctness tests remain green — the `scoringFixture` extension is
backward compatible with the single-juror path.

## Pass-rate delta

| | Before | After |
|---|---|---|
| `analytics.spec.ts` | 2 (smoke only) | 5 (2 smoke + 3 data accuracy) |
| `heatmap.spec.ts`   | 2 (smoke only) | 5 (2 smoke + 3 data accuracy) |
| Flake check (3× repeat) | — | 30/30 pass |
| Full suite (`npx playwright test --workers=1`) | 119 pass | 124 pass, 1 pre-existing failure* |

\* `organizations-crud › create — new org appears in the table` fails with and
without the E3 diff (verified by stashing E3 changes, re-running — same
failure). Unrelated to this sprint.

## Tests implemented

### Analytics — `e2e/admin/analytics.spec.ts`

`test.describe("analytics data accuracy (E3)")` — 3 tests, serial.

**Fixture:** `setupScoringFixture({ namePrefix: "E3 Analytics", aMax: 100, bMax: 100, outcomes: true, jurors: 2 })`
seeds criteria A/B (max=100 each), two `period_outcomes` (`PO_A_…`, `PO_B_…`),
and 1:1 maps via `period_criterion_outcome_maps`.
`writeMatrixScores` writes the 2×2 submitted matrix:

|   | Project 1       | Project 2       |
|---|-----------------|-----------------|
| J1| a=80 b=50       | a=90 b=60       |
| J2| a=75 b=90       | a=85 b=95       |

Expected attainment (threshold = 70% per value, normalized by `max_score`):

- **PO_A** (mapped to criterion A): values `[80, 75, 90, 85]` → 4/4 ≥ 70 → **attRate 100%** → "met"
- **PO_B** (mapped to criterion B): values `[50, 90, 60, 95]` → 2/4 ≥ 70 → **attRate 50%** → "not-met" (< 60)
- Summary strip: **1 of 2** outcomes met

Tests:

1. Attainment card for PO_A → `data-att-rate="100"`, `data-att-status="met"`
2. Attainment card for PO_B → `data-att-rate="50"`, `data-att-status="not-met"`
3. Summary strip → `data-met-count="1"`, `data-total-count="2"`

### Heatmap — `e2e/admin/heatmap.spec.ts`

`test.describe("heatmap data accuracy (E3)")` — 3 tests, serial.

**Fixture:** `setupScoringFixture({ namePrefix: "E3 Heatmap", aMax: 100, bMax: 100, jurors: 2 })`.
`writeMatrixScores` with a deliberate mix of cell states:

|   | Project 1              | Project 2                          |
|---|------------------------|------------------------------------|
| J1| a=80, b=50 → scored 130| a=60 (b omitted) → **partial 60** |
| J2| `null` → **empty**    | a=90, b=95 → scored 185            |

Derived aggregates (activeTab="all", tabMax=200):

- P1 project avg (scored cells only) = 130
- P2 project avg (scored cells only) = 185 (J1 partial excluded)
- J1 row avg = 130 (P2 partial excluded)
- J2 row avg = 185 (P1 empty excluded)
- Overall avg = (130 + 185) / 2 = **157.5**

Tests:

1. **cell states match seeded scoring pattern** — asserts `data-cell-state` +
   `data-cell-score` on all four cells.
2. **row/column/overall averages match expected aggregation** — asserts
   `data-avg` on per-juror, per-project, and overall average `<td>`s.
3. **deliberately-break: mutating a sheet to partial changes its cell state** —
   renders initial `scored`, deletes J1×P1's criterion-B item via
   `adminClient.from("score_sheet_items").delete()`, opens a fresh browser
   context, asserts `data-cell-state="partial"` + `data-cell-score="80"`.
   Restores via `writeMatrixScores` in a `finally` block.

## data-testids added

### `src/admin/features/analytics/AnalyticsPage.jsx`

- `analytics-att-card-${code}` on each `.att-card` (+ `data-att-rate`, `data-att-status`)
- `analytics-att-card-value-${code}` on the inner attainment value span
- `analytics-outcomes-met-summary` on the insight banner (+ `data-met-count`, `data-total-count`)

### `src/admin/features/heatmap/HeatmapPage.jsx`

- `heatmap-cell-${juror.key}-${g.id}` on every `<td>` (+ `data-cell-state`, `data-cell-score` when applicable)
- `heatmap-juror-avg-${juror.key}` on each per-juror average `<td>` (+ `data-avg`)
- `heatmap-project-avg-${g.id}` on each per-project average `<td>` (+ `data-avg`)
- `heatmap-overall-avg` on the grand-total `<td>` (+ `data-avg`)

Only testids and numeric data-attrs were added. No rendering logic changed.

## scoringFixture extension — backward compatibility

`e2e/helpers/scoringFixture.ts` gained:

- `SetupScoringFixtureOpts.jurors?: number` (default **1** — C4 path unchanged)
- `SetupScoringFixtureOpts.outcomes?: boolean` (default **false** — C4 path unchanged)
- `ScoringFixture.jurorId` (preserved) **+** new `ScoringFixture.jurorIds: string[]`
- `ScoringFixture.criteriaAKey` / `criteriaBKey` — exposes the generated
  `period_criteria.key` so tests that need the key shape (not just the UUID)
  don't have to re-derive it from the suffix.
- `ScoringFixture.outcomeAId` / `outcomeACode` / `outcomeBId` / `outcomeBCode`
  — only populated when `outcomes: true`
- New helper: `writeMatrixScores(fixture, patterns: MatrixJurorPattern[])` for
  multi-juror / per-cell partial / per-cell empty seeding.
- `teardownScoringFixture` now deletes every id in `jurorIds` (falling back to
  `[jurorId]` if `jurorIds` is absent for legacy callers).
- Juror rows are resolved by `juror_name` match after insert, so a PostgREST
  return-order reshuffle can't swap J1 ↔ J2.

**C4 check:** `npx playwright test scoring-correctness.spec.ts rankings-export.spec.ts --workers=1` → 9/9 pass. No changes needed in existing C4/E4 tests.

## Aggregation path (tautology risk)

Both assertion paths drive **real UI render code**:

- **Analytics attainment cards:** `buildAttainmentCards()` runs inside
  `AnalyticsPage.jsx`, consuming `submittedData` from `useAdminContext()` (which
  flows from the real `getScores()` RPC). The test asserts on the rendered
  `data-att-rate` attribute, not a helper re-implementation. No tautology risk.
- **Heatmap cells:** `getCellDisplay()` + `computeVisibleAverages()` run inside
  `HeatmapPage.jsx`, driving `data-cell-state` / `data-avg` attributes. Same
  live-render path — no tautology.

The plan flagged that E1 originally tested a helper (`getOutcomeAttainmentTrends`)
directly, creating a tautology. E3 avoided that entirely by pinning assertions
to rendered DOM attributes, not exposed module functions.

## Deliberately-break evidence

Two tests had their expected values temporarily flipped to wrong values:

1. **Analytics PO_A attRate** → expected "99":
   ```
   Error: expect(locator).toHaveAttribute(expected) failed
   Locator:  getByTestId('analytics-att-card-PO_A_...')
   Expected: "99"
   - unexpected value "100"
   ```
2. **Heatmap J1×P1 cell score** → expected "999":
   ```
   Error: expect(locator).toHaveAttribute(expected) failed
   Locator:  getByTestId('heatmap-cell-…')
   Expected: "999"
   - unexpected value "130"
   ```

Both failed as required. Values were reverted to their correct expectations
(`"100"`, `"130"`) and the tests now pass.

A third, structural deliberately-break is baked into the suite as test #6: DB
mutation on a real score_sheet_item → fresh-context re-render asserts the cell
state flipped `scored → partial`. This proves the UI reads live data, not a
cached snapshot.

## Flake check

```
npx playwright test --grep "analytics|heatmap" --repeat-each=3 --workers=1
```

Result: **30 passed (2.0m)**, 0 flakes.

## Surprises

- **`AnalyticsPage` has no KPI strip.** The prompt referenced
  `analytics-kpi-{avg-score,submitted-count,in-progress-count,draft-count}` but
  those KPIs don't exist — the analytics page surfaces outcome attainment
  (cards + charts), not score_sheet status counts. The OverviewPage has a KPI
  strip. I pivoted to attainment cards as the nearest deterministic rendered
  value, which matched the plan's "adapt testids to what's rendered" directive.
- **Analytics attainment cards require `period_outcomes` + `period_criterion_outcome_maps`.**
  Without outcome mappings, `criteria[i].outcomes` is empty and the cards
  render the empty state (ghost rows). The fixture's new `outcomes: true` flag
  seeds two outcomes mapped 1:1 to criteria A/B.
- **`matrixJurors` filters by `scoreKeys.has(j.jurorId)`** in
  `AdminRouteLayout.jsx` — jurors without any score_sheet row are hidden. This
  is why the J2×P1 "empty" case still shows J2 in the grid (J2 has P2 scores).
  A juror with zero sheets would disappear from the heatmap entirely, which
  would turn a planned `data-cell-state="empty"` row into no row at all — a
  subtle constraint to know when designing fixtures.
- **Criterion keys vs IDs:** `period_criteria.id` is a UUID, but
  `criteriaConfig[i].id` (post-`getActiveCriteria`) is the criterion's `key`
  string. `buildLookup` keys cells by this string, and `outcomeValues(rows, key)`
  reads values by the same key. The fixture now exposes both
  `criteriaAId` (UUID for DB queries / maps) and `criteriaAKey` (string key).
- **Real-time cache invalidation requires a fresh context.** Reusing the same
  page after mutating DB items sometimes serves cached lookup values. Opening a
  new browser context via `browser.newContext()` guarantees a fresh data fetch
  on sign-in.

## Files changed

- `e2e/helpers/scoringFixture.ts` — multi-juror + outcome extensions + `writeMatrixScores`
- `e2e/admin/analytics.spec.ts` — 3 new E3 tests
- `e2e/admin/heatmap.spec.ts` — 3 new E3 tests
- `src/admin/features/analytics/AnalyticsPage.jsx` — 3 testids, 4 data-attrs
- `src/admin/features/heatmap/HeatmapPage.jsx` — 4 cell/avg testids, 5 data-attrs
- `docs/superpowers/plans/session-e-e2e-depth-phase-2/implementation_reports/E3-analytics-heatmap.md`
  (this report)
