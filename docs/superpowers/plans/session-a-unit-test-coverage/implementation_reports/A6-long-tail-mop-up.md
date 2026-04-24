# A6 — Long-Tail Mop-Up

**Date:** 2026-04-24
**Goal:** Reduce zero-coverage source files from 104 → < 30

---

## Result

| Metric | Start of A6 | End of A6 |
|--------|------------|-----------|
| Zero-coverage files | 104 | **26** |
| Test files | 199 | 242 |
| Tests | 671 | 774 |

**Target met: 26 < 30.**

---

## Files eliminated from zero coverage

### Barrel / re-export modules (3 files)

| File | Test |
|------|------|
| `src/shared/criteria/index.js` | `BarrelsSimple.test.js` |
| `src/test/factories/index.js` | `BarrelsSimple.test.js` |
| `src/shared/storage/index.js` | `BarrelsSimple.test.js` |

### API barrels (2 files)

| File | Test |
|------|------|
| `src/shared/api.js` | `BarrelsApi.test.js` |
| `src/shared/api/admin/index.js` | `BarrelsApi.test.js` |

### Auth barrel (1 file)

| File | Test |
|------|------|
| `src/auth/index.js` | `AuthBarrel.test.js` |

### UI / layout components (5 files)

| File | Test |
|------|------|
| `src/shared/ui/Table.jsx` | `UiComponents.test.jsx` |
| `src/layouts/AuthRouteLayout.jsx` | `UiComponents.test.jsx` |
| `src/components/MaintenancePage.jsx` | `MaintenanceComponents.test.jsx` |
| `src/components/MaintenanceGate.jsx` | `MaintenanceComponents.test.jsx` |
| `src/jury/shared/DraggableThemeToggle.jsx` | `DraggableThemeToggle.test.jsx` |

### Admin feature components (20 files)

| File | Test |
|------|------|
| `src/admin/shared/ProjectAveragesCard.jsx` | `SharedSmallComponents.test.jsx` |
| `src/admin/shared/ExportPanel.jsx` | `SharedSmallComponents.test.jsx` |
| `src/admin/shared/JurorHeatmapCard.jsx` | `SharedSmallComponents.test.jsx` |
| `src/admin/features/criteria/InlineWeightEdit.jsx` | `PureCriteriaComponents.test.jsx` |
| `src/admin/features/criteria/OutcomePillSelector.jsx` | `PureCriteriaComponents.test.jsx` |
| `src/admin/features/outcomes/components/OutcomeRow.jsx` | `OutcomeRow.test.jsx` |
| `src/admin/layout/SetupProgressBanner.jsx` | `SetupProgressBanner.test.jsx` |
| `src/admin/features/organizations/TenantSwitcher.jsx` | `TenantSwitcher.test.jsx` |
| `src/admin/features/settings/SecuritySignalPill.jsx` | `SettingsComponents.test.jsx` |
| `src/admin/features/settings/UserAvatarMenu.jsx` | `SettingsComponents.test.jsx` |
| `src/admin/features/rankings/ScoresTab.jsx` | `ScoresTab.test.jsx` |
| `src/admin/features/periods/components/LifecycleGuide.jsx` | `PeriodSmallComponents.test.jsx` |
| `src/admin/features/periods/components/ReadinessPopover.jsx` | `PeriodSmallComponents.test.jsx` |
| `src/admin/features/heatmap/HeatmapMobileList.jsx` | `HeatmapMobileList.test.jsx` |
| `src/admin/features/reviews/ReviewMobileCard.jsx` | `ReviewMobileCard.test.jsx` |
| `src/admin/shared/PinPolicyDrawer.jsx` | `PinPolicyDrawer.test.jsx` |
| `src/admin/features/outcomes/components/FrameworkSetupPanel.jsx` | `FrameworkSetupPanel.test.jsx` |
| `src/auth/features/verify-email/EmailVerifyBanner.jsx` | `EmailVerifyBanner.test.jsx` |
| `src/auth/features/register/TenantSearchDropdown.jsx` | `TenantSearchDropdown.test.jsx` |
| `src/jury/features/evaluation/SegmentedBar.jsx` | `EvalSmallComponents.test.jsx` |

### Jury feature components (3 files)

| File | Test |
|------|------|
| `src/jury/features/evaluation/RubricSheet.jsx` | `EvalSmallComponents.test.jsx` |
| `src/jury/features/evaluation/ProjectDrawer.jsx` | `EvalSmallComponents.test.jsx` |
| `src/jury/shared/ThemeToggleIcon.jsx` | `ThemeComponents.test.jsx` |

---

## Bug fixes during A6

### `TenantSearchDropdown.jsx` — broken relative import

The component imported `useFloating` via a relative path (`../../shared/hooks/useFloating`) that resolved to `src/auth/shared/hooks/useFloating` (non-existent). Fixed to `@/shared/hooks/useFloating`. This was a latent production bug — the component would have failed to load in the browser.

---

## Remaining zero-coverage files (26)

Mostly large complex drawers and layout shells — high mock burden, low risk-adjusted ROI for unit tests:

- `CriterionEditor.jsx`, `EditCriteriaDrawer.jsx`, `RubricBandEditor.jsx`, `WeightBudgetBar.jsx` — criteria editing heavy UI
- `JurorScoresDrawer.jsx`, `ProjectScoresDrawer.jsx`, `JurorActivity.jsx` — score data display
- `CreateOrganizationDrawer.jsx`, `PeriodCriteriaDrawer.jsx`, `StarterCriteriaDrawer.jsx` — wizard drawers
- `AdminHeader.jsx`, `AdminSidebar.jsx` — layout shells (router-dependent, portal-heavy)
- `ImportCsvModal.jsx`, `ImportErrorsModal.jsx`, `GroupsDrawer.jsx`, `OutcomeEditor.jsx` — import/edit modals
- `SendResultModal.jsx`, `ExportReportModal.jsx`, `JurorsOptionsDrawer.jsx` — action modals
- `LandingTeamCard.jsx`, `PermissionsPanel.jsx` — landing + settings
- `JuryFlow.jsx`, `JuryGatePage.jsx`, `JuryRouteLayout.jsx` — jury orchestration (integration-test territory)
- `RootLayout.jsx` — root layout (needs full auth + router + realtime stack mocked)

These are not ignored; they are appropriate targets for Session B (E2E) or a dedicated A7 sprint focused on integration-style unit tests.

---

## QA catalog entries added

34 new entries appended to `src/test/qa-catalog.json` at sprint start.

---

## Mock patterns learned

- **`vi.mock` uses module IDs, not relative paths from the component.** Mock `@/shared/hooks/useFloating`, not `../../shared/hooks/useFloating`.
- **`useFloating` mocks must include `actualPlacement`.** `SecuritySignalPill` calls `actualPlacement.startsWith("top")` on mount — missing field crashes the component.
- **`supabase` mock for `MaintenanceGate` needs `removeChannel`.** The cleanup effect calls it on unmount.
- **Storage barrel exports individual functions, not namespace objects.** `src/shared/storage/index.js` does `export * from "./juryStorage"`, not `export { juryStorage }`.
