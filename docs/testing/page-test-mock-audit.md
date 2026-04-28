# Page-Test Mock-Tautology Audit

**Original audit:** 2026-04-25
**Last refreshed:** 2026-04-28
**Scope:** Admin page component tests (`src/admin/features/*/__tests__/*Page.test.jsx`) + adjacent admin component tests

---

## Executive Summary

This audit tracks which test files mock the page's own orchestration
hooks (the **tautology pattern** — closed-loop, no real behavior under
test) vs. which mock only at the API or Supabase boundary (the **clean
pattern** — hook orchestrates real logic).

**Current state (2026-04-28):** **Zero tautology files remain.** All
page tests follow the clean pattern. The few remaining `vi.mock(".../use*")`
calls are justified leaf-hook or sibling-dependency mocks documented
in § "Justified Leaf-Hook Mocks" below.

---

## Refactoring History

### Original 9 tautology files (audit 2026-04-25)

All cleared — see commits `19330d10` (phase-4 tautology refactor),
`465e12fc` (drop final `useManagePeriods` mock from ProjectsPage):

| File | Hook unmocked | Status |
|---|---|---|
| `JurorsPage.test.jsx` | `useManageJurors` | ✅ done |
| `CriteriaPage.test.jsx` | `useManagePeriods` | ✅ done |
| `HeatmapPage.test.jsx` | `useHeatmapData`, `useGridSort`, `useGridExport` | ✅ done |
| `OrganizationsPage.test.jsx` | `useManageOrganizations` | ✅ done |
| `OutcomesPage.test.jsx` | `usePeriodOutcomes` | ✅ done |
| `PeriodsPage.test.jsx` | `useManagePeriods` | ✅ done |
| `PinBlockingPage.test.jsx` | `usePinBlocking` | ✅ done |
| `ProjectsPage.test.jsx` | `useManageProjects` | ✅ done |
| `ReviewsPage.test.jsx` | `useReviewsFilters` | ✅ done |

### Tautologies discovered in second sweep (2026-04-28)

These were not in the original 2026-04-25 inventory; they appeared
between the audit and the next sweep. All cleared in the same session
(`.claude/internal/plans/2026-04-28-remove-tautology-page-tests/`):

| File | Hook unmocked | Boundary mocks added |
|---|---|---|
| `AnalyticsPage.test.jsx` | `useAnalyticsData` | `getOutcomeTrends`, `getOutcomeAttainmentTrends` |
| `AuditLogPage.test.jsx` | `useAuditLogFilters` | `listAuditLogs`, `logExportInitiated` |
| `CriteriaManager.test.jsx` | `useCriteriaForm` | (real `criteriaFormHelpers` + `validatePeriodCriteria` run; no API calls in this hook) |
| `SettingsPage.test.jsx` | `useAdminTeam` | `listOrgAdminMembers` |

---

## Justified Leaf-Hook Mocks (NOT tautologies)

These `vi.mock("../use*", …)` calls remain by design. Each mocks
something at a legitimate boundary, not the page's own orchestration:

| File | Mocked hook | Reason it is justified |
|---|---|---|
| `JurorsPage.test.jsx` | `useAdminResponsiveTableMode` | Pure responsive utility (window.matchMedia wrapper); jsdom needs deterministic viewport mode. |
| `JurorsPage.test.jsx` | `useManagePeriods` | **Sibling** dependency — JurorsPage's *own* orchestration is `useManageJurors` (which runs real). `useManagePeriods` only supplies the period selector dropdown data; the page is not the unit-under-test for that hook. |
| `JurorsPage.test.jsx` | `useManageProjects` | Same: sibling dependency for the projects dropdown. |
| `CriteriaPage.test.jsx` | `useCriteriaExport` | Single-purpose export hook (only side effect: `logExportInitiated`); not orchestration. |
| `OutcomesPage.test.jsx` | `useOutcomesExport` | Same: single-purpose export hook. |
| `SetupWizardPage.test.jsx` | `useSetupWizard` | State-machine hook (no API side effects); audit explicitly approved this exception. |
| `useAdminData.test.js` | `useAdminRealtime` | This test's *unit under test* is `useAdminData`; `useAdminRealtime` is its child — boundary mock. |
| `filterPipeline.test.js` | `useReviewsFilters` | Selector test imports only the *pure utility exports* (`buildDateRange`, `toFiniteNumber`, etc.) from the same module that exports the hook. The mock returns those utilities only, not the hook state. |

**Rule of thumb:** mocking is acceptable when the mocked module is at
a real boundary (API, network, time, third-party) OR is a sibling
dependency of the unit-under-test rather than its own orchestration.
Mocking the page's *own* state-and-effects hook is the tautology
pattern this document tracks.

---

## Pattern Reference: Clean vs. Tautology

**Tautology (Anti-Pattern):**

```javascript
vi.mock("../useManageJurors", () => ({
  useManageJurors: () => ({
    jurors: [],
    loadJurors: vi.fn(),
    // ... all behavior mocked
  }),
}));
// Test proves nothing; hook never runs.
```

**Clean (Best Practice):**

```javascript
vi.mock("@/shared/api", () => ({
  listJurorsSummary: vi.fn().mockResolvedValue([]),
  getScores: vi.fn().mockResolvedValue([]),
  // ... boundary only
}));
beforeEach(() => { /* per-test data overrides */ });
// Hook runs real; API calls controlled at the boundary.
```

---

## How to keep it at zero

When adding a new admin page test, follow this checklist:

1. **Do NOT mock the page's own `use<X>` hook.** Mock its API
   dependencies instead.
2. **Mock at `@/shared/api`** (or `@/shared/lib/supabaseClient`) for
   network calls.
3. **Mock at `@/admin/shared/usePageRealtime`** for realtime — these
   are E2E-tested separately.
4. **Pre-existing leaf-hook mocks** (toast, card selection, floating,
   responsive mode) stay — they're at module/utility boundaries.
5. **Run** `grep -rn 'vi\.mock("\.\./use' src/` after the change. Every
   hit should appear in the "Justified Leaf-Hook Mocks" table above.
   If yours doesn't, you've added a tautology — refactor it before
   merging.

The audit-and-refresh cadence is on-demand: re-run the comprehensive
scan whenever a new page test is added or a hook is extracted from a
page (the second case is exactly how the four 2026-04-28 tautologies
appeared).

---

## Conclusion

Tautology tests create false confidence; converting them to the clean
pattern proves the page's hook contract works against a controlled
boundary instead of against itself. As of 2026-04-28 the entire admin
page test suite is at zero tautology files; the rule going forward is
"if it's a `use<X>` from the same folder as the page, do not mock it
unless it's on the justified leaf list."
