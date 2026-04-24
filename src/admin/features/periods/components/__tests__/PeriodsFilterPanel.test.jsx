import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/CustomSelect", () => ({ default: () => null }));

import PeriodsFilterPanel from "../PeriodsFilterPanel";

const noop = vi.fn();
const baseProps = {
  onClose: noop,
  frameworks: [],
  statusFilter: "",
  setStatusFilter: noop,
  dateRangeFilter: "",
  setDateRangeFilter: noop,
  progressFilter: "",
  setProgressFilter: noop,
  criteriaFilter: "",
  setCriteriaFilter: noop,
  outcomeFilter: "",
  setOutcomeFilter: noop,
  setupFilter: "",
  setSetupFilter: noop,
  onClearAll: noop,
};

describe("PeriodsFilterPanel", () => {
  qaTest("coverage.periods-filter-panel.renders", () => {
    render(<PeriodsFilterPanel {...baseProps} />);
    expect(screen.getByText(/Filter Periods/)).toBeInTheDocument();
  });

  qaTest("coverage.periods-filter-panel.close-button", () => {
    render(<PeriodsFilterPanel {...baseProps} />);
    expect(screen.getByText("×")).toBeInTheDocument();
  });
});
