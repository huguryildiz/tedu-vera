import { describe, vi, expect, beforeEach } from "vitest";
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

// API boundary — useAuditLogFilters runs real and calls these.
vi.mock("@/shared/api", () => ({
  verifyAuditChain: vi.fn(),
  listAuditLogs: vi.fn().mockResolvedValue({ data: [], totalCount: 0 }),
  logExportInitiated: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/admin/shared/usePageRealtime", () => ({
  usePageRealtime: vi.fn(),
}));

// Real auditUtils + auditColumns run — they're pure helpers; with empty
// auditLogs = [] none of the formatters get exercised.

vi.mock("@/admin/shared/ExportPanel", () => ({ default: () => null }));
vi.mock("@/shared/ui/CustomSelect", () => ({ default: () => null }));
vi.mock("../AuditEventDrawer", () => ({ default: () => null }));
vi.mock("@/shared/hooks/useCardSelection", () => ({
  default: () => ({ selectedId: null, select: vi.fn(), clear: vi.fn() }),
}));
vi.mock("@/shared/ui/Pagination", () => ({ default: () => null }));
vi.mock("@/shared/ui/FbAlert", () => ({ default: () => null }));
vi.mock("@/shared/ui/FilterButton", () => ({ FilterButton: () => null }));

import AuditLogPage from "../AuditLogPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <AuditLogPage />
    </MemoryRouter>
  );
}

describe("AuditLogPage", () => {
  qaTest("admin.audit.page.mounts-with-no-filters", () => {
    renderPage();
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });

  qaTest("admin.audit.page.heading", () => {
    renderPage();
    expect(screen.getByText("Audit Log")).toBeInTheDocument();
  });

  qaTest("admin.audit.page.kpi-strip", () => {
    renderPage();
    expect(screen.getByTestId("audit-kpi-strip")).toBeInTheDocument();
  });

  qaTest("admin.audit.page.search-input", () => {
    renderPage();
    expect(screen.getByTestId("audit-log-search")).toBeInTheDocument();
  });

  qaTest("admin.audit.page.no-events-yet", async () => {
    renderPage();
    // Real hook resolves listAuditLogs → empty → renders empty state.
    await screen.findAllByText("No audit events yet.");
    expect(screen.getAllByText("No audit events yet.").length).toBeGreaterThan(0);
  });

  qaTest("admin.audit.page.skeleton-shown", () => {
    // Real hook sets auditLoading=true synchronously on mount before the
    // listAuditLogs promise resolves. While auditLogs is empty + loading,
    // the skeleton row renders.
    renderPage();
    expect(document.querySelector(".audit-skeleton-row")).not.toBeNull();
  });
});
