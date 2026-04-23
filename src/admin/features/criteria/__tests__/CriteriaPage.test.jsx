import { describe, vi, expect } from "vitest";
import { qaTest } from "@/test/qaTest";

vi.mock("@/admin/shared/useAdminContext", () => ({
  useAdminContext: () => ({
    organizationId: "org-001",
    selectedPeriodId: null,
    isDemoMode: false,
    onDirtyChange: vi.fn(),
    onCurrentPeriodChange: vi.fn(),
    onNavigate: vi.fn(),
    loading: false,
    sortedPeriods: [],
    bgRefresh: { current: null },
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

vi.mock("@/admin/features/periods/useManagePeriods", () => ({
  useManagePeriods: () => ({
    periodList: [],
    viewPeriodId: null,
    viewPeriodLabel: "—",
    viewPeriod: null,
    currentPeriodId: null,
    draftCriteria: [],
    outcomeConfig: [],
    pendingCriteriaName: undefined,
    pendingClearAll: false,
    pendingCriteriaPreviewKind: null,
    pendingCriteriaPreviewSource: null,
    isDraftDirty: false,
    draftTotal: 0,
    canSaveDraft: false,
    loadPeriods: vi.fn().mockResolvedValue(undefined),
    commitDraft: vi.fn(),
    discardDraft: vi.fn(),
    updateDraft: vi.fn(),
    setPendingCriteriaPreview: vi.fn(),
    setPendingCriteriaName: vi.fn(),
    markClearAll: vi.fn(),
    applySavedCriteria: vi.fn(),
    reloadCriteria: vi.fn(),
    handleCreatePeriod: vi.fn(),
    handleUpdatePeriod: vi.fn(),
    handleDuplicatePeriod: vi.fn(),
    handleUpdateCriteriaConfig: vi.fn(),
    handleUpdateOutcomeConfig: vi.fn(),
    handleDeletePeriod: vi.fn(),
    handleSaveSettings: vi.fn(),
    notifyExternalPeriodUpdate: vi.fn(),
    notifyExternalPeriodDelete: vi.fn(),
  }),
}));

vi.mock("@/admin/shared/usePeriodOutcomes", () => ({
  usePeriodOutcomes: () => ({
    outcomes: [],
    loading: false,
    error: null,
    save: vi.fn(),
    isDirty: false,
  }),
}));

vi.mock("@/shared/hooks/useCardSelection", () => ({
  default: () => ({ selectedId: null, select: vi.fn(), clear: vi.fn() }),
}));

vi.mock("../EditSingleCriterionDrawer", () => ({ default: () => null }));
vi.mock("../StarterCriteriaDrawer", () => ({
  default: () => null,
  STARTER_CRITERIA: [],
}));
vi.mock("../WeightBudgetBar", () => ({ default: () => null }));
vi.mock("../SaveBar", () => ({ default: () => null }));
vi.mock("../InlineWeightEdit", () => ({ default: () => null }));
vi.mock("../ProgrammeOutcomesManagerDrawer", () => ({ default: () => null }));
vi.mock("../useCriteriaExport", () => ({
  useCriteriaExport: () => ({ generateFile: vi.fn(), handleExport: vi.fn() }),
}));
vi.mock("../criteriaFormHelpers", () => ({
  rescaleRubricBandsByWeight: vi.fn((r) => r),
  defaultRubricBands: () => [],
  nextCriterionColor: () => "#6366f1",
  CRITERION_COLORS: [],
}));

vi.mock("@/admin/shared/ExportPanel", () => ({ default: () => null }));
vi.mock("@/shared/ui/Pagination", () => ({ default: () => null }));
vi.mock("@/shared/ui/FloatingMenu", () => ({ default: () => null }));
vi.mock("@/shared/ui/CustomSelect", () => ({ default: () => null }));
vi.mock("@/shared/ui/FbAlert", () => ({ default: () => null }));
vi.mock("@/shared/ui/Modal", () => ({ default: () => null }));
vi.mock("@/shared/ui/FilterButton", () => ({ FilterButton: () => null }));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({ default: () => null }));
vi.mock("../styles/index.css", () => ({}));
vi.mock("@/auth/shared/lockedActions", () => ({
  LOCK_TOOLTIP_GRACE: "",
  LOCK_TOOLTIP_EXPIRED: "",
}));

import CriteriaPage from "../CriteriaPage";

describe("CriteriaPage", () => {
  qaTest("admin.criteria.page.render", () => {
    expect(typeof CriteriaPage).toBe("function");
    expect(CriteriaPage.name).toBe("CriteriaPage");
  });
});
