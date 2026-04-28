import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";
import JurorsTable from "../components/JurorsTable";

// PremiumTooltip and FloatingMenu use portals — stub them out
vi.mock("@/shared/ui/PremiumTooltip", () => ({
  default: ({ children }) => children,
}));
vi.mock("@/shared/ui/FloatingMenu", () => ({
  default: ({ trigger }) => trigger,
}));

const noop = vi.fn();

const baseProps = {
  pagedList: [],
  loadingCount: 0,
  filteredList: [],
  jurorList: [],
  periodMaxScore: 100,
  jurorAvgMap: new Map(),
  editWindowNowMs: Date.now(),
  sortKey: "name",
  sortDir: "asc",
  openMenuId: null,
  setOpenMenuId: noop,
  rowsScopeRef: { current: null },
  shouldUseCardLayout: true,
  isGraceLocked: false,
  graceLockTooltip: null,
  isPeriodLocked: false,
  activeFilterCount: 0,
  search: "",
  onSort: noop,
  onEdit: noop,
  onPinReset: noop,
  onRemove: noop,
  onEnableEdit: noop,
  onViewScores: noop,
  onNotify: noop,
  onClearSearch: noop,
  onClearFilters: noop,
  onAddJuror: noop,
  onImport: noop,
  onNavigatePeriods: noop,
  viewPeriodId: "period-1",
  periodList: [],
};

const makeJuror = (overrides = {}) => ({
  juror_id: "j1",
  juryName: "Dr. Test Juror",
  affiliation: "Test University, EE",
  overviewScoredProjects: 3,
  overviewTotalProjects: 5,
  lastSeenAt: "2024-01-15T10:30:00Z",
  overviewStatus: "in_progress",
  ...overrides,
});

function renderTable(juror) {
  return render(
    <MemoryRouter>
      <JurorsTable {...baseProps} pagedList={[juror]} filteredList={[juror]} jurorList={[juror]} />
    </MemoryRouter>
  );
}

describe("JurorsTable mobile card", () => {
  qaTest("admin.jurors.mobile.card.layout", () => {
    renderTable(makeJuror());

    // Stats strip must be gone
    expect(screen.queryByText("SCORED")).toBeNull();
    expect(screen.queryByText("ASSIGNED")).toBeNull();
    expect(screen.queryByText("DONE")).toBeNull();

    // Old footer label and percentage are gone in the compact two-row layout
    expect(screen.queryByText("Last active:")).toBeNull();
    expect(screen.queryByText("60%")).toBeNull();

    // Compact fraction (scored/total) visible in row 2
    expect(screen.getByText("3/5")).toBeDefined();
  });
});
