// PeriodsTable — keeps tests that exercise CONDITIONAL render branches
// (empty state, filter-empty state). Removed: pure label / column-header
// assertions (per architecture § 6 anti-pattern #8 — they fail only when
// hardcoded text changes, not when behavior breaks; E2E specs cover the
// label visibility regression class via PeriodsPom.expectRowVisible).

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
vi.mock("../components/ReadinessPopover", () => ({ default: () => null }));
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
vi.mock("@/shared/lib/dateUtils", () => ({ formatDateTime: () => "Jan 1, 2024" }));

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

describe("PeriodsTable — conditional render branches", () => {
  // BUG CLASS: a regression that swaps the no-rows / no-filter-match copy
  // (or breaks the empty-state branch entirely so the component renders a
  // ghost table with only headers) only shows up if both branches are
  // exercised explicitly.

  qaTest("admin.periods.table.empty-state", () => {
    render(<PeriodsTable {...defaultProps} />);
    expect(screen.getByText("No evaluation periods yet")).toBeInTheDocument();
  });

  qaTest("admin.periods.table.filter-empty-state", () => {
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
