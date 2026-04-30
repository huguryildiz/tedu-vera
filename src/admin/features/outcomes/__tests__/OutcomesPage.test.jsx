import { describe, vi, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

const mockOutcomesState = {
  selectedPeriod: null,
  frameworks: [],
};

vi.mock("@/admin/shared/useAdminContext", () => ({
  useAdminContext: () => ({
    organizationId: "org-001",
    selectedPeriodId: "period-001",
    ...mockOutcomesState,
    periodOptions: [],
    onFrameworksChange: vi.fn(),
    loading: false,
    fetchData: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/auth", () => ({
  useAuth: () => ({
    activeOrganization: { id: "org-001" },
  }),
}));

vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock("@/shared/hooks/useCardSelection", () => ({
  default: () => ({ selectedId: null, select: vi.fn(), clear: vi.fn() }),
}));

const { EMPTY_FRAMEWORKS } = vi.hoisted(() => ({
  EMPTY_FRAMEWORKS: Object.freeze([]),
}));

vi.mock("@/shared/api", () => ({
  updateFramework: vi.fn(),
  cloneFramework: vi.fn(),
  assignFrameworkToPeriod: vi.fn(),
  unassignPeriodFramework: vi.fn(),
  listFrameworks: vi.fn().mockResolvedValue(EMPTY_FRAMEWORKS),
  listPeriodOutcomes: vi.fn().mockResolvedValue([]),
  listPeriodCriteriaForMapping: vi.fn().mockResolvedValue([]),
  listPeriodCriterionOutcomeMaps: vi.fn().mockResolvedValue([]),
  createPeriodOutcome: vi.fn(),
  updatePeriodOutcome: vi.fn(),
  deletePeriodOutcome: vi.fn(),
  upsertPeriodCriterionOutcomeMap: vi.fn(),
  deletePeriodCriterionOutcomeMap: vi.fn(),
  createFramework: vi.fn(),
  freezePeriodSnapshot: vi.fn(),
}));

vi.mock("@/admin/features/outcomes/useOutcomesExport", () => ({
  useOutcomesExport: () => ({ generateFile: vi.fn(), handleExport: vi.fn() }),
}));

const mockFwState = {
  outcomes: [],
  criteria: [],
  mappings: [],
};
vi.mock("@/admin/shared/usePeriodOutcomes", () => ({
  usePeriodOutcomes: () => ({
    outcomes: mockFwState.outcomes,
    criteria: mockFwState.criteria,
    mappings: mockFwState.mappings,
    savedOutcomesCount: mockFwState.outcomes.length,
    savedMappingsCount: mockFwState.mappings.length,
    loading: false,
    error: null,
    saving: false,
    isDirty: false,
    itemsDirty: false,
    pendingFrameworkName: undefined,
    pendingUnassign: null,
    pendingFrameworkImport: null,
    loadAll: vi.fn(),
    commitDraft: vi.fn(),
    discardDraft: vi.fn(),
    getCoverage: () => "unmapped",
    getMappedCriteria: () => [],
    getMappedOutcomes: () => [],
    addOutcome: vi.fn(),
    editOutcome: vi.fn(),
    removeOutcome: vi.fn(),
    addMapping: vi.fn(),
    removeMapping: vi.fn(),
    cycleCoverage: vi.fn(),
    setPendingFrameworkName: vi.fn(),
    markUnassign: vi.fn(),
    setPendingFrameworkImport: vi.fn(),
  }),
}));

vi.mock("../AddOutcomeDrawer", () => ({ default: () => null }));
vi.mock("../OutcomeDetailDrawer", () => ({ default: () => null }));
vi.mock("../components/OutcomesTable", () => ({ default: () => null }));
vi.mock("../components/FrameworkSetupPanel", () => ({ default: () => null }));
vi.mock("../components/DeleteOutcomeModal", () => ({ default: () => null }));
vi.mock("../components/UnassignFrameworkModal", () => ({ default: () => null }));
vi.mock("../components/ImportConfirmModal", () => ({ default: () => null }));
vi.mock("@/shared/ui/Modal", () => ({ default: () => null }));
vi.mock("@/shared/ui/FbAlert", () => ({ default: () => null }));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({ default: () => null }));
vi.mock("@/shared/ui/Pagination", () => ({ default: () => null }));
vi.mock("@/shared/ui/FloatingMenu", () => ({ default: () => null }));
vi.mock("@/shared/ui/CustomSelect", () => ({ default: () => null }));
vi.mock("@/shared/ui/FilterButton", () => ({ FilterButton: () => null }));
vi.mock("@/admin/features/criteria/SaveBar", () => ({ default: () => null }));
vi.mock("@/admin/shared/ExportPanel", () => ({ default: () => null }));
vi.mock("./styles/index.css", () => ({}));
vi.mock("@/admin/features/setup-wizard/styles/index.css", () => ({}));

import OutcomesPage from "../OutcomesPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <OutcomesPage />
    </MemoryRouter>
  );
}

describe("OutcomesPage", () => {
  beforeEach(() => {
    mockOutcomesState.selectedPeriod = null;
    mockOutcomesState.frameworks = [];
    mockFwState.outcomes = [];
    mockFwState.criteria = [];
    mockFwState.mappings = [];
  });

  qaTest("admin.outcomes.page.mounts-with-no-outcomes", () => {
    renderPage();
    expect(screen.getByText("Outcomes & Mapping")).toBeInTheDocument();
  });

  qaTest("admin.outcomes.page.framework-meta", () => {
    renderPage();
    expect(
      screen.getByText("Map evaluation criteria to programme outcomes and track coverage.")
    ).toBeInTheDocument();
  });

  qaTest("admin.outcomes.page.add-btn", () => {
    mockOutcomesState.selectedPeriod = { id: "period-001", name: "Spring 2026", framework_id: "fw-001" };
    renderPage();
    expect(screen.getAllByText("Add Outcome").length).toBeGreaterThan(0);
  });

  qaTest("admin.outcomes.page.kpi-strip", () => {
    mockOutcomesState.selectedPeriod = { id: "period-001", name: "Spring 2026", framework_id: "fw-001" };
    mockFwState.outcomes = [{ id: "o-1", code: "PO1", short_label: "Engineering", description: "" }];
    renderPage();
    expect(screen.getByText("Overall Coverage")).toBeInTheDocument();
    expect(screen.getByText(/Unmapped \(1\)/)).toBeInTheDocument();
  });

  qaTest("admin.outcomes.page.search-input", () => {
    mockOutcomesState.selectedPeriod = { id: "period-001", name: "Spring 2026", framework_id: "fw-001" };
    renderPage();
    expect(screen.getByPlaceholderText("Search outcomes…")).toBeInTheDocument();
  });
});
