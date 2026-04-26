import { describe, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

// jsdom has no matchMedia — polyfill so useEffect in ChartDataTable doesn't throw
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  });
});

import { ChartDataTable } from "../chartUtils";

describe("ChartDataTable", () => {
  qaTest("coverage.chart-data-table.displays-view-data-table-toggle", () => {
    render(<ChartDataTable caption="Test" headers={["A", "B"]} rows={[]} />);
    expect(screen.getByText("View data table")).toBeInTheDocument();
  });

  qaTest("coverage.chart-data-table.displays-cell-values-in-tbody", () => {
    render(
      <ChartDataTable
        caption="Scores"
        headers={["Name", "Score"]}
        rows={[["Alice", 85], ["Bob", 92]]}
      />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("92")).toBeInTheDocument();
  });
});
