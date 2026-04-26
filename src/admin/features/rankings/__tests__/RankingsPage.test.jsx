import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

vi.mock("@/admin/shared/useAdminContext", () => ({
  useAdminContext: () => ({
    organizationId: "org-001",
    selectedPeriodId: "period-001",
    isDemoMode: false,
    incLoading: vi.fn(),
    decLoading: vi.fn(),
    setMessage: vi.fn(),
    bgRefresh: { current: null },
    activeOrganization: { id: "org-001" },
    sortedPeriods: [],
    periodList: [],
    selectedPeriod: { id: "period-001", name: "Spring 2026" },
    matrixJurors: [],
    rawScores: [],
    groups: [],
    criteriaConfig: [],
    summaryData: [],
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

vi.mock("@/admin/utils/downloadTable", () => ({
  downloadTable: vi.fn(),
  generateTableBlob: vi.fn(),
}));
vi.mock("@/shared/api", () => ({ logExportInitiated: vi.fn() }));
vi.mock("@/admin/shared/SendReportModal", () => ({ default: () => null }));
vi.mock("@/admin/features/projects/CompareProjectsModal", () => ({ default: () => null }));
vi.mock("@/admin/shared/JurorBadge", () => ({ default: () => null }));
vi.mock("@/admin/shared/AvgDonut", () => ({ default: () => null }));
vi.mock("@/shared/ui/PremiumTooltip", () => ({ default: () => null }));
vi.mock("@/shared/ui/CustomSelect", () => ({ default: () => null }));
vi.mock("@/shared/ui/FilterButton", () => ({ FilterButton: () => null }));
vi.mock("@/shared/ui/Pagination", () => ({ default: () => null }));
vi.mock("@/shared/hooks/useCardSelection", () => ({
  default: () => ({ selectedId: null, select: vi.fn(), clear: vi.fn() }),
}));
vi.mock("@/shared/ui/EntityMeta", () => ({ TeamMemberNames: () => null }));
vi.mock("@/auth/shared/lockedActions", () => ({
  LOCK_TOOLTIP_GRACE: "",
  LOCK_TOOLTIP_EXPIRED: "",
}));

import RankingsPage from "../RankingsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <RankingsPage />
    </MemoryRouter>
  );
}

describe("RankingsPage", () => {
  qaTest("admin.rankings.page.mounts-with-no-projects", () => {
    renderPage();
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });

  qaTest("admin.rankings.page.heading", () => {
    renderPage();
    expect(screen.getByText("Rankings")).toBeInTheDocument();
  });

  qaTest("admin.rankings.page.kpi-strip", () => {
    renderPage();
    expect(screen.getByTestId("rankings-kpi-strip")).toBeInTheDocument();
  });

  qaTest("admin.rankings.page.search-input", () => {
    renderPage();
    expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
  });

  qaTest("admin.rankings.page.export-btn", () => {
    renderPage();
    expect(screen.getByTestId("rankings-export-btn")).toBeInTheDocument();
  });

  qaTest("admin.rankings.page.stats-dash-when-empty", () => {
    renderPage();
    // With 0 projects, topScore/bottomScore/medianScore all render as "—"
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });
});
