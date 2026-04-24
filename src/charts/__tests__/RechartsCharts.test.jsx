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

import { ScoreDistributionChart } from "../ScoreDistributionChart";
import { SubmissionTimelineChart } from "../SubmissionTimelineChart";
import { OutcomeAttainmentTrendChart } from "../OutcomeAttainmentTrendChart";
import { OutcomeByGroupChart } from "../OutcomeByGroupChart";
import { ProgrammeAveragesChart } from "../ProgrammeAveragesChart";
import { RubricAchievementChart } from "../RubricAchievementChart";

describe("ScoreDistributionChart", () => {
  qaTest("coverage.score-distribution-chart.empty-state", () => {
    render(<ScoreDistributionChart rawScores={[]} />);
    expect(screen.getByText("No Score Data")).toBeInTheDocument();
  });
});

describe("SubmissionTimelineChart", () => {
  qaTest("coverage.submission-timeline-chart.empty-state", () => {
    render(<SubmissionTimelineChart allJurors={[]} />);
    expect(screen.getByText("No Submission Data")).toBeInTheDocument();
  });
});

describe("OutcomeAttainmentTrendChart", () => {
  qaTest("coverage.outcome-attainment-trend-chart.empty-state", () => {
    render(<OutcomeAttainmentTrendChart rows={[]} outcomeMeta={[]} />);
    expect(screen.getByText("No Outcome Trend Data")).toBeInTheDocument();
  });
});

describe("OutcomeByGroupChart", () => {
  qaTest("coverage.outcome-by-group-chart.empty-state", () => {
    render(<OutcomeByGroupChart dashboardStats={[]} criteria={[]} />);
    expect(screen.getByText("No Group Score Data")).toBeInTheDocument();
  });
});

describe("ProgrammeAveragesChart", () => {
  qaTest("coverage.programme-averages-chart.empty-state", () => {
    render(<ProgrammeAveragesChart submittedData={[]} criteria={[]} />);
    expect(screen.getByText("No Score Data")).toBeInTheDocument();
  });
});

describe("RubricAchievementChart", () => {
  qaTest("coverage.rubric-achievement-chart.empty-state", () => {
    render(<RubricAchievementChart submittedData={[]} criteria={[]} />);
    expect(screen.getByText("No Score Data")).toBeInTheDocument();
  });
});
