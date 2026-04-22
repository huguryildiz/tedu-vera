# Session 06 — A2.10–A2.13: analytics + heatmap + audit + entry-control

**Date:** 2026-04-22
**Commits:** `refactor(A2.10)` through `refactor(A2.13)` — 4 feature commits
**Branch:** main
**Build:** ✅ green after every commit

---

## Scope

Co-locate 4 admin features from flat `src/admin/{pages,hooks,components,modals,settings}/` into `src/admin/features/<name>/` with co-located CSS, following the A2.2 organizations pattern established in Session 04.

| Task | Feature | Commits |
|---|---|---|
| A2.10 | analytics | `refactor(A2.10): co-locate analytics feature to features/analytics/` |
| A2.11 | heatmap | `refactor(A2.11): co-locate heatmap feature to features/heatmap/` |
| A2.12 | audit | `refactor(A2.12): co-locate audit feature to features/audit/` |
| A2.13 | entry-control | `refactor(A2.13): co-locate entry-control feature to features/entry-control/` |

---

## Files Moved

### A2.10 — analytics (519 lines CSS)

| Old path | New path |
|---|---|
| `src/admin/pages/AnalyticsPage.jsx` | `src/admin/features/analytics/AnalyticsPage.jsx` |
| `src/admin/pages/AnalyticsTab.jsx` | `src/admin/features/analytics/AnalyticsTab.jsx` |
| `src/admin/hooks/useAnalyticsData.js` | `src/admin/features/analytics/useAnalyticsData.js` |
| `src/styles/pages/analytics.css` | `src/admin/features/analytics/AnalyticsPage.css` |

**Cross-feature decisions:**
- `ExportPanel` stays in `admin/components/` — used by 6+ features (periods, jurors, projects, outcomes, rankings, criteria, audit)
- `SendReportModal` stays in `admin/modals/` — used by 4+ features
- `AnalyticsTab.jsx` is a single-line barrel re-export (`export { default } from "./AnalyticsPage"`) — moved as-is

**Import fixes:**
- `useAnalyticsData`: `@/shared/api` (was `../../shared/api` — would resolve to `src/admin/shared/api`)
- `AnalyticsPage` dynamic imports: `import("@/shared/api")` and `import("@/admin/analytics/analyticsExport")` (3 occurrences, used `replace_all: true`)
- `src/admin/__tests__/smoke.test.jsx`: updated import path for `AnalyticsTab`

**Build errors caught:**
1. `Could not resolve "../../shared/api"` — dynamic import at line 325 not caught by static scan
2. `Could not resolve "../analytics/analyticsExport"` — 3 dynamic imports needed `@/admin/` prefix

---

### A2.11 — heatmap (719 lines CSS)

| Old path | New path |
|---|---|
| `src/admin/pages/HeatmapPage.jsx` | `src/admin/features/heatmap/HeatmapPage.jsx` |
| `src/admin/pages/HeatmapMobileList.jsx` | `src/admin/features/heatmap/HeatmapMobileList.jsx` |
| `src/admin/pages/mobileSort.js` | `src/admin/features/heatmap/mobileSort.js` |
| `src/admin/hooks/useHeatmapData.js` | `src/admin/features/heatmap/useHeatmapData.js` |
| `src/styles/pages/heatmap.css` | `src/admin/features/heatmap/HeatmapPage.css` |

**Discovery:** `mobileSort.js` lived in `src/admin/pages/` and was heatmap-only — confirmed by grep; co-located with heatmap feature.

**CSS note:** `HeatmapPage.jsx` had no direct CSS import — styles came through `main.css` only. Added explicit `import "./HeatmapPage.css"` after co-location.

**Import fixes:**
- `useHeatmapData`: `@/admin/utils/scoreHelpers` and `@/admin/selectors/gridSelectors`
- `HeatmapPage`: `@/admin/hooks/useAdminContext`, `@/admin/utils/scoreHelpers`, `./useHeatmapData`, `@/admin/hooks/useGridSort`, `@/admin/hooks/useGridExport`, `@/admin/utils/downloadTable`
- `src/admin/__tests__/mobileSort.test.js`: updated import path

---

### A2.12 — audit (489 lines CSS)

| Old path | New path |
|---|---|
| `src/admin/pages/AuditLogPage.jsx` | `src/admin/features/audit/AuditLogPage.jsx` |
| `src/admin/components/AuditEventDrawer.jsx` | `src/admin/features/audit/AuditEventDrawer.jsx` |
| `src/admin/hooks/useAuditLogFilters.js` | `src/admin/features/audit/useAuditLogFilters.js` |
| `src/styles/pages/audit-log.css` | `src/admin/features/audit/AuditLogPage.css` |

**CSS note:** `AuditLogPage.jsx` had no direct CSS import. Added `import "./AuditLogPage.css"` after co-location.

**Import fixes:**
- `AuditLogPage`: `@/admin/hooks/useAdminContext`, `./useAuditLogFilters`, `@/admin/hooks/usePageRealtime`, `@/admin/components/ExportPanel`, `@/admin/utils/auditUtils`, `@/admin/utils/auditColumns`, `./AuditEventDrawer`
- `AuditEventDrawer`: `@/admin/utils/auditUtils`
- `useAuditLogFilters`: `@/shared/api`, `@/admin/utils/auditUtils`, `@/admin/utils/auditColumns`, `@/admin/utils/downloadTable`

---

### A2.13 — entry-control (286 lines CSS)

| Old path | New path |
|---|---|
| `src/admin/pages/EntryControlPage.jsx` | `src/admin/features/entry-control/EntryControlPage.jsx` |
| `src/admin/modals/EntryTokenModal.jsx` | `src/admin/features/entry-control/EntryTokenModal.jsx` |
| `src/admin/modals/RevokeTokenModal.jsx` | `src/admin/features/entry-control/RevokeTokenModal.jsx` |
| `src/admin/settings/JuryEntryControlPanel.jsx` | `src/admin/features/entry-control/JuryEntryControlPanel.jsx` |
| `src/styles/pages/entry-control.css` | `src/admin/features/entry-control/EntryControlPage.css` |

**Note:** `JuryEntryControlPanel.jsx` was in `admin/settings/` with no consumers found by grep — moved to entry-control. `JuryRevokeConfirmDialog.jsx` stays in `admin/settings/` (A2.15 scope).

**Import fixes in `JuryEntryControlPanel.jsx`:**
- `../../assets/vera_logo.png` → `@/assets/vera_logo.png`
- `../../shared/api` → `@/shared/api`
- `./JuryRevokeConfirmDialog` → `@/admin/settings/JuryRevokeConfirmDialog`
- `../../shared/storage` → `@/shared/storage`

**EntryControlPage.jsx:** All imports already used `@/` — only added `import "./EntryControlPage.css"`.

---

## Router updates

```js
// src/router.jsx — lazy imports updated for A2.10–A2.13
const AnalyticsPage = lazy(() => import("@/admin/features/analytics/AnalyticsPage"));
const HeatmapPage   = lazy(() => import("@/admin/features/heatmap/HeatmapPage"));
const AuditLogPage  = lazy(() => import("@/admin/features/audit/AuditLogPage"));
const EntryControlPage = lazy(() => import("@/admin/features/entry-control/EntryControlPage"));
```

## main.css

Removed 4 `@import` lines:

```diff
-@import './pages/analytics.css';
-@import './pages/heatmap.css';
-@import './pages/audit-log.css';
-@import './pages/entry-control.css';
```

---

## Patterns & Gotchas

### Dynamic import resolution trap

Static import scanning (`grep -n "^import"`) misses dynamic `import()` calls inside component functions. Both `AnalyticsPage.jsx` examples:

```js
// Line 325 — resolved wrong path at build time
import("../../shared/api").then(...)        // ❌ resolves to src/admin/shared/api
import("@/shared/api").then(...)            // ✅
```

**Fix:** After every feature move, run `grep -n "import(" <file>` to catch dynamic imports separately.

### CSS not imported in page component

`HeatmapPage.jsx` and `AuditLogPage.jsx` relied on `main.css` for their styles. After co-location the CSS file is no longer on the `main.css` chain — the page component must import it explicitly.

**Pattern:** After `git mv`, always check:
```bash
grep -n "\.css" <FeaturePage.jsx>
```
If nothing found, add `import "./FeaturePage.css"`.

### `mobileSort.js` in pages/

`src/admin/pages/mobileSort.js` looked like a utility but was heatmap-only. `grep -rn "mobileSort" src/` showed a single consumer (`HeatmapMobileList.jsx`). Co-located with heatmap feature.

---

## Test impact

No new tests written in this session (Tests phase is B4 — future session). Two existing tests had import paths updated to avoid breakage:

- `src/admin/__tests__/smoke.test.jsx` — `AnalyticsTab` import path
- `src/admin/__tests__/mobileSort.test.js` — `mobileSort` import path

Pre-existing fail count unchanged (63 fails — all pre-existing from before this session).

---

## State after session

- **13 / 17 admin features co-located** (overview + organizations + jurors + periods + projects + criteria + outcomes + reviews + rankings + analytics + heatmap + audit + entry-control)
- **4 remaining:** pin-blocking, settings, setup-wizard, export (Session 07)
- `src/admin/pages/` still has files for pin-blocking, settings, setup-wizard, export page shells
- `src/styles/pages/` still has: `pin-lock.css`, `settings.css`, `export.css`, `setup-wizard.css`
