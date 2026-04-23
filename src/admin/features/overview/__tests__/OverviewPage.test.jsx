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

describe("OverviewPage", () => {
  qaTest("admin.overview.page.render", () => {
    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>
    );
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });
});
