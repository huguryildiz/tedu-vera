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
    trendPeriodIds: [],
    setTrendPeriodIds: vi.fn(),
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

// API boundary — useAnalyticsData runs real and calls these.
vi.mock("@/shared/api", () => ({
  logExportInitiated: vi.fn(),
  getOutcomeTrends: vi.fn().mockResolvedValue([]),
  getOutcomeAttainmentTrends: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/shared/stats", () => ({ outcomeValues: () => [] }));
vi.mock("@/admin/utils/exportXLSX", () => ({
  buildExportFilename: () => "export.xlsx",
}));
vi.mock("@/admin/analytics/analyticsDatasets", () => ({
  buildOutcomeAttainmentTrendDataset: () => [],
}));
vi.mock("@/admin/shared/SendReportModal", () => ({ default: () => null }));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({ default: ({ children }) => children }));

// Mock all charts as null renderers
vi.mock("@/charts/OutcomeByGroupChart", () => ({ OutcomeByGroupChart: () => null }));
vi.mock("@/charts/RubricAchievementChart", () => ({
  RubricAchievementChart: () => null,
  BAND_COLORS: [],
}));
vi.mock("@/charts/ProgrammeAveragesChart", () => ({ ProgrammeAveragesChart: () => null }));
vi.mock("@/charts/OutcomeAttainmentHeatmap", () => ({ OutcomeAttainmentHeatmap: () => null }));
vi.mock("@/charts/AttainmentRateChart", () => ({ AttainmentRateChart: () => null }));
vi.mock("@/charts/ThresholdGapChart", () => ({ ThresholdGapChart: () => null }));
vi.mock("@/charts/GroupAttainmentHeatmap", () => ({ GroupAttainmentHeatmap: () => null }));
vi.mock("@/charts/JurorConsistencyHeatmap", () => ({ JurorConsistencyHeatmap: () => null }));
vi.mock("@/charts/CoverageMatrix", () => ({ CoverageMatrix: () => null }));

import AnalyticsPage from "../AnalyticsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <AnalyticsPage />
    </MemoryRouter>
  );
}

describe("AnalyticsPage", () => {
  qaTest("admin.analytics.page.mounts-with-empty-outcome-data", () => {
    renderPage();
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });

  qaTest("admin.analytics.page.heading", () => {
    renderPage();
    expect(screen.getByText("Programme Outcome Analytics")).toBeInTheDocument();
  });

  qaTest("admin.analytics.page.export-btn", () => {
    renderPage();
    expect(screen.getAllByText("Export").length).toBeGreaterThan(0);
  });

  qaTest("admin.analytics.page.no-attainment-data", () => {
    renderPage();
    expect(screen.getByText("No Attainment Data")).toBeInTheDocument();
  });

  qaTest("admin.analytics.page.nav-rendered", () => {
    renderPage();
    expect(screen.getByRole("navigation", { name: "Analytics sections" })).toBeInTheDocument();
    expect(screen.getByText("Attainment Status")).toBeInTheDocument();
  });
});
