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
    setPanelError: vi.fn(),
    clearPanelError: vi.fn(),
    bgRefresh: { current: null },
    onDirtyChange: vi.fn(),
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

vi.mock("@/admin/selectors/filterPipeline", () => ({
  buildProjectMetaMap: () => ({}),
  buildJurorEditMap: () => ({}),
  buildJurorFinalMap: () => ({}),
  generateMissingRows: () => [],
  enrichRows: () => [],
  applyFilters: (rows) => rows,
  sortRows: (rows) => rows,
  computeActiveFilterCount: () => 0,
}));

vi.mock("@/admin/utils/reviewsKpiHelpers", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    computeCoverage: vi.fn(() => 0),
    computePending: vi.fn(() => 0),
    computeSpread: vi.fn(() => 0),
    computeHighDisagreement: vi.fn(() => 0),
    computeOutlierReviews: vi.fn(() => 0),
  };
});

vi.mock("@/admin/utils/adminUtils", () => ({ formatTs: () => "—" }));
vi.mock("@/admin/utils/downloadTable", () => ({
  downloadTable: vi.fn(),
  generateTableBlob: vi.fn(),
}));
vi.mock("@/admin/shared/SendReportModal", () => ({ default: () => null }));
vi.mock("@/admin/shared/JurorStatusPill", () => ({ default: () => null }));
vi.mock("@/admin/shared/ScoreStatusPill", () => ({ default: () => null }));
vi.mock("@/admin/shared/JurorBadge", () => ({ default: () => null }));
vi.mock("@/admin/features/reviews/ReviewMobileCard", () => ({ default: () => null }));
vi.mock("@/shared/ui/Pagination", () => ({ default: () => null }));
vi.mock("@/shared/ui/PremiumTooltip", () => ({ default: () => null }));
vi.mock("@/shared/ui/CustomSelect", () => ({ default: () => null }));
vi.mock("@/shared/ui/FbAlert", () => ({ default: () => null }));
vi.mock("@/shared/ui/FilterButton", () => ({ FilterButton: () => null }));
vi.mock("@/shared/ui/EntityMeta", () => ({ TeamMemberNames: () => null }));
vi.mock("@/shared/hooks/useCardSelection", () => ({
  default: () => ({ selectedId: null, select: vi.fn(), clear: vi.fn() }),
}));
vi.mock("@/shared/api", () => ({ logExportInitiated: vi.fn() }));
vi.mock("@/auth/shared/lockedActions", () => ({
  LOCK_TOOLTIP_GRACE: "",
  LOCK_TOOLTIP_EXPIRED: "",
}));

import ReviewsPage from "../ReviewsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <ReviewsPage />
    </MemoryRouter>
  );
}

describe("ReviewsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  qaTest("admin.reviews.page.mounts-with-no-active-filters", () => {
    renderPage();
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });

  qaTest("admin.reviews.page.heading", () => {
    renderPage();
    expect(screen.getByText("Reviews")).toBeInTheDocument();
  });

  qaTest("admin.reviews.page.kpi-strip", () => {
    renderPage();
    expect(screen.getByText("Avg Score")).toBeInTheDocument();
  });

  qaTest("admin.reviews.page.no-matching-reviews", () => {
    renderPage();
    expect(screen.getByText("No Matching Reviews")).toBeInTheDocument();
  });

  qaTest("admin.reviews.page.export-btn", () => {
    renderPage();
    expect(screen.getAllByText("Export").length).toBeGreaterThan(0);
  });
});
