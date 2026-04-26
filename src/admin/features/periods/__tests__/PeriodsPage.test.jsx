// PeriodsPage — minimal smoke render only.
//
// Architecture spec § 6 anti-pattern #6 ("one mega setup that mocks every
// module") and #8 ("test for coverage"). The previous file mocked every
// child component, then asserted that hardcoded copy strings rendered.
// None of those assertions catch a behavioral regression — the page is
// covered end-to-end by:
//   • e2e/admin/periods.spec.ts (CRUD + lifecycle journeys)
//   • e2e/admin/unlock-request.spec.ts (full unlock flow with real RPCs)
//   • src/admin/features/periods/__tests__/useManagePeriods.lockEnforcement.test.js
//     (the actual gating logic in the hook layer)
//
// We keep ONE smoke test that asserts the page mounts without throwing
// — useful when refactoring the import graph; not useful for behavior.

import { describe, vi, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

vi.mock("@/admin/shared/useAdminContext", () => ({
  useAdminContext: () => ({
    organizationId: "org-001",
    selectedPeriodId: null,
    isDemoMode: false,
    onDirtyChange: vi.fn(),
    onCurrentPeriodChange: vi.fn(),
    bgRefresh: { current: null },
    setMessage: vi.fn(),
    incLoading: vi.fn(),
    decLoading: vi.fn(),
    setPanelError: vi.fn(),
    clearPanelError: vi.fn(),
    setEvalLockError: vi.fn(),
    evalLockError: "",
  }),
}));
vi.mock("@/auth", () => ({
  useAuth: () => ({
    activeOrganization: { id: "org-001" },
    isEmailVerified: true,
    graceEndsAt: null,
  }),
}));
vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/admin/shared/usePageRealtime", () => ({
  usePageRealtime: () => {},
}));

vi.mock("../AddEditPeriodDrawer", () => ({ default: () => null }));
vi.mock("../ClosePeriodModal", () => ({ default: () => null }));
vi.mock("../DeletePeriodModal", () => ({ default: () => null }));
vi.mock("../PublishPeriodModal", () => ({ default: () => null }));
vi.mock("../RevertToDraftModal", () => ({ default: () => null }));
vi.mock("../RequestRevertModal", () => ({ default: () => null }));
vi.mock("../CompletionStrip", () => ({ default: () => null }));
vi.mock("../PeriodCriteriaDrawer", () => ({ default: () => null }));
vi.mock("@/admin/shared/ExportPanel", () => ({ default: () => null }));
vi.mock("@/shared/ui/Pagination", () => ({ default: () => null }));
vi.mock("@/shared/ui/FloatingMenu", () => ({ default: () => null }));
vi.mock("@/shared/ui/PremiumTooltip", () => ({ default: () => null }));
vi.mock("@/shared/ui/CustomSelect", () => ({ default: () => null }));
vi.mock("@/shared/hooks/useFloating", () => ({ useFloating: () => ({ x: 0, y: 0, refs: {} }) }));
vi.mock("@/shared/hooks/useCardSelection", () => ({
  default: () => ({ selectedId: null, select: vi.fn(), clear: vi.fn() }),
}));
vi.mock("@/admin/utils/downloadTable", () => ({
  downloadTable: vi.fn(),
  generateTableBlob: vi.fn(),
}));
vi.mock("@/shared/lib/dateUtils", () => ({ formatDateTime: () => "2026-01-01" }));
vi.mock("@/shared/api", () => ({
  logExportInitiated: vi.fn(),
  setEvalLock: vi.fn(),
  getPeriodCriteriaSnapshot: vi.fn(),
  listPeriodStats: vi.fn().mockResolvedValue({ data: [] }),
  listPeriods: vi.fn().mockResolvedValue([]),
  createPeriod: vi.fn(),
  updatePeriod: vi.fn(),
  duplicatePeriod: vi.fn(),
  savePeriodCriteria: vi.fn(),
  reorderPeriodCriteria: vi.fn(),
  deletePeriod: vi.fn(),
  listPeriodCriteria: vi.fn().mockResolvedValue({ data: [] }),
  listPeriodOutcomes: vi.fn().mockResolvedValue([]),
  cloneFramework: vi.fn(),
  assignFrameworkToPeriod: vi.fn(),
  freezePeriodSnapshot: vi.fn(),
  setPeriodCriteriaName: vi.fn(),
  updatePeriodOutcomeConfig: vi.fn(),
}));
vi.mock("@/shared/criteria/criteriaHelpers", () => ({ getActiveCriteria: () => [] }));
vi.mock("@/auth/shared/lockedActions", () => ({
  LOCK_TOOLTIP_GRACE: "",
  LOCK_TOOLTIP_EXPIRED: "",
}));
vi.mock("../styles/index.css", () => ({}));
vi.mock("@/admin/features/setup-wizard/styles/index.css", () => ({}));
vi.mock("../components/PeriodsTable", () => ({ default: () => <table /> }));
vi.mock("../components/PeriodsFilterPanel", () => ({ default: () => null }));
vi.mock("../components/LifecycleBar", () => ({ default: () => null }));
vi.mock("../components/LifecycleGuide", () => ({ default: () => null }));
vi.mock("@/shared/ui/FilterButton", () => ({ FilterButton: () => null }));
vi.mock("@/shared/ui/FbAlert", () => ({ default: () => null }));

import PeriodsPage from "../PeriodsPage";

describe("PeriodsPage", () => {
  // BUG CLASS: import-graph break (a refactor that renames a barrel export
  // or moves a hook so PeriodsPage no longer compiles). The test catches
  // this at vitest time, before deploy. Anything richer belongs in E2E.
  qaTest("admin.periods.page.mounts", () => {
    expect(() =>
      render(
        <MemoryRouter>
          <PeriodsPage />
        </MemoryRouter>
      )
    ).not.toThrow();
  });
});
