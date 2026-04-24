import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

const EMPTY_ARRAY = Object.freeze([]);

vi.mock("../components/SortIcon", () => ({
  default: () => <span data-testid="sort-icon" />,
}));

vi.mock("../components/StatusPill", () => ({
  default: ({ status }) => <span data-testid="status-pill">{status}</span>,
}));

vi.mock("../components/ReadinessPopover", () => ({
  default: () => null,
}));

vi.mock("../components/ProgressCell", () => ({
  default: () => <span data-testid="progress-cell" />,
}));

vi.mock("@/shared/ui/PremiumTooltip", () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock("@/shared/ui/FloatingMenu", () => ({
  default: ({ children, trigger }) => (
    <>
      {trigger}
      {children}
    </>
  ),
}));

vi.mock("../components/periodHelpers", () => ({
  formatRelative: () => "1d ago",
  computeRingModel: () => ({ percent: 50, label: "SETUP", stateClass: "ring-draft" }),
}));

vi.mock("@/shared/lib/dateUtils", () => ({
  formatDateTime: () => "Jan 1, 2024",
}));

import PeriodsTable from "../components/PeriodsTable";

const BASE_HANDLERS = Object.freeze({
  onEdit: vi.fn(),
  onDuplicate: vi.fn(),
  onCopyEntryLink: vi.fn(),
  onClose: vi.fn(),
  onRevert: vi.fn(),
  onPublish: vi.fn(),
  onDelete: vi.fn(),
});

const PERIOD_1 = Object.freeze({
  id: "p1",
  name: "Spring 2024",
  is_locked: false,
  closed_at: null,
  start_date: "2024-03-01",
  end_date: "2024-06-30",
  framework_id: null,
  criteria_name: null,
  updated_at: "2024-01-01T00:00:00Z",
});

const PERIOD_2 = Object.freeze({
  id: "p2",
  name: "Fall 2024",
  is_locked: false,
  closed_at: null,
  start_date: "2024-09-01",
  end_date: "2025-01-31",
  framework_id: null,
  criteria_name: null,
  updated_at: "2024-01-01T00:00:00Z",
});

const defaultProps = {
  rows: EMPTY_ARRAY,
  pagedRows: EMPTY_ARRAY,
  loadingCount: 0,
  sortKey: "name",
  sortDir: "asc",
  onSort: vi.fn(),
  rowsScopeRef: { current: null },
  activeFilterCount: 0,
  search: "",
  onClearSearch: vi.fn(),
  onClearFilters: vi.fn(),
  onAddPeriod: vi.fn(),
  onOpenSetup: vi.fn(),
  stats: {},
  readiness: {},
  frameworks: EMPTY_ARRAY,
  pendingRequests: {},
  openMenuId: null,
  setOpenMenuId: vi.fn(),
  getState: () => "draft_incomplete",
  onCurrentPeriodChange: vi.fn(),
  onNavigate: vi.fn(),
  rowHandlers: BASE_HANDLERS,
};

describe("PeriodsTable", () => {
  qaTest("coverage.periods-table.empty-state", () => {
    render(<PeriodsTable {...defaultProps} />);
    expect(screen.getByText("No evaluation periods yet")).toBeInTheDocument();
  });

  qaTest("coverage.periods-table.column-headers", () => {
    render(<PeriodsTable {...defaultProps} />);
    expect(screen.getByText(/Status/)).toBeInTheDocument();
    expect(screen.getByText(/Date Range/)).toBeInTheDocument();
  });

  qaTest("coverage.periods-table.renders-rows", () => {
    const rows = [PERIOD_1, PERIOD_2];
    render(
      <PeriodsTable
        {...defaultProps}
        rows={rows}
        pagedRows={rows}
      />
    );
    expect(screen.getByText("Spring 2024")).toBeInTheDocument();
    expect(screen.getByText("Fall 2024")).toBeInTheDocument();
    expect(screen.getAllByTestId("period-row")).toHaveLength(2);
  });

  qaTest("coverage.periods-table.filter-empty-state", () => {
    render(
      <PeriodsTable
        {...defaultProps}
        rows={EMPTY_ARRAY}
        pagedRows={EMPTY_ARRAY}
        activeFilterCount={2}
        search=""
      />
    );
    expect(screen.getByText("No periods match your filters")).toBeInTheDocument();
  });
});
