import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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

vi.mock("@/admin/features/periods/useManagePeriods", () => {
  const loadPeriods = vi.fn().mockResolvedValue(undefined);
  return {
    useManagePeriods: () => ({
      periodList: [],
      viewPeriodId: null,
      viewPeriodLabel: "—",
      currentPeriodId: null,
      loadPeriods,
      setViewPeriodId: vi.fn(),
    }),
  };
});

vi.mock("../useManageProjects", () => {
  const loadProjects = vi.fn().mockResolvedValue(undefined);
  return {
    useManageProjects: () => ({
      projects: [],
      loadProjects,
      handleAddProject: vi.fn(),
      handleEditProject: vi.fn(),
      handleDeleteProject: vi.fn(),
      handleImportProjects: vi.fn(),
      handleDuplicateProject: vi.fn(),
    }),
  };
});

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
vi.mock("@/shared/ui/PremiumTooltip", () => ({ default: () => null }));
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
  qaTest("admin.projects.page.render", () => {
    renderPage();
    expect(screen.getAllByText("Projects").length).toBeGreaterThan(0);
  });
});
