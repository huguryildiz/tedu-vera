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

vi.mock("@/shared/api", () => ({
  verifyAuditChain: vi.fn(),
}));

const mockAuditState = {
  showAuditSkeleton: false,
};

vi.mock("../useAuditLogFilters", () => ({
  useAuditLogFilters: () => ({
    auditLogs: [],
    auditLoading: false,
    auditError: "",
    auditFilters: {},
    setAuditFilters: vi.fn(),
    auditSearch: "",
    setAuditSearch: vi.fn(),
    auditHasMore: false,
    auditTotalCount: 0,
    auditExporting: false,
    showAllAuditLogs: false,
    setShowAllAuditLogs: vi.fn(),
    auditScrollRef: { current: null },
    auditSentinelRef: { current: null },
    auditCardRef: { current: null },
    AUDIT_COMPACT_COUNT: 10,
    visibleAuditLogs: [],
    hasAuditFilters: false,
    hasAuditToggle: false,
    ...mockAuditState,
    isAuditStaleRefresh: false,
    auditRangeError: "",
    handleAuditRefresh: vi.fn(),
    handleAuditReset: vi.fn(),
    handleAuditLoadMore: vi.fn(),
    handleAuditExport: vi.fn(),
    scheduleAuditRefresh: vi.fn(),
    formatAuditTimestamp: vi.fn(() => ""),
  }),
}));

vi.mock("@/admin/shared/usePageRealtime", () => ({
  usePageRealtime: vi.fn(),
}));

vi.mock("@/admin/utils/auditUtils", () => ({
  getActorInfo: vi.fn(() => ({ name: "Admin", avatar: "" })),
  formatActionLabel: vi.fn(() => ""),
  formatActionDetail: vi.fn(() => ""),
  formatSentence: vi.fn(() => ""),
  formatDiffChips: vi.fn(() => []),
  detectAnomalies: vi.fn(() => []),
  CATEGORY_META: {},
  SEVERITY_META: {},
  groupBulkEvents: vi.fn((logs) => logs),
  formatEventMeta: vi.fn(() => ({})),
  addDaySeparators: vi.fn((logs) => logs),
}));

vi.mock("@/admin/utils/auditColumns", () => ({
  AUDIT_TABLE_COLUMNS: [],
}));

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
  beforeEach(() => {
    mockAuditState.showAuditSkeleton = false;
  });

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

  qaTest("admin.audit.page.no-events-yet", () => {
    renderPage();
    expect(screen.getAllByText("No audit events yet.").length).toBeGreaterThan(0);
  });

  qaTest("admin.audit.page.skeleton-shown", () => {
    mockAuditState.showAuditSkeleton = true;
    renderPage();
    expect(document.querySelector(".audit-skeleton-row")).not.toBeNull();
  });
});
