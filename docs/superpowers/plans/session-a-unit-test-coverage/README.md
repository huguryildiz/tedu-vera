# Session A — Unit Test Coverage Expansion

**Goal:** Eliminate zero-coverage dark corners from the codebase. Primary metric: **count of `src/` files at 0% line coverage** should drop from **149 → < 30** by end of A6. Percentage-based coverage is tracked as a secondary indicator only.

**Parallel with:** Session B — E2E Test Expansion (see `../session-b-e2e-test-coverage/`)

---

## Calibration history

1. **Original plan (A1 start):** 40.47% → 80% lines. Math assumed velocity that turned out to be ~9× reality.
2. **Post-A2 recalibration:** 80% → 65% lines. Still assumed a rate that didn't hold up.
3. **Post-A3 audit (2026-04-24):** three sprints delivered only +1.3pp lines in reality — percentage-based targets were a wrong-shape metric for this codebase. Switched to **zero-coverage file count** as the steering metric.

Why percentage stopped being useful:

- v8 reporter "All files" row disagrees with threshold-checker by ~0.6pp → measurement noise > sprint signal
- Parallel feature work adds source lines (denominator grows) → coverage dilutes faster than it rises unless tests land on large files
- Small hooks (96–634 lines) tested thoroughly move the overall percentage by ~0.3pp each → low signal-per-sprint

Zero-coverage file count avoids all three: it's measurable by grep, monotone (only goes down unless a new 0% file appears), and focuses effort on the highest-risk surface (files with **no** safety net).

---

## Baseline and target (2026-04-24, post-A3)

| Metric | Post-A3 Current | A6 Target | Notes |
|---|---|---|---|
| **Zero-coverage files** (primary) | **149** | **< 30** | Eliminate ≥ 120 over A4-A6 |
| Lines % (secondary) | 41.77% | ≥ 48% | Expected byproduct; no threshold chase |
| Branches % (secondary) | 57.18% | ≥ 60% | — |
| Functions % (secondary) | 31.41% | ≥ 40% | — |
| Tests | 581 | ~900 | +320 |

**Zero-coverage file size distribution (2026-04-24):**

- 15 files > 300 lines (high-risk, hit first)
- ~50 files 100–300 lines
- ~84 files < 100 lines (utilities, small components)

**Largest offenders:** `GovernanceDrawers.jsx` (1310), `LandingPage.jsx` (1184), `PeriodsTable.jsx` (555), `ControlPanel.jsx` (458), `analyticsExport.js` (405).

**Source/test ratio:** 389 src files vs 160 test files — secondary target 1:1.8.

---

## Biggest 0-coverage gaps (priority targets)

From the coverage report:

| File | Lines | Current | Priority |
|---|---|---|---|
| `src/shared/lib/adminSession.js` | 105 | 0% | Sprint 1 |
| `src/shared/theme/ThemeProvider.jsx` | 43 | 0% | Sprint 1 |
| `src/shared/schemas/criteriaSchema.js` | 32 | 0% | Sprint 1 |
| `src/shared/ui/AdminLoader.jsx` | 240 | 0% | Sprint 5 |
| `src/admin/adminTourSteps.js` | 103 | 0% | Sprint 3 |
| `src/shared/ui/Icons.jsx` | — | 3.73% func | Sprint 5 |
| `src/shared/ui/HighlightTour.jsx` | — | 47.89% | Sprint 5 |
| `src/shared/ui/Tooltip.jsx` | — | 34.40% | Sprint 5 |

---

## Sprint plan

Metric per sprint: **number of zero-coverage files eliminated.** Each eliminated file requires at least a render/import smoke test plus ≥ 1 behaviour assertion (for tiny utility files with a single function, 1 behaviour test suffices).

| Sprint | Status | Scope | Zero-cov target | End-of-sprint count |
|---|---|---|---|---|
| A1 | ✅ done | `shared/lib/*` + `shared/schemas/*` + `shared/theme/*` zero-coverage cleanup | — (pre-metric) | — |
| A2 | ✅ done | Admin orchestration hooks (`useAdminData`, `useAdminRealtime`, `useAdminNav`, `useGlobalTableSort`, `useDeleteConfirm`, `useBackups`, `useAdminTeam`, `usePeriodOutcomes`) | — (pre-metric) | — |
| A3 | ✅ done | OOM remediation + audit correction; net +1 behaviour test beyond A2 baseline | baseline captured: **149** | 149 |
| A4 | ✅ done | **Largest single-file wins**: `GovernanceDrawers.jsx` (1310), `LandingPage.jsx` (1184), `DemoAdminLoader.jsx` (240), `adminTourSteps.js` (103), `analyticsExport.js` (405) + batch B (SortIcons×6, AvgDonut, SaveBar, ChartDataTable, StepperBar, PeriodCells) | −16 files | **133** |
| A5 | ✅ done | **Medium surfaces**: `PeriodsTable.jsx` (555), `ControlPanel.jsx` (458), `OutcomesTable.jsx` (266), `CriteriaManager.jsx` (222), remaining 300+ line 0% files | −29 files | **104** |
| A6 | ✅ done | **Long tail mop-up**: small utility components / modals / confirm dialogs under 150 lines. Eliminate as many as fit in the sprint; target absolute count threshold | target < 30 files | **26** |

Per-sprint verification command:

```bash
npm test -- --run --coverage 2>&1 \
  | grep -cE "^\s+\S+\s+\|\s+0\s+\|\s+0\s+\|\s+0\s+\|\s+0\s+\|"
```

Result at start of A4 should be **149**, at end of A4 **≤ 134**, and so on.

---

## Rules (coordination with Session B)

1. **No component signature or DOM changes.** Session A only adds tests. If a component needs refactoring for testability, flag it — don't change shape.
2. **`data-testid` attributes are Session B's territory.** If a new testid helps a unit test, document it in the sprint report and notify Session B before commit.
3. **Shared fixtures:** `src/test/qa-catalog.json` must stay in sync across sessions. Register every new `qaTest()` id here first.
4. **Threshold handling under the new metric:** Percentage thresholds in `vite.config.js` are kept at the post-A3 floor (lines 41 / statements 41 / branches 56 / functions 31). Raise them only if measured values climb comfortably above each floor (>2pp buffer). No sprint is blocked by a failed percentage ratchet; the primary success criterion is the zero-coverage file count.
5. **Per-sprint report:** Drop a file in `implementation_reports/A<N>-<slug>.md` summarising the files eliminated from zero-coverage, before/after count, and any files deliberately deferred.
6. **Quality bar per eliminated file:** A file counts as "eliminated from 0%" only if it has at least one **behaviour** assertion (render + `expect(...)` on output). Import-only smoke tests do NOT count — they game the metric.
7. **Depth discipline for UI tests:** On page/drawer/landing tests, cover render + happy path + one critical error/empty state. Do **not** exhaustively enumerate every internal branch — E2E owns that. Exhaustive branch coverage belongs on logic modules (helpers, selectors, pure functions, reducers).
8. **Stable mock references (learned A3 the hard way):** When mocking hooks, hoist return-value constants to module scope (`const EMPTY = Object.freeze([])`). Never return fresh object/array literals from a factory — they cause runaway re-renders and OOM in page tests.
9. **Relative mock path check (learned A3 the hard way):** In `__tests__/foo.test.jsx`, sibling-component mocks must use `../Component`, not `./Component`. The wrong path silently bypasses the mock and loads the real heavy component. Quick audit: `grep -n 'vi\.mock("\\./' src/**/__tests__/**/*.{js,jsx}`.

---

## Test conventions

- Use `qaTest()` instead of bare `it()`. Register the id in `src/test/qa-catalog.json` first.
- Mock `supabaseClient`: `vi.mock("../../lib/supabaseClient", () => ({ supabase: {} }))`.
- Test locations: `src/admin/__tests__/`, `src/jury/__tests__/`, `src/shared/__tests__/` (or feature-adjacent `__tests__/`).
- Never use native `<select>`; run `npm run check:no-native-select` after UI-adjacent work.

---

## Commands

```bash
npm test -- --run                    # fast feedback loop
npm test -- --run --coverage         # full coverage report (html at coverage/)
npm test -- --run --coverage src/shared/lib  # scoped coverage for a sprint
```

---

## Tracking

- Sprint reports: `implementation_reports/`
- Coverage history: append each sprint's `npm run coverage` summary to `coverage-history.md` (create on first use)
- Threshold history: tracked via git log on `vite.config.js`
