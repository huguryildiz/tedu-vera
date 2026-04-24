import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  AreaChart: ({ children }) => <div>{children}</div>,
  LineChart: ({ children }) => <div>{children}</div>,
  ComposedChart: ({ children }) => <div>{children}</div>,
  Bar: () => null,
  Area: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
  ReferenceLine: () => null,
}));

import { AttainmentTrendChart } from "../AttainmentTrendChart";

describe("AttainmentTrendChart", () => {
  qaTest("coverage.attainment-trend-chart.empty-state", () => {
    render(
      <AttainmentTrendChart
        trendData={[]}
        periodOptions={[]}
        selectedIds={[]}
        criteria={[]}
      />
    );
    expect(screen.getByText("No Trend Data")).toBeInTheDocument();
  });
});
