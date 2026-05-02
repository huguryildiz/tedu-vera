import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

const EMPTY_ARRAY = Object.freeze([]);

vi.mock("@/shared/ui/FloatingMenu", () => ({
  default: ({ children, trigger }) => (
    <>
      {trigger}
      {children}
    </>
  ),
}));

vi.mock("@/shared/ui/Pagination", () => ({
  default: () => null,
}));

vi.mock("../components/OutcomeRow", () => ({
  default: ({ outcome }) => (
    <tr data-testid="outcome-row">
      <td>{outcome.code}</td>
    </tr>
  ),
}));

vi.mock("../components/outcomeHelpers", () => ({
  COVERAGE_LEGEND: [
    { key: "direct", label: "Direct", desc: "Direct assessment", icon: () => null, cls: "direct" },
  ],
}));

import OutcomesTable from "../components/OutcomesTable";

const noop = vi.fn();

const baseFw = {
  loading: false,
  outcomes: EMPTY_ARRAY,
  getMappedCriteria: () => EMPTY_ARRAY,
  getCoverage: () => "none",
};

const defaultProps = {
  isLocked: false,
  frameworkId: "fw-1",
  frameworkName: "MÜDEK 2024",
  totalOutcomes: 0,
  directCount: 0,
  savedFrameworkThreshold: 50,
  fw: baseFw,
  pageRows: EMPTY_ARRAY,
  filteredOutcomes: EMPTY_ARRAY,
  safePage: 1,
  totalPages: 1,
  pageSize: 25,
  currentPage: 1,
  onPageChange: noop,
  onPageSizeChange: noop,
  sortOrder: "asc",
  setSortOrder: noop,
  setCurrentPage: noop,
  openMenuId: null,
  setOpenMenuId: noop,
  rowsScopeRef: { current: null },
  fwRenaming: false,
  fwRenameVal: "",
  setFwRenameVal: noop,
  fwRenameInputRef: { current: null },
  saveFwRename: noop,
  handleFwRenameKeyDown: noop,
  fwRenameSaving: false,
  startFwRename: noop,
  onOpenUnassign: noop,
  thresholdEditing: false,
  thresholdVal: "50",
  setThresholdVal: noop,
  thresholdInputRef: { current: null },
  saveThreshold: noop,
  handleThresholdKeyDown: noop,
  thresholdSaving: false,
  startThresholdEdit: noop,
  onEditOutcome: noop,
  onDeleteOutcome: noop,
  onDuplicate: noop,
  onRemoveChip: noop,
  onCycleCoverage: noop,
  setCoverageFilter: noop,
  setCriterionFilter: noop,
};

describe("OutcomesTable", () => {
  qaTest("coverage.outcomes-table.empty-state", () => {
    render(<OutcomesTable {...defaultProps} />);
    expect(screen.getByText("No outcomes defined")).toBeInTheDocument();
  });

  qaTest("coverage.outcomes-table.lock-banner", () => {
    render(<OutcomesTable {...defaultProps} isLocked={true} />);
    expect(
      screen.getByText("Period locked — outcomes are read-only")
    ).toBeInTheDocument();
  });

  qaTest("coverage.outcomes-table.displays-one-row-per-outcome", () => {
    const outcomes = [
      { id: "o1", code: "PO-01", label: "Communication", coverage: "direct" },
      { id: "o2", code: "PO-02", label: "Teamwork", coverage: "indirect" },
    ];
    const fw = {
      ...baseFw,
      outcomes,
    };
    render(
      <OutcomesTable
        {...defaultProps}
        fw={fw}
        pageRows={outcomes}
        filteredOutcomes={outcomes}
        totalOutcomes={2}
        directCount={1}
      />
    );
    expect(screen.getAllByTestId("outcome-row")).toHaveLength(2);
    expect(screen.getAllByText("PO-01").length).toBeGreaterThan(0);
  });
});
