import { describe, vi, expect } from "vitest";
import { qaTest } from "@/test/qaTest";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => children,
  BarChart: ({ children }) => children,
  AreaChart: ({ children }) => children,
  LineChart: ({ children }) => children,
  ComposedChart: ({ children }) => children,
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

import * as ChartsBarrel from "../index";

describe("charts/index barrel", () => {
  qaTest("coverage.charts-index.re-exports", () => {
    expect(ChartsBarrel.CHART_COPY).toBeDefined();
    expect(ChartsBarrel.ChartDataTable).toBeDefined();
    expect(ChartsBarrel.AttainmentRateChart).toBeDefined();
    expect(ChartsBarrel.ThresholdGapChart).toBeDefined();
    expect(ChartsBarrel.SubmissionTimelineChart).toBeDefined();
    expect(ChartsBarrel.ScoreDistributionChart).toBeDefined();
  });
});
