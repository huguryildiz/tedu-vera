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
    activeOrganization: { id: "org-001", code: "ORG" },
    isEmailVerified: true,
    graceEndsAt: null,
  }),
}));

vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock("@/shared/api", () => ({
  listPeriods: vi.fn(),
  listJurorsSummary: vi.fn(),
  getScores: vi.fn(),
  getProjectSummary: vi.fn(),
  logExportInitiated: vi.fn(),
}));

vi.mock("@/admin/utils/exportXLSX", () => ({
  exportXLSX: vi.fn(),
  buildExportFilename: vi.fn(() => "export.xlsx"),
}));

vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => children,
}));

vi.mock("@/admin/shared/ManageBackupsDrawer", () => ({ default: () => null }));

import ExportPage from "../ExportPage";

describe("ExportPage", () => {
  qaTest("admin.export.page.render", () => {
    render(
      <MemoryRouter>
        <ExportPage />
      </MemoryRouter>
    );
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });
});
