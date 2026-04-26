// CriteriaPage — clean-boundary render tests.
//
// Mocks only at the @/shared/api boundary; useManagePeriods and
// usePeriodOutcomes run real logic so hook → UI contracts are tested.
// Sub-components (drawers, table, header) mocked to null to keep scope tight.

import { describe, vi, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

// ── API boundary mocks ────────────────────────────────────────
const mockListPeriods = vi.fn();
const mockListPeriodCriteria = vi.fn();
const mockListPeriodOutcomes = vi.fn();
const mockListPeriodCriteriaForMapping = vi.fn();
const mockListPeriodCriterionOutcomeMaps = vi.fn();

vi.mock("@/shared/api", () => ({
  listPeriods: (...a) => mockListPeriods(...a),
  createPeriod: vi.fn(),
  updatePeriod: vi.fn(),
  duplicatePeriod: vi.fn(),
  savePeriodCriteria: vi.fn(),
  reorderPeriodCriteria: vi.fn(),
  deletePeriod: vi.fn(),
  setEvalLock: vi.fn(),
  listPeriodCriteria: (...a) => mockListPeriodCriteria(...a),
  listPeriodOutcomes: (...a) => mockListPeriodOutcomes(...a),
  cloneFramework: vi.fn(),
  assignFrameworkToPeriod: vi.fn(),
  freezePeriodSnapshot: vi.fn(),
  setPeriodCriteriaName: vi.fn(),
  updatePeriodOutcomeConfig: vi.fn(),
  listPeriodCriteriaForMapping: (...a) => mockListPeriodCriteriaForMapping(...a),
  listPeriodCriterionOutcomeMaps: (...a) => mockListPeriodCriterionOutcomeMaps(...a),
  createPeriodOutcome: vi.fn(),
  updatePeriodOutcome: vi.fn(),
  deletePeriodOutcome: vi.fn(),
  upsertPeriodCriterionOutcomeMap: vi.fn(),
  deletePeriodCriterionOutcomeMap: vi.fn(),
  createFramework: vi.fn(),
  logExportInitiated: vi.fn(),
  getPeriodCriteriaSnapshot: vi.fn(),
  listPeriodStats: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock("@/admin/shared/usePageRealtime", () => ({
  usePageRealtime: () => {},
}));

vi.mock("@/admin/shared/useAdminContext", () => ({
  useAdminContext: () => ({
    organizationId: "org-001",
    selectedPeriodId: null,
    isDemoMode: false,
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
vi.mock("../components/CriteriaPageHeader", () => ({ default: () => null }));
vi.mock("../components/CriteriaFilterPanel", () => ({ default: () => null }));
vi.mock("../components/CriteriaTable", () => ({ default: () => null }));
vi.mock("../components/CriteriaConfirmModals", () => ({
  ClearAllCriteriaModal: () => null,
  DeleteCriterionModal: () => null,
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

const Wrapped = () => (
  <MemoryRouter>
    <CriteriaPage />
  </MemoryRouter>
);

describe("CriteriaPage", () => {
  beforeEach(() => {
    mockListPeriods.mockResolvedValue([]);
    mockListPeriodCriteria.mockResolvedValue({ data: [] });
    mockListPeriodOutcomes.mockResolvedValue([]);
    mockListPeriodCriteriaForMapping.mockResolvedValue([]);
    mockListPeriodCriterionOutcomeMaps.mockResolvedValue([]);
  });

  qaTest("admin.criteria.page.mounts-with-no-criteria", () => {
    expect(() => render(<Wrapped />)).not.toThrow();
  });

  qaTest("admin.criteria.page.heading", () => {
    const { getByText } = render(<Wrapped />);
    expect(getByText("Evaluation Criteria")).toBeTruthy();
  });

  qaTest("admin.criteria.page.no-periods-empty", async () => {
    render(<Wrapped />);
    await waitFor(() => {
      expect(screen.getByText("No evaluation periods yet")).toBeTruthy();
    });
  });
});
