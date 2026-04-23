# Session A — Unit Test Coverage Expansion

**Goal:** Raise unit test coverage from the current **40.47% lines / 31.05% functions** baseline to a healthy SaaS target of **80% lines / 60% functions**, and ratchet the vitest CI threshold along with it.

**Parallel with:** Session B — E2E Test Expansion (see `../session-b-e2e-test-coverage/` once created)

---

## Baseline (2026-04-23)

Captured from `npm test -- --run --coverage`:

| Metric | Current | Target | Delta |
|---|---|---|---|
| Lines | 40.47% | 80% | +39.5 pts |
| Branches | 55.62% | 70% | +14.4 pts |
| Functions | 31.05% | 60% | +28.9 pts |
| Statements | 40.47% | 80% | +39.5 pts |
| Test files | 147 | ~300 | +150 |
| Tests | 463 | ~900 | +450 |

**Source/test ratio:** 393 src files vs 147 test files (1 test per 2.7 src files → target 1:1.3).

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

## Sprint plan (6 sprints)

Each sprint targets **+5-7% line coverage** and ends with a ratcheted vitest threshold in `vite.config.js`.

| Sprint | Scope | Expected gain | Cumulative line cov |
|---|---|---|---|
| A1 | `shared/lib/*` + `shared/schemas/*` + `shared/theme/*` zero-coverage cleanup | +6% | ~46% |
| A2 | Admin orchestration hooks: `useSettingsCrud`, `useAdminData`, `useAdminRealtime`, `useScoreGridData` | +8% | ~54% |
| A3 | Admin feature pages: drawer/modal branch coverage, filter hooks, tour steps | +7% | ~61% |
| A4 | Jury flow edges: expired session, lock behaviour, `writeGroup` dedup, offline paths | +5% | ~66% |
| A5 | UI components: `Icons`, `AdminLoader`, `HighlightTour`, `Tooltip`, `LevelPill`, `FloatingMenu` | +8% | ~74% |
| A6 | Gap-fill pass + API wrapper edge cases + threshold raise to 80/60/70/80 + CI gate enforcement | +6% | ~80% |

---

## Rules (coordination with Session B)

1. **No component signature or DOM changes.** Session A only adds tests. If a component needs refactoring for testability, flag it — don't change shape.
2. **`data-testid` attributes are Session B's territory.** If a new testid helps a unit test, document it in the sprint report and notify Session B before commit.
3. **Shared fixtures:** `src/test/qa-catalog.json` must stay in sync across sessions. Register every new `qaTest()` id here first.
4. **CI threshold ratchet:** Every sprint ends with a bump in `vite.config.js` coverage.thresholds. Never lower a threshold.
5. **Per-sprint report:** Drop a file in `implementation_reports/A<N>-<slug>.md` summarising files touched, tests added, coverage delta.

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
