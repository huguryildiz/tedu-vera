import { describe, vi, expect } from "vitest";
import { render } from "@testing-library/react";
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

vi.mock("../useAnalyticsData", () => ({
  useAnalyticsData: () => ({
    trendData: [],
    trendLoading: false,
    trendError: "",
    outcomeTrendData: [],
    outcomeTrendLoading: false,
    outcomeTrendError: "",
    trendPeriodIds: [],
    setTrendPeriodIds: vi.fn(),
  }),
}));

vi.mock("@/shared/api", () => ({
  logExportInitiated: vi.fn(),
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

describe("AnalyticsPage", () => {
  qaTest("admin.analytics.page.render", () => {
    render(
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    );
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });
});
