import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/CustomSelect", () => ({ default: () => null }));

import ProjectsFilterPanel from "../ProjectsFilterPanel";

const noop = vi.fn();
const baseProps = {
  filters: { evalStatus: "all", advisor: "" },
  setFilters: noop,
  filterActiveCount: 0,
  distinctAdvisors: [],
  onClose: noop,
};

describe("ProjectsFilterPanel", () => {
  qaTest("coverage.projects-filter-panel.renders", () => {
    render(<ProjectsFilterPanel {...baseProps} />);
    expect(screen.getByText(/Filter Projects/)).toBeInTheDocument();
  });

  qaTest("coverage.projects-filter-panel.close-button", () => {
    render(<ProjectsFilterPanel {...baseProps} />);
    expect(screen.getByText("×")).toBeInTheDocument();
  });
});
