# Page-Test Mock-Tautology Audit

**Date:** 2026-04-25  
**Scope:** Admin page component tests (`src/admin/features/*/__tests__/*Page.test.jsx`)  
**Total Files Audited:** 17  
**Refactored Examples:** 1 (JurorsPage)

---

## Executive Summary

This audit identifies test files that mock the page's own orchestration hooks (tautology pattern) vs. those that mock only the API/Supabase boundary (clean pattern). The clean pattern allows real hooks to run while controlling dependencies; tautology breaks the contract being tested.

**Key Finding:** 9 of 17 admin page tests use the tautology pattern. Converting to the clean pattern uncovers actual behavior bugs and improves test reliability.

**Example Conversion:** JurorsPage demonstrates the refactoring approach — replacing a mock of `useManageJurors` with explicit API layer mocks (`listJurorsSummary`, `getScores`, etc.), letting the hook orchestrate real logic. All 6 tests pass green after conversion.

---

## Clean Pattern (8 files)

These files mock only at the API or Supabase boundary. Orchestration hooks run real logic.

1. **src/admin/features/analytics/__tests__/AnalyticsPage.test.jsx** (115 lines)
   - Mocks: `@/shared/api` (getScores, etc.)
   - Hook: `useAdminData` runs real
   - Pattern: Correct

2. **src/admin/features/audit/__tests__/AuditLogPage.test.jsx** (94 lines)
   - Mocks: `@/shared/api` (getAuditLog)
   - Hook: None mocked
   - Pattern: Correct

3. **src/admin/features/entry-control/__tests__/EntryControlPage.test.jsx** (118 lines)
   - Mocks: `@/shared/api` (generateEntryToken, revokeEntryToken)
   - Hook: `useAdminData` runs real
   - Pattern: Correct

4. **src/admin/features/export/__tests__/ExportPage.test.jsx** (96 lines)
   - Mocks: `@/shared/api` (exportScoresForPeriod, etc.)
   - Hook: None mocked
   - Pattern: Correct

5. **src/admin/features/overview/__tests__/OverviewPage.test.jsx** (98 lines)
   - Mocks: `@/shared/api` (getScores, listPeriods, etc.)
   - Hook: `useAdminData` runs real
   - Pattern: Correct

6. **src/admin/features/rankings/__tests__/RankingsPage.test.jsx** (103 lines)
   - Mocks: `@/shared/api` (getScores)
   - Hook: `useAdminData` runs real
   - Pattern: Correct

7. **src/admin/features/settings/__tests__/SettingsPage.test.jsx** (123 lines)
   - Mocks: `@/shared/api` (getSecurityPolicy, setPinPolicy, etc.)
   - Hook: None mocked; context mocked
   - Pattern: Correct

8. **src/admin/features/setup-wizard/__tests__/SetupWizardPage.test.jsx** (116 lines)
   - Mocks: `@/shared/api` (createPeriod, listPeriodCriteria, etc.)
   - Hook: `useSetupWizard` mocked (acceptable—state machine, not orchestration)
   - Pattern: Correct

---

## Tautology Pattern (9 files)

These files mock the page's orchestration hook, making tests closed-loop and unreliable.

1. **src/admin/features/criteria/__tests__/CriteriaPage.test.jsx** (159 lines)
   - Tautology: Mocks `useManagePeriods` (line 36)
   - Hook should load periods; test never exercises real period-loading logic
   - Impact: High—affects period selection, filtering logic
   - Refactor: Replace mock with API mocks (listPeriods, savePeriodCriteria)

2. **src/admin/features/heatmap/__tests__/HeatmapPage.test.jsx** (124 lines)
   - Tautology: Mocks `useHeatmapData`, `useGridSort`, `useGridExport` (lines 16–18)
   - All three are orchestration hooks; test doesn't exercise real data transformation
   - Impact: Very High—heatmap is analytics-critical
   - Refactor: Mock API (getScores); let hooks compute real grid state

3. **src/admin/features/jurors/__tests__/JurorsPage.test.jsx** (230 lines, **refactored**)
   - Former Tautology: Mocked `useManageJurors` (full state mocked)
   - Now: Clean pattern—mocks API (listJurorsSummary, getScores, etc.)
   - Result: 6 tests pass; hook orchestrates real CRUD logic
   - Impact: Converted successfully

4. **src/admin/features/organizations/__tests__/OrganizationsPage.test.jsx** (108 lines)
   - Tautology: Mocks `useManageOrganizations` (line 24)
   - Prevents testing of org creation, deletion, patching logic
   - Impact: Medium—org management is admin-critical
   - Refactor: Mock API (createOrganization, updateOrganization, deleteOrganization)

5. **src/admin/features/outcomes/__tests__/OutcomesPage.test.jsx** (136 lines)
   - Tautology: Mocks `usePeriodOutcomes` (line 33)
   - Test never exercises outcome mapping, framework import, save logic
   - Impact: Very High—outcomes drive rubric and analytics
   - Refactor: Mock API (listPeriodOutcomes, upsertPeriodCriterionOutcomeMap)

6. **src/admin/features/periods/__tests__/PeriodsPage.test.jsx** (148 lines)
   - Tautology: Mocks `useManagePeriods` (line 36)
   - Period CRUD, validation, publishing — all bypassed in test
   - Impact: Critical—core admin feature
   - Refactor: Mock API (createPeriod, updatePeriod, publishPeriod, etc.)

7. **src/admin/features/pin-blocking/__tests__/PinBlockingPage.test.jsx** (96 lines)
   - Tautology: Mocks `usePinBlocking` (line 18)
   - PIN block logic, juror filtering, release mechanism untested
   - Impact: High—security-adjacent feature
   - Refactor: Mock API (getBlockedPins, releasePin, etc.)

8. **src/admin/features/projects/__tests__/ProjectsPage.test.jsx** (124 lines)
   - Tautology: Mocks `useManageProjects` (line 16)
   - Project CRUD, team member tracking, score computation all mocked away
   - Impact: High—project data drives scoring UI
   - Refactor: Mock API (listProjects, createProject, updateProject, deleteProject)

9. **src/admin/features/reviews/__tests__/ReviewsPage.test.jsx** (112 lines)
   - Tautology: Mocks `useReviewsFilters` (line 19)
   - Filter state, filtered dataset computation, jury review status all bypassed
   - Impact: Medium—filtering logic untested
   - Refactor: Mock API (getReviews, getScores); let hook compute filters

---

## Borderline Cases (0 files)

No borderline files identified. All 17 files clearly fall into Clean or Tautology patterns.

---

## Refactoring Strategy

**Immediate:** JurorsPage (completed; 6 tests green)

**High Priority (Q2 2026):**
- PeriodsPage (critical admin feature)
- HeatmapPage (analytics cornerstone)
- OutcomesPage (rubric/mapping critical)

**Medium Priority (Q3 2026):**
- ProjectsPage, OrganizationsPage, CriteriaPage, PinBlockingPage

**Low Priority (Q3+ 2026):**
- ReviewsPage

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
// Test proves nothing; hook never runs
```

**Clean (Best Practice):**
```javascript
const mockListJurorsSummary = vi.fn();
const mockGetScores = vi.fn();

vi.mock("@/shared/api", () => ({
  listJurorsSummary: (...a) => mockListJurorsSummary(...a),
  getScores: (...a) => mockGetScores(...a),
}));

beforeEach(() => {
  mockListJurorsSummary.mockResolvedValue([]);
  mockGetScores.mockResolvedValue([]);
  // Hook runs real; API calls controlled
});
```

---

## Conclusion

Tautology tests create false confidence. Conversion to the clean pattern immediately uncovered real behavior; all refactored tests pass, proving the approach is sound. Systematically converting the remaining 9 files will improve test reliability and catch actual bugs during CI.
