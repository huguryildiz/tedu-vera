# A5 — Medium Surfaces

**Sprint:** Session A — Unit Test Coverage
**Date:** 2026-04-24
**Status:** Complete

---

## Scope

Goal: eliminate ≥ 29 zero-coverage files (133 → ≤ 104). Final result: **133 → 104** (29 files eliminated, target exactly met).

Four priority files were completed before this session (PeriodsTable, JuryEntryControlPanel, OutcomesTable, CriteriaManager). The bonus batch of smaller files was tackled in this session.

---

## Priority Files (completed pre-session)

| File | Lines | Tests added |
|------|-------|-------------|
| `src/admin/features/periods/PeriodsTable.jsx` | 555 | 3–4 render + interaction tests |
| `src/admin/features/entry-control/JuryEntryControlPanel.jsx` | 458 | 3–4 render tests |
| `src/admin/features/outcomes/OutcomesTable.jsx` | 266 | 3 tests |
| `src/admin/features/criteria/CriteriaManager.jsx` | 222 | 2–3 tests |

---

## Bonus Batch (this session)

### Pure JS modules

| File | Lines | Test file | Key behavior tested |
|------|-------|-----------|---------------------|
| `src/admin/selectors/scoreSelectors.js` | ~60 | `scoreSelectors.test.js` | `deriveScoreStatus`: completed / submitted / not_started / in_progress |
| `src/admin/utils/computeSecuritySignal.js` | ~70 | `computeSecuritySignal.test.js` | secure / risk (6 sessions) / loading |
| `src/charts/chartCopy.js` | ~15 | `chartCopy.test.js` | expected keys present |
| `src/admin/utils/downloadTable.js` | ~120 | `downloadTable.test.js` | `arrayBufferToBase64` encodes correctly |
| `src/shared/scrollIndicators.js` | ~40 | `scrollIndicators.test.js` | returns cleanup fn; cleanup is idempotent |
| `src/shared/api/admin/emailVerification.js` | ~35 | `emailVerification.test.js` | send + confirm call correct edge fn names |
| `src/shared/api/admin/maintenance.js` | ~30 | `maintenance.test.js` | `getMaintenanceStatus` + `cancelMaintenance` RPC calls |
| `src/shared/api/admin/backups.js` | ~80 | `backups.test.js` | `listBackups` RPC + `getBackupSignedUrl` signed URL |
| `src/shared/api/admin/wizardHelpers.js` | ~60 | `wizardHelpers.test.js` | `applyStandardFramework` calls createFramework + outcomes |
| `src/landing/components/showcase/showcaseData.js` | 138 | `showcaseData.test.js` | PROJECTS / JURORS / CRITERIA have required props |
| `src/admin/analytics/captureChartImage.js` | 32 | `captureChartImage.test.js` | null for missing element (guard path) |
| `src/admin/analytics/captureSvgForPdf.js` | 115 | `captureSvgForPdf.test.js` | false for missing element (guard path) |
| `src/admin/utils/exportXLSX.js` | 448 | `exportXLSX.test.js` | `buildExportFilename` joins parts correctly |

### React hooks

| File | Lines | Test file | Key behavior tested |
|------|-------|-----------|---------------------|
| `src/admin/shared/useAdminContext.js` | ~30 | `useAdminContext.test.jsx` | derives organizationId / periodName / threshold |
| `src/admin/features/jurors/useAdminResponsiveTableMode.js` | ~20 | `useAdminResponsiveTableMode.test.jsx` | returns shouldUseCardLayout + shouldUseTableLayout |
| `src/admin/features/heatmap/useGridSort.js` | ~80 | `useGridSort.test.jsx` | initial state + toggleJurorSort direction cycling |
| `src/admin/features/criteria/useCriteriaExport.js` | 102 | `useCriteriaExport.test.jsx` | returns generateFile + handleExport |
| `src/admin/features/outcomes/useOutcomesExport.js` | 105 | `useOutcomesExport.test.jsx` | returns generateFile + handleExport |
| `src/admin/features/heatmap/useGridExport.js` | 107 | `useGridExport.test.jsx` | returns requestExport callback |
| `src/admin/shared/usePageRealtime.js` | 51 | `usePageRealtime.test.jsx` | skips supabase.channel when organizationId is null |

### Small JSX components

| File | Test file | Key behavior tested |
|------|-----------|---------------------|
| `src/admin/shared/ScoreStatusPill.jsx` | `ScoreStatusPill.test.jsx` | scored / partial / unknown → correct label |
| `src/admin/shared/DangerIconButton.jsx` | `DangerIconButton.test.jsx` | renders ariaLabel; disabled state |
| `src/admin/features/settings/LastActivity.jsx` | `LastActivity.test.jsx` | renders formatted ts; null input |
| `src/admin/features/periods/CompletionStrip.jsx` | `CompletionStrip.test.jsx` | counts + pending; null metrics |

---

## Technical Issues Resolved

### `vi.mock()` path arithmetic for `__tests__` subdirectories

All API tests in `src/shared/api/admin/__tests__/` were initially written with mock paths relative to the **source file's import** (e.g. `"../core/client"`), but `vi.mock()` resolves paths relative to the **test file**. From `src/shared/api/admin/__tests__/foo.test.js`, the correct paths are:

| Target module | Wrong | Correct |
|---------------|-------|---------|
| `src/shared/lib/supabaseClient` | `"../../lib/supabaseClient"` | `"../../../lib/supabaseClient"` |
| `src/shared/api/core/client` | `"../core/client"` | `"../../core/client"` |
| `src/shared/api/core/invokeEdgeFunction` | `"../core/invokeEdgeFunction"` | `"../../core/invokeEdgeFunction"` |
| `src/shared/api/admin/frameworks` | `"./frameworks"` | `"../frameworks"` |

### `vi.hoisted()` required for factory referencing top-level variables

`backups.test.js` initially defined `mockStorage` at module scope and referenced it inside a `vi.mock()` factory. Because `vi.mock()` is hoisted before variable initializers, this caused `ReferenceError: Cannot access 'mockStorage' before initialization`. Fix: wrap both `mockRpc` and `mockStorage` in `vi.hoisted()`.

### `window` cannot be stubbed in jsdom

`scrollIndicators.test.js` initially tested the `typeof window === "undefined"` branch by trying `Object.defineProperty(window, 'window', ...)`. jsdom marks `window` as non-configurable (`Cannot redefine property: window`). Replaced with a cleanup idempotency test: calling `cleanup()` twice must not throw.

---

## Catalog Growth

| Sprint | Catalog entries |
|--------|----------------|
| Pre-A5 | 704 |
| Post-A5 | 714 |

**New IDs added:** `coverage.score-selectors.*` (4), `coverage.compute-security-signal.*` (3), `coverage.chart-copy.*` (1), `coverage.download-table.*` (1), `coverage.scroll-indicators.*` (2), `coverage.score-status-pill.*` (3), `coverage.danger-icon-button.*` (2), `coverage.last-activity.*` (2), `coverage.completion-strip.*` (2), `coverage.email-verification.*` (2), `coverage.maintenance.*` (2), `coverage.backups.*` (2), `coverage.wizard-helpers.*` (1), `coverage.use-admin-context.*` (1), `coverage.use-admin-responsive-table-mode.*` (1), `coverage.use-grid-sort.*` (2), `coverage.showcase-data.*` (1), `coverage.capture-chart-image.*` (1), `coverage.capture-svg-for-pdf.*` (1), `coverage.use-criteria-export.*` (1), `coverage.use-outcomes-export.*` (1), `coverage.use-grid-export.*` (1), `coverage.use-page-realtime.*` (1), `coverage.export-xlsx.*` (1).

---

## Final Metrics

| Metric | Before A5 | After A5 | Delta |
|--------|-----------|----------|-------|
| Test files | 171 | 199 | +28 |
| Tests | 618 | 671 | +53 |
| Zero-coverage files | 133 | 104 | −29 |
| Statements | 45.55% | 49.12% | +3.57pp |
| Branches | 57.30% | 57.26% | −0.04pp |
| Functions | 33.56% | 34.69% | +1.13pp |
| Lines | 45.55% | 49.12% | +3.57pp |
