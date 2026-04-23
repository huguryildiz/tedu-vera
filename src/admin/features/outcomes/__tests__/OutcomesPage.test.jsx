import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

vi.mock("@/admin/shared/useAdminContext", () => ({
  useAdminContext: () => ({
    organizationId: "org-001",
    selectedPeriodId: "period-001",
    selectedPeriod: null,
    frameworks: [],
    semesterOptions: [],
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

vi.mock("@/admin/shared/usePeriodOutcomes", () => ({
  usePeriodOutcomes: () => ({
    outcomes: [],
    criteria: [],
    mappings: [],
    savedOutcomesCount: 0,
    savedMappingsCount: 0,
    pendingFrameworkImport: null,
    pendingFrameworkName: undefined,
    loading: false,
    error: null,
    save: vi.fn(),
    isDirty: false,
    addMapping: vi.fn(),
    removeMapping: vi.fn(),
  }),
}));

vi.mock("@/shared/hooks/useCardSelection", () => ({
  default: () => ({ selectedId: null, select: vi.fn(), clear: vi.fn() }),
}));

vi.mock("@/shared/api", () => ({
  updateFramework: vi.fn(),
  cloneFramework: vi.fn(),
  assignFrameworkToPeriod: vi.fn(),
  unassignPeriodFramework: vi.fn(),
  listFrameworks: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/admin/features/outcomes/useOutcomesExport", () => ({
  useOutcomesExport: () => ({ generateFile: vi.fn(), handleExport: vi.fn() }),
}));

vi.mock("../AddOutcomeDrawer", () => ({ default: () => null }));
vi.mock("../OutcomeDetailDrawer", () => ({ default: () => null }));
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
  qaTest("admin.outcomes.page.render", () => {
    renderPage();
    expect(screen.getByText("Outcomes & Mapping")).toBeInTheDocument();
  });
});
