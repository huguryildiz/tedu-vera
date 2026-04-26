import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

// Module-level mock context that can be updated per test
let mockContextValue = {
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
  allJurors: [],
  rawScores: [],
  groups: [],
  criteriaConfig: [],
  summaryData: [],
};

vi.mock("@/admin/shared/useAdminContext", () => ({
  useAdminContext: () => mockContextValue,
}));

vi.mock("@/shared/hooks/useCardSelection", () => ({
  default: () => ({ selectedId: null, select: vi.fn(), clear: vi.fn() }),
}));

vi.mock("@/charts/SubmissionTimelineChart", () => ({
  SubmissionTimelineChart: () => null,
}));

vi.mock("@/charts/ScoreDistributionChart", () => ({
  ScoreDistributionChart: () => null,
}));

vi.mock("@/admin/utils/scoreHelpers", () => ({
  getProjectHighlight: vi.fn(() => null),
}));

vi.mock("@/shared/ui/Icons", () => ({
  UsersLucideIcon: () => null,
  TriangleAlertIcon: () => null,
  CalendarRangeIcon: () => null,
  ActivityIcon: () => null,
  ClockIcon: () => null,
  ChartIcon: () => null,
  BarChart2Icon: () => null,
  TrophyIcon: () => null,
  CircleCheckIcon: () => null,
  SendIcon: () => null,
  PencilLineIcon: () => null,
  CircleSlashIcon: () => null,
  LockIcon: () => null,
  PlayIcon: () => null,
  ChevronUpIcon: () => null,
  ChevronDownIcon: () => null,
}));

vi.mock("@/shared/ui/EntityMeta", () => ({ TeamMemberNames: () => null }));
vi.mock("@/admin/shared/AvgDonut", () => ({ default: () => null }));
vi.mock("@/admin/shared/JurorBadge", () => ({ default: () => null }));
vi.mock("@/admin/shared/JurorStatusPill", () => ({ default: () => null }));

import OverviewPage from "../OverviewPage";

// Synthetic test data
const MOCK_JURORS = [
  { id: "j1", jurorId: "juror-1", finalSubmitted: true,  editEnabled: false, completedProjects: 5, totalProjects: 5 }, // completed
  { id: "j2", jurorId: "juror-2", finalSubmitted: true,  editEnabled: false, completedProjects: 5, totalProjects: 5 }, // completed
  { id: "j3", jurorId: "juror-3", finalSubmitted: false, editEnabled: false, completedProjects: 0, totalProjects: 5 }, // pending
];

function renderPage() {
  return render(
    <MemoryRouter>
      <OverviewPage />
    </MemoryRouter>
  );
}

function renderPageWithJurors(jurors) {
  mockContextValue = {
    ...mockContextValue,
    allJurors: jurors,
  };
  return renderPage();
}

describe("OverviewPage", () => {
  qaTest("admin.overview.page.mounts-without-crashing", () => {
    renderPage();
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });

  qaTest("admin.overview.page.no-jurors-assigned", () => {
    renderPage();
    expect(screen.getByText("No Jurors Assigned")).toBeInTheDocument();
  });

  qaTest("admin.overview.page.nothing-to-flag", () => {
    renderPage();
    expect(screen.getByText("Nothing to Flag")).toBeInTheDocument();
  });

  qaTest("admin.overview.page.no-recent-activity", () => {
    renderPage();
    expect(screen.getByText("No Recent Activity")).toBeInTheDocument();
  });

  qaTest("admin.overview.page.no-projects-yet", () => {
    renderPage();
    expect(screen.getByText("No Projects Yet")).toBeInTheDocument();
  });

  qaTest("admin.overview.kpi.juror-count", () => {
    renderPageWithJurors(MOCK_JURORS);
    // KPI strip should display the total count of 3 jurors
    const jurorKpi = screen.getByTestId("overview-kpi-active-jurors");
    expect(jurorKpi).toHaveAttribute("data-value", "3");
    expect(screen.getByText("Active Jurors")).toBeInTheDocument();
  });

  qaTest("admin.overview.kpi.completion-percentage", () => {
    renderPageWithJurors(MOCK_JURORS);
    // With 2 of 3 jurors completed, should show 67% (rounded from 66.67)
    const completionKpi = screen.getByTestId("overview-kpi-completion");
    expect(completionKpi).toHaveAttribute("data-completed", "2");
    expect(completionKpi).toHaveAttribute("data-total", "3");
    expect(completionKpi).toHaveAttribute("data-value", "67");
    // Should display "2 of 3 completed" text within the KPI
    expect(completionKpi.textContent).toContain("2 of 3 completed");
  });

  qaTest("admin.overview.kpi.empty-state", () => {
    // With no jurors, KPI should display dashes
    renderPageWithJurors([]);
    const jurorKpi = screen.getByTestId("overview-kpi-active-jurors");
    // When totalJ is 0, the KPI value displays "—"
    expect(jurorKpi.textContent).toContain("—");
  });
});
