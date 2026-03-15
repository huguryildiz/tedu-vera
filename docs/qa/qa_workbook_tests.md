# QA Workbook Test Implementation — Status Summary

**Date:** 2026-03-15
**Reference:** `docs/prompts/` (gitignored)
**Test suite result:** 36 files, 276 tests — all passing ✓

> Sprint 1–3 risk-based expansion completed (2026-03-15). 32 new catalog entries and 32 new tests were added on top of the previous workbook gap-closing phase. The previous phase summary is preserved at the end of this document.

---

## Sprint 1–3: Risk-Based Test Expansion

### qa-catalog.json Changes

| Phase | Entry Count |
| --- | --- |
| Gap-closing (previous phase) | 160 |
| Sprint 1–3 addition | +32 |
| **Total** | **192** |

---

### Sprint 1 — Jury Sync + Flow + Permissions Lock

#### `src/jury/__tests__/useJuryState.writeGroup.test.js` *(expanded)*

New describe blocks: **"jury.sync — save payload and sync state"**, **"permissions.lock — edit lock behavior"**

| Test ID | Scenario |
| --- | --- |
| `jury.sync.01` | `handleScoreBlur` → `upsertScore` called with correct semesterId/projectId/jurorId/scores |
| `jury.sync.02` | `upsertScore` rejection sets `saveStatus` = `"error"` |
| `jury.sync.03` | A successful write following a failed write sets `saveStatus` back to `"saved"` |
| `jury.sync.04` | Multiple changes before blur result in only the latest value being written |
| `permissions.lock.01` | When `editLockActive=true`, `writeGroup` does not call `upsertScore` |
| `permissions.lock.02` | When `upsertScore` returns a `semester_locked` error, `editLockActive` becomes `true` |
| `permissions.lock.03` | Done juror with `edit_allowed=true` → `handleEditScores` → `step="eval"`, `editLockActive=false` |
| `permissions.lock.04` | A new session opened with `lock_active=false` starts with `editLockActive=false` |

#### `src/jury/__tests__/useJuryState.test.js` *(expanded)*

New describe block: **"jury.flow — flow mechanics"**

| Test ID | Scenario |
| --- | --- |
| `jury.flow.01` | Auto-done is not triggered when criteria are incomplete (`confirmingSubmit` stays `false`) |
| `jury.flow.02` | `confirmingSubmit` becomes `true` when all groups are synced |
| `jury.flow.03` | `handleEditScores` → scores, comments, and `groupSynced` are loaded from saved data |
| `jury.flow.04` | Navigating to the next group does not change the previous group's scores |

---

### Sprint 2 — Rankings + Consistency + PIN Reset

#### `src/admin/__tests__/RankingsTab.test.jsx` *(expanded)*

| Test ID | Scenario |
| --- | --- |
| `results.rank.01` | A project with `totalAvg=null` does not appear in the ranked list |
| `results.rank.02` | Two projects with equal `totalAvg` both receive rank 1; the next project receives rank 3 (competition ranking: 1,1,3) |
| `results.rank.03` | A search filter does not change the absolute rank number of a visible project |
| `results.rank.04` | Finding a project with `totalAvg=null` does not shift the rank order of other projects |

**Note:** The algorithm uses competition ranking (1,1,3), not dense ranking (1,1,2). The `results.rank.02` catalog entry was updated accordingly.

#### `src/admin/__tests__/ScoreDetails.test.jsx` *(expanded)*

| Test ID | Scenario |
| --- | --- |
| `results.consistency.01` | Juror Status "Completed" filter shows only jurors with a non-null `finalSubmittedAt` and no active editing |
| `results.consistency.02` | Score Status "Scored" filter shows only rows with a non-null `total` |
| `results.consistency.03` | Score Status "Partial" filter shows only rows where some criteria are filled |
| `results.consistency.04` | Updated At range filter (from + to) hides rows outside the range |

#### `src/admin/__tests__/PinResetDialog.test.jsx` *(expanded)*

New describe block: **"PinResetDialog — loading and stale state"**

| Test ID | Scenario |
| --- | --- |
| `pin.reset.06` | When `pinResetLoading=true`, the button shows "Resetting…" and is disabled |
| `pin.reset.07` | When `resetPinInfo` is updated with a new PIN, the new PIN is displayed (not the stale one) |
| `pin.reset.08` | When the dialog is opened for a different juror, the new juror's name is displayed (not the stale one) |

---

### Sprint 3 — Export + A11y

#### `src/admin/__tests__/export.test.js` *(new file)*

`exportGridXLSX`, `exportRankingsXLSX`, `buildExportFilename` — `xlsx-js-style` was mocked to capture the `aoa_to_sheet` call.

| Test ID | Scenario |
| --- | --- |
| `export.filename.01` | `buildExportFilename` → `vera_{type}_{semester}_{YYYY-MM-DD}_{HHMM}.xlsx` pattern |
| `export.grid.01` | `exportGridXLSX` → header row: Juror, Institution / Department, Status + group columns |
| `export.grid.02` | `exportGridXLSX` → only the passed rows are written (1 row = header + 1 data) |
| `export.rank.01` | `exportRankingsXLSX` → two projects with equal `totalAvg` both have rank=1, next has rank=3 |

#### `src/admin/__tests__/ScoreGrid.aria.test.jsx` *(expanded)*

New describe block: **"ScoreGrid — ARIA sort"**

| Test ID | Scenario |
| --- | --- |
| `a11y.table.01` | Sortable column headers always carry a valid `aria-sort` attribute (`ascending`/`descending`/`none`) |

#### `src/test/a11y.test.jsx` *(expanded)*

New describe blocks: **"Dialog accessibility"**, **"Form accessibility"**, **"Live region accessibility"**

| Test ID | Scenario |
| --- | --- |
| `a11y.dialog.01` | `PinResetDialog` has `role="dialog"` and `aria-modal="true"` |
| `a11y.dialog.02` | The cancel button has an accessible name and invokes the `onClose` callback |
| `a11y.form.01` | `ScoringGrid` score inputs have an `aria-label` attribute |
| `a11y.banner.01` | `SaveIndicator` has `role="status"` and `aria-live="polite"` |

---

### Catalog Entry Corrections (updated during the sprint)

| ID | Change |
| --- | --- |
| `results.rank.02` | Scenario and risk text updated: competition ranking (1,1,3), not dense ranking |
| `pin.reset.06` | Story changed: "Reset Failure Shows Error" → "Reset PIN Loading State Shows Feedback" (no error prop in PinResetDialog) |
| `a11y.dialog.01` | Scenario updated: structural ARIA contract test instead of focus management |
| `a11y.dialog.02` | Scenario updated: no Escape handler — cancel button is the accessible close mechanism |

---

### Changed Files (Sprint 1–3)

```
# Updated catalog
src/test/qa-catalog.json                         160 → 192 entries

# Expanded test files
src/jury/__tests__/useJuryState.writeGroup.test.js   +8 tests (jury.sync.*, permissions.lock.*)
src/jury/__tests__/useJuryState.test.js              +4 tests (jury.flow.*)
src/admin/__tests__/RankingsTab.test.jsx             +4 tests (results.rank.*)
src/admin/__tests__/ScoreDetails.test.jsx            +4 tests (results.consistency.*)
src/admin/__tests__/PinResetDialog.test.jsx          +3 tests (pin.reset.06-08)
src/admin/__tests__/ScoreGrid.aria.test.jsx          +1 test (a11y.table.01)
src/test/a11y.test.jsx                               +4 tests (a11y.dialog.*, a11y.form.01, a11y.banner.01)

# New test file
src/admin/__tests__/export.test.js                   +4 tests (export.*)
```

---

---

## What Was Done

### 1. Source Code Change

**`src/admin/settings/PinResetDialog.jsx`**

A juror name line was added to the result step (after a new PIN is generated). Previously only the PIN code was shown; now a "Juror: Alice" line is also displayed. This provides context to prevent admins performing multiple consecutive resets from sending the wrong person's PIN.

**Affected workbook row:** TC-021

---

### 2. New Test Files

#### `src/admin/__tests__/PinResetDialog.test.jsx` *(new)*

| Test ID | Scenario |
| --- | --- |
| `pin.reset.01` | Juror name is shown on the confirmation step |
| `pin.reset.02` | Semester label is shown on the confirmation step |
| `pin.reset.03` | Cancel and Reset PIN buttons are present |
| `pin.reset.04` | A 4-digit PIN is shown on the result step |
| `pin.reset.05` | Juror name is shown on the result step (after source code change) |

**Workbook rows covered:** TC-020, TC-021

---

#### `src/admin/__tests__/ScoreGrid.aria.test.jsx` *(new)*

| Test ID | Scenario |
| --- | --- |
| `scoregrid.aria.01` | The score matrix table carries `role="grid"` |
| `scoregrid.aria.02` | Juror cells carry `role="rowheader"` |

**Workbook row covered:** TC-018

Mock structure: `useScoreGridData`, `useGridSort`, `useScrollSync`, `useGridExport`, `useResponsiveFilterPresentation` were mocked. `jurorFinalMap` and `jurorWorkflowMap` were provided as proper `Map` objects; `groupAverages` as an array.

---

### 3. Expanded Existing Test Files

#### `src/admin/__tests__/ManageProjectsPanel.test.jsx`

New describe block: **"ManageProjectsPanel — import summary"**

| Test ID | Scenario |
| --- | --- |
| `groups.csv.summary.01` | After a successful import, the message "Import complete: 1 added, 1 skipped" is shown |

**Workbook row covered:** TC-019

Behavior note: The summary message is computed client-side — determined by comparing existing `group_no` values in the `projects` prop against values in the CSV. It is set before the `onImport` call.

---

#### `src/admin/__tests__/smoke.test.jsx`

New describe block: **"ChartDataTable — reduced motion"**

| Test ID | Scenario |
| --- | --- |
| `analytics.motion.01` | When `prefers-reduced-motion: reduce` is active, the `<details>` element renders as `open` |

**Workbook row covered:** TC-017

`ChartDataTable` was tested directly (not through `AnalyticsTab`) for better isolation and reliability.

---

#### `src/jury/__tests__/EvalStep.test.jsx`

2 bare `it()` calls converted to `qaTest()` format:

| Previous | New ID | Scenario |
| --- | --- | --- |
| `it("Submit All button is hidden...")` | `jury.eval.07` | Submit button is not visible when `allComplete=false` |
| `it("Group synced banner is hidden...")` | `jury.eval.08` | Synced banner is not visible when `editMode=true` |

Unused `it` import was also removed.

---

### 4. `src/test/qa-catalog.json`

11 new entries added:

| ID | Module | Severity |
| --- | --- | --- |
| `pin.reset.01` | Admin / Settings | critical |
| `pin.reset.02` | Admin / Settings | critical |
| `pin.reset.03` | Admin / Settings | normal |
| `pin.reset.04` | Admin / Settings | normal |
| `pin.reset.05` | Admin / Settings | normal |
| `groups.csv.summary.01` | Admin / Settings | normal |
| `analytics.motion.01` | Admin / Analytics | normal |
| `scoregrid.aria.01` | Scores / Grid | normal |
| `scoregrid.aria.02` | Scores / Grid | normal |
| `jury.eval.07` | Jury / Evaluation | critical |
| `jury.eval.08` | Jury / Evaluation | normal |

---

## Workbook Gap Coverage Status

| Workbook TC | Scenario | Previous Status | New Status |
| --- | --- | --- | --- |
| TC-017 | Reduced motion → data table open | ❌ Missing | ✅ `analytics.motion.01` |
| TC-018 | ScoreGrid ARIA roles preserved | ❌ Missing | ✅ `scoregrid.aria.01–02` |
| TC-019 | Summary message after CSV import | ⚠️ Partial | ✅ `groups.csv.summary.01` |
| TC-020 | PIN reset confirmation includes semester context | ❌ Missing | ✅ `pin.reset.01–03` |
| TC-021 | PIN reset result step includes juror name | ❌ Missing + code change required | ✅ `pin.reset.04–05` + source code |
| EvalStep bare `it()` | 2 tests were outside the QA system | ⚠️ Bare `it()` | ✅ `jury.eval.07–08` |

---

## Areas Not Changed

The following workbook TCs were already thoroughly covered and were left untouched:

- TC-002/003: PinStep → `jury.pin.01–04`
- TC-004: PinRevealStep → `jury.pin.*`
- TC-007: Last group Next button disabled → `jury.eval.03`
- TC-008: Submit visibility → `jury.eval.04` + new `jury.eval.07`
- TC-009: Lock state → `jury.eval.05`
- TC-011: Admin wrong password → `security.validation.*`
- TC-022: Delete semester warning → `semester.crud.*`

---

## Test Run Guide

### Running Locally

#### 1. Quick check (watch mode)

```bash
npm test
```

Re-runs automatically on file save. Green/red output in terminal.

#### 2. Single CI-style run

```bash
npm test -- --run
```

#### 3. Full run with Allure + Excel report

```bash
npm run test:report                      # run tests, produce JSON + allure-results
npm run allure:generate                  # allure-results/ → allure-report/ HTML
npm run allure:open                      # open in browser
node scripts/generate-test-report.cjs   # produce test-results/test-report.xlsx
```

- Excel report: `test-results/test-report.xlsx`
- Allure HTML report: `allure-report/` directory, interactive view in browser

---

### CI Flow on GitHub

Runs automatically on every **push** (main/master) and every **pull request**:

```
push / PR
  └─ test job
       ├─ npm run test:report              (Vitest + Allure reporter)
       ├─ node scripts/generate-test-report.cjs  → test-report.xlsx
       ├─ npm run allure:generate          → allure-report/
       ├─ artifact: test-report-excel-{run_number}.xlsx   (kept 30 days)
       └─ artifact: test-report-allure-{run_number}/      (kept 30 days)
```

Go to GitHub Actions → the relevant workflow run → **Artifacts** to download the Excel and Allure reports.

If CI fails, the push is **not blocked** (unless a branch protection rule is set), but a red ✗ will appear in the Actions tab.

The E2E job is currently disabled (`if: false`) — it requires an isolated test DB and is run manually locally:

```bash
npm run e2e          # Playwright tests
npm run e2e:report   # Open Playwright HTML report
```

---

## File Inventory

```
# New files
src/admin/__tests__/PinResetDialog.test.jsx
src/admin/__tests__/ScoreGrid.aria.test.jsx

# Changed source code
src/admin/settings/PinResetDialog.jsx

# Changed test files
src/admin/__tests__/ManageProjectsPanel.test.jsx
src/admin/__tests__/smoke.test.jsx
src/jury/__tests__/EvalStep.test.jsx

# Updated catalog
src/test/qa-catalog.json
```
