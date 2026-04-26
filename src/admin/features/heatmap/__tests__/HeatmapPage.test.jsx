// HeatmapPage — clean-boundary render tests.
//
// useHeatmapData, useGridSort, and useGridExport are NOT mocked here —
// they compute purely from context data (empty arrays) and don't touch
// @/shared/api on mount. Mocking them was a false-confidence tautology.

import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/api", () => ({
  logExportInitiated: vi.fn(),
}));

vi.mock("@/admin/shared/useAdminContext", () => ({
  useAdminContext: () => ({
    organizationId: "org-001",
    selectedPeriodId: "period-001",
    isDemoMode: false,
    activeOrganization: { id: "org-001", name: "Test Org" },
    data: [],
    jurors: [],
    groups: [],
    periodName: "Spring 2026",
    criteriaConfig: [],
    summaryData: [],
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

vi.mock("@/shared/theme/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("@/admin/utils/scoreHelpers", () => ({
  getCellState: vi.fn(() => ({})),
  getPartialTotal: vi.fn(() => 0),
  scoreBgColor: vi.fn(() => ""),
  scoreCellStyle: vi.fn(() => ({})),
  scoreCellClass: vi.fn(() => ""),
  getJurorWorkflowState: vi.fn(() => "scoring"),
  jurorStatusMeta: vi.fn(() => ({ label: "", color: "" })),
}));

vi.mock("@/admin/utils/downloadTable", () => ({
  generateTableBlob: vi.fn(),
  downloadTable: vi.fn(),
}));

vi.mock("@/admin/shared/SendReportModal", () => ({ default: () => null }));
vi.mock("@/admin/shared/JurorBadge", () => ({ default: () => null }));
vi.mock("@/admin/shared/JurorStatusPill", () => ({ default: () => null }));
vi.mock("../HeatmapMobileList.jsx", () => ({ default: () => null }));

import HeatmapPage from "../HeatmapPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <HeatmapPage />
    </MemoryRouter>
  );
}

describe("HeatmapPage", () => {
  qaTest("admin.heatmap.page.render", () => {
    renderPage();
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });

  qaTest("admin.heatmap.page.heading", () => {
    renderPage();
    expect(screen.getByText("Heatmap")).toBeInTheDocument();
  });

  qaTest("admin.heatmap.page.export-btn", () => {
    renderPage();
    expect(screen.getByText("Export Heatmap")).toBeInTheDocument();
  });

  qaTest("admin.heatmap.page.no-jurors-empty", () => {
    renderPage();
    expect(screen.getByText("No Jurors to Display")).toBeInTheDocument();
  });

  qaTest("admin.heatmap.page.kpi-strip", () => {
    renderPage();
    expect(screen.getByTestId("heatmap-grid")).toBeInTheDocument();
  });

  qaTest("admin.heatmap.page.groups-count", () => {
    renderPage();
    expect(screen.getByText("Juror Average")).toBeInTheDocument();
  });
});
