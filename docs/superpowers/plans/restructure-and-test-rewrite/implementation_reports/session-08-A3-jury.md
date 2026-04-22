# Session 08 — A3.1–A3.10: Jury Restructure

**Date:** 2026-04-22
**Commits:** `refactor(A3.1)` through `refactor(A3.10)` + 1 test fix — 11 commits
**Branch:** main
**Build:** ✅ green after every commit

---

## Scope

Co-locate all 9 jury step features into `src/jury/features/<name>/` and consolidate all shared jury infrastructure into `src/jury/shared/`, completing **Faz A3** entirely.

| Task | Feature | Commit |
|---|---|---|
| A3.1 | arrival | `8a8c830 refactor(A3.1): co-locate arrival feature to features/arrival/` |
| A3.2 | identity | `f9c6c7e refactor(A3.2): co-locate identity feature to features/identity/` |
| A3.3 | period-select | `3b5d289 refactor(A3.3): co-locate period-select feature to features/period-select/` |
| A3.4 | pin | `6c31be4 refactor(A3.4): co-locate pin feature to features/pin/` |
| A3.5 | pin-reveal | `4226f53 refactor(A3.5): co-locate pin-reveal feature to features/pin-reveal/` |
| A3.6 | progress | `12d3ea7 refactor(A3.6): co-locate progress feature to features/progress/` |
| A3.7 | evaluation | `518c228 refactor(A3.7): co-locate evaluation feature to features/evaluation/` |
| A3.8 | complete | `2e841b7 refactor(A3.8): co-locate complete feature to features/complete/` |
| A3.9 | lock | `e1adc9b refactor(A3.9): co-locate lock feature to features/lock/` |
| A3.10 | jury/shared | `95e4f13 refactor(A3.10): consolidate jury/shared/ layer` |

---

## Files Moved

### A3.1 — arrival

| Old path | New path |
|---|---|
| `src/jury/steps/ArrivalStep.jsx` | `src/jury/features/arrival/ArrivalStep.jsx` |
| `src/styles/jury-arrival.css` | `src/jury/features/arrival/ArrivalStep.css` |

**Import fixes in `ArrivalStep.jsx`:**
- Asset paths: `../../assets/...` → `../../../assets/...` (+1 level)
- Added `import "./ArrivalStep.css"`
- Removed `import "../../styles/jury.css"` (globally loaded via `main.css`)

**`JuryFlow.jsx` update:** `./steps/ArrivalStep` → `./features/arrival/ArrivalStep`
**`main.css` update:** Removed `@import './jury-arrival.css'` (CSS is now self-contained in feature)

---

### A3.2 — identity

| Old path | New path |
|---|---|
| `src/jury/steps/IdentityStep.jsx` | `src/jury/features/identity/IdentityStep.jsx` |

**Import fixes:** Asset paths adjusted (+1 level); `@/` aliases already correct; removed `jury.css` import.

---

### A3.3 — period-select

| Old path | New path |
|---|---|
| `src/jury/steps/SemesterStep.jsx` | `src/jury/features/period-select/SemesterStep.jsx` |

**Import fixes:** Removed `jury.css` import; `@/shared/lib/dateUtils` alias already correct.

---

### A3.4 — pin

| Old path | New path |
|---|---|
| `src/jury/steps/PinStep.jsx` | `src/jury/features/pin/PinStep.jsx` |

**Import fixes:** `FbAlert` → `@/shared/ui/FbAlert`; removed `jury.css` import.

---

### A3.5 — pin-reveal

| Old path | New path |
|---|---|
| `src/jury/steps/PinRevealStep.jsx` | `src/jury/features/pin-reveal/PinRevealStep.jsx` |

**Import fixes:** Removed `jury.css` import; `SpotlightTour` path later updated in A3.10.

---

### A3.6 — progress

| Old path | New path |
|---|---|
| `src/jury/steps/ProgressStep.jsx` | `src/jury/features/progress/ProgressStep.jsx` |

**Import fixes:** Removed `jury.css` import; `SpotlightTour` path later updated in A3.10.

---

### A3.7 — evaluation (largest feature)

| Old path | New path |
|---|---|
| `src/jury/steps/EvalStep.jsx` | `src/jury/features/evaluation/EvalStep.jsx` |
| `src/jury/components/RubricSheet.jsx` | `src/jury/features/evaluation/RubricSheet.jsx` |
| `src/jury/components/ProjectDrawer.jsx` | `src/jury/features/evaluation/ProjectDrawer.jsx` |
| `src/jury/components/SegmentedBar.jsx` | `src/jury/features/evaluation/SegmentedBar.jsx` |

**Import fixes in `EvalStep.jsx`:** `@/` aliases for `FbAlert`, `StudentNames`; sibling imports (`./RubricSheet`, `./SegmentedBar`, `./ProjectDrawer`) unchanged; removed `jury.css`.

**Import fixes in `ProjectDrawer.jsx`:** `../utils/scoreState` → `../../utils/scoreState` (then updated to `../../shared/scoreState` in A3.10); `SpotlightTour` updated in A3.10.

**Import fixes in `SegmentedBar.jsx`:** Same scoreState path (updated in A3.10).

---

### A3.8 — complete

| Old path | New path |
|---|---|
| `src/jury/steps/DoneStep.jsx` | `src/jury/features/complete/DoneStep.jsx` |

**Import fixes:** `submitJuryFeedback`, `requestScoreEdit` → `@/shared/api`; removed `jury.css`.

---

### A3.9 — lock

| Old path | New path |
|---|---|
| `src/jury/steps/LockedStep.jsx` | `src/jury/features/lock/LockedStep.jsx` |

**Import fixes:** `@/shared/api/juryApi` already aliased; removed `jury.css`.

---

### A3.10 — jury/shared (all shared infrastructure)

**Hooks** — moved from `src/jury/hooks/` → `src/jury/shared/`:

| File |
|---|
| `useJurorIdentity.js` |
| `useJurorSession.js` |
| `useJuryAutosave.js` |
| `useJuryEditState.js` |
| `useJuryHandlers.js` |
| `useJuryLifecycleHandlers.js` |
| `useJuryLoading.js` |
| `useJuryScoreHandlers.js` |
| `useJuryScoring.js` |
| `useJurySessionHandlers.js` |
| `useJuryWorkflow.js` |
| `juryHandlerUtils.js` |

**Utils** — moved from `src/jury/utils/` → `src/jury/shared/`:

| File |
|---|
| `scoreState.js` |
| `scoreSnapshot.js` |
| `periodSelection.js` |
| `progress.js` |

**Shared components** — moved from `src/jury/components/` → `src/jury/shared/`:

| File |
|---|
| `DraggableThemeToggle.jsx` |
| `SpotlightTour.jsx` |
| `StepperBar.jsx` |
| `ThemeToggleIcon.jsx` |

**Orchestrator** — moved:
- `src/jury/useJuryState.js` → `src/jury/shared/useJuryState.js`
- `src/jury/juryPreloadCache.js` → `src/jury/shared/juryPreloadCache.js`

**Guard** — moved from `src/guards/` → `src/jury/shared/`:
- `JuryGuard.jsx` (note: `AuthGuard.jsx` stays in `src/guards/`)

**CSS** — moved and renamed:
- `src/styles/jury.css` (4021 lines) → `src/jury/shared/jury-base.css`

**Test** — moved:
- `src/jury/utils/periodSelection.test.js` → `src/jury/__tests__/periodSelection.test.js`

**Hook import fixes (bulk):** Inside each moved hook, `../utils/` → `./` and `../juryPreloadCache` → `./juryPreloadCache` (both were 1-level refs within `jury/`, now same-dir).

**Consumer updates:**

| Consumer | Change |
|---|---|
| `src/layouts/RootLayout.jsx` | `@/jury/components/DraggableThemeToggle` → `@/jury/shared/DraggableThemeToggle` |
| `src/layouts/AdminRouteLayout.jsx` | Same as above |
| `src/router.jsx` | `./guards/JuryGuard` → `@/jury/shared/JuryGuard` |
| `src/styles/main.css` | `@import './jury.css'` → `@import '../jury/shared/jury-base.css'` |
| `src/jury/JuryFlow.jsx` | `./useJuryState` → `./shared/useJuryState`; `./components/StepperBar` → `./shared/StepperBar` |
| `src/jury/JuryGatePage.jsx` | `./juryPreloadCache` → `./shared/juryPreloadCache`; removed `../styles/jury.css` import |
| `src/admin/features/periods/useManagePeriods.js` | `@/jury/utils/periodSelection` → `@/jury/shared/periodSelection` |
| `src/admin/hooks/useAdminData.js` | `../../jury/utils/periodSelection` → `../../jury/shared/periodSelection` |
| `src/jury/features/evaluation/ProjectDrawer.jsx` | `../../utils/scoreState` → `../../shared/scoreState` |
| `src/jury/features/evaluation/SegmentedBar.jsx` | `../../utils/scoreState` → `../../shared/scoreState` |
| Features with SpotlightTour (bulk fix) | `../../components/SpotlightTour` → `../../shared/SpotlightTour` (6 files) |

**Test import updates:**

| Test file | Change |
|---|---|
| `jury/__tests__/scoreState.regression.test.js` | `../utils/scoreState` → `../shared/scoreState` |
| `jury/__tests__/periodSelection.test.js` | `./periodSelection` → `../shared/periodSelection` |
| `jury/__tests__/useJuryState.test.js` | `../useJuryState` → `../shared/useJuryState` |
| `jury/__tests__/useJuryState.writeGroup.test.js` | `../useJuryState` → `../shared/useJuryState` |
| `jury/__tests__/IdentityStep.test.jsx` | `../steps/IdentityStep` → `../features/identity/IdentityStep` |
| `jury/__tests__/DoneStep.test.jsx` | `../steps/DoneStep.jsx` → `../features/complete/DoneStep.jsx` |
| `shared/__tests__/tenantIsolation.test.js` | `../../jury/hooks/use*` → `../../jury/shared/use*` |

**Empty directories removed after all moves:**
- `src/jury/steps/`
- `src/jury/hooks/`
- `src/jury/components/`
- `src/jury/utils/`

---

## Patterns & Gotchas

### SpotlightTour bulk fix

6 feature files all had `../../components/SpotlightTour` after their moves. Fixed in a single `find + xargs sed` pass:

```bash
find src/jury/features -name "*.jsx" | xargs sed -i '' \
  's|../../components/SpotlightTour|../../shared/SpotlightTour|g'
```

### Hook import depth stays the same

Moving hooks from `jury/hooks/` to `jury/shared/` does NOT change the `../../shared/api` depth — both dirs are 1 level inside `jury/`. Only `../utils/` and `../juryPreloadCache` refs needed updating (same-dir → `./`).

### JuryFlow.jsx stays at jury/ root

Decision: `JuryFlow.jsx` was NOT moved to `jury/shared/` to avoid router changes. Only its imports of `useJuryState` and `StepperBar` needed updating.

### ProjectDrawer/SegmentedBar two-stage fix

When these files moved from `jury/components/` to `jury/features/evaluation/` in A3.7, their `scoreState` import was updated to `../../utils/scoreState` (correct at that time). After A3.10 moved `utils/` to `shared/`, they needed a second fix to `../../shared/scoreState`.

### JuryGatePage double fix

`JuryGatePage.jsx` (stays at `src/jury/`) had two stale references:
1. `import "../../styles/jury.css"` — removed (now loaded via `main.css`)
2. `import { setJuryPreload } from "./juryPreloadCache"` → `"./shared/juryPreloadCache"`

### Pre-existing test failures

The `useJuryState.writeGroup.test.js` and `useJuryState.test.js` failures were pre-existing (verified via `git stash`). Our changes did not introduce them.

---

## State after session

- **9 / 9 jury features co-located** — Faz A3 complete
- `src/jury/features/` — arrival, identity, period-select, pin, pin-reveal, progress, evaluation, complete, lock
- `src/jury/shared/` — all hooks, utils, shared components, JuryGuard, jury-base.css, SpotlightTour, StepperBar, DraggableThemeToggle, ThemeToggleIcon, juryPreloadCache, periodSelection, scoreState, scoreSnapshot, progress
- `src/jury/steps/`, `hooks/`, `components/`, `utils/` — **deleted**
- `src/guards/` — still contains `AuthGuard.jsx` (only JuryGuard moved)
- **Next session (9):** A4 — auth restructure (9 auth screens → `src/auth/features/`)
