import { describe, vi, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

vi.mock("@/admin/shared/useAdminContext", () => ({
  useAdminContext: () => ({
    organizationId: "org-001",
    selectedPeriodId: null,
    isDemoMode: false,
    onDirtyChange: vi.fn(),
    bgRefresh: { current: null },
    setMessage: vi.fn(),
    incLoading: vi.fn(),
    decLoading: vi.fn(),
    setPanelError: vi.fn(),
    clearPanelError: vi.fn(),
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

// Drives what listPeriods returns per test. The real useManagePeriods hook
// calls listPeriods on mount and derives viewPeriodId via pickDefaultPeriod;
// no whole-hook mock is needed.
let mockPeriods = [];

vi.mock("@/admin/shared/usePageRealtime", () => ({
  usePageRealtime: () => undefined,
}));

vi.mock("@/shared/hooks/useCardSelection", () => ({
  default: () => ({ selectedId: null, select: vi.fn(), clear: vi.fn() }),
}));

vi.mock("../AddProjectDrawer", () => ({ default: () => null }));
vi.mock("../EditProjectDrawer", () => ({ default: () => null }));
vi.mock("../DeleteProjectModal", () => ({ default: () => null }));
vi.mock("../ProjectScoresDrawer", () => ({ default: () => null }));
vi.mock("@/admin/shared/ImportCsvModal", () => ({ default: () => null }));
vi.mock("@/admin/shared/ExportPanel", () => ({ default: () => null }));
vi.mock("@/shared/ui/Pagination", () => ({ default: () => null }));
vi.mock("@/shared/ui/FloatingMenu", () => ({ default: () => null }));
vi.mock("@/shared/ui/PremiumTooltip", () => ({ default: ({ children }) => <>{children}</> }));
vi.mock("@/shared/ui/CustomSelect", () => ({ default: () => null }));
vi.mock("@/shared/ui/FbAlert", () => ({ default: () => null }));
vi.mock("@/shared/ui/FilterButton", () => ({ FilterButton: () => null }));
vi.mock("@/shared/ui/EntityMeta", () => ({ TeamMemberNames: () => null }));
vi.mock("@/admin/shared/JurorBadge", () => ({ default: () => null }));
vi.mock("@/admin/utils/csvParser", () => ({ parseProjectsCsv: vi.fn() }));
vi.mock("@/admin/utils/downloadTable", () => ({
  downloadTable: vi.fn(),
  generateTableBlob: vi.fn(),
}));
vi.mock("@/shared/api", () => ({
  getPeriodMaxScore: vi.fn().mockResolvedValue({ data: 100 }),
  logExportInitiated: vi.fn(),
  adminListProjects: vi.fn().mockResolvedValue([]),
  createProject: vi.fn(),
  upsertProject: vi.fn(),
  deleteProject: vi.fn(),
  listPeriods: vi.fn(() => Promise.resolve(mockPeriods)),
  listPeriodCriteria: vi.fn().mockResolvedValue([]),
  listPeriodOutcomes: vi.fn().mockResolvedValue([]),
  createPeriod: vi.fn(),
  updatePeriod: vi.fn(),
  duplicatePeriod: vi.fn(),
  savePeriodCriteria: vi.fn(),
  reorderPeriodCriteria: vi.fn(),
  deletePeriod: vi.fn(),
  setEvalLock: vi.fn(),
  cloneFramework: vi.fn(),
  assignFrameworkToPeriod: vi.fn(),
  freezePeriodSnapshot: vi.fn(),
  setPeriodCriteriaName: vi.fn(),
  updatePeriodOutcomeConfig: vi.fn(),
}));
vi.mock("@/shared/lib/dateUtils", () => ({ formatDateTime: () => "2026-01-01" }));
vi.mock("@/shared/ui/avatarColor", () => ({ avatarGradient: () => "#000", initials: () => "AB" }));
vi.mock("@/auth/shared/lockedActions", () => ({
  LOCK_TOOLTIP_GRACE: "",
  LOCK_TOOLTIP_EXPIRED: "",
  LOCKED_ACTIONS: {},
}));
vi.mock("../ProjectsPage.css", () => ({}));

import ProjectsPage from "../ProjectsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectsPage />
    </MemoryRouter>
  );
}

describe("ProjectsPage", () => {
  beforeEach(() => {
    mockPeriods = [];
  });

  qaTest("admin.projects.page.mounts-without-crashing", () => {
    renderPage();
    expect(screen.getAllByText("Projects").length).toBeGreaterThan(0);
  });

  qaTest("admin.projects.page.kpi-labels", () => {
    renderPage();
    expect(screen.getAllByText("Coverage").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Avg Score").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Jurors Active").length).toBeGreaterThan(0);
  });

  qaTest("admin.projects.page.search-input", () => {
    renderPage();
    expect(screen.getByPlaceholderText("Search projects...")).toBeInTheDocument();
  });

  qaTest("admin.projects.page.add-btn", () => {
    renderPage();
    expect(screen.getByTestId("projects-add-btn")).toBeInTheDocument();
  });

  qaTest("admin.projects.page.no-periods-empty-state", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("No evaluation periods yet")).toBeInTheDocument()
    );
  });
});
