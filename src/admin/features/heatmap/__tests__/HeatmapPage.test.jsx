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

vi.mock("../useHeatmapData", () => ({
  useHeatmapData: () => ({
    lookup: {},
    jurorWorkflowMap: new Map(),
    buildExportRows: vi.fn(() => []),
  }),
}));

vi.mock("@/admin/features/heatmap/useGridSort", () => ({
  useGridSort: () => ({
    visibleJurors: [],
    sortGroupId: null,
    sortGroupDir: "desc",
    sortMode: "none",
    sortJurorDir: "asc",
    toggleGroupSort: vi.fn(),
    toggleJurorSort: vi.fn(),
    setJurorFilter: vi.fn(),
    clearSort: vi.fn(),
  }),
}));

vi.mock("@/admin/features/heatmap/useGridExport", () => ({
  useGridExport: () => ({
    requestExport: vi.fn(),
    exporting: false,
  }),
}));

vi.mock("@/admin/utils/scoreHelpers", () => ({
  getCellState: vi.fn(() => ({})),
  getPartialTotal: vi.fn(() => 0),
  scoreBgColor: vi.fn(() => ""),
  scoreCellStyle: vi.fn(() => ({})),
}));

vi.mock("@/admin/utils/downloadTable", () => ({
  generateTableBlob: vi.fn(),
}));

vi.mock("@/admin/shared/SendReportModal", () => ({ default: () => null }));
vi.mock("@/admin/shared/JurorBadge", () => ({ default: () => null }));
vi.mock("@/admin/shared/JurorStatusPill", () => ({ default: () => null }));
vi.mock("../HeatmapMobileList.jsx", () => ({ default: () => null }));

import HeatmapPage from "../HeatmapPage";

describe("HeatmapPage", () => {
  qaTest("admin.heatmap.page.render", () => {
    render(
      <MemoryRouter>
        <HeatmapPage />
      </MemoryRouter>
    );
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });
});
