import { describe, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

import { AttainmentRateChart } from "../AttainmentRateChart";
import { ThresholdGapChart } from "../ThresholdGapChart";
import { CoverageMatrix } from "../CoverageMatrix";
import { GroupAttainmentHeatmap } from "../GroupAttainmentHeatmap";
import { JurorConsistencyHeatmap } from "../JurorConsistencyHeatmap";
import { OutcomeAttainmentHeatmap } from "../OutcomeAttainmentHeatmap";

const criteria = [
  { id: "technical", label: "Technical", max: 30, outcomes: ["PO1"], color: "#22c55e" },
];
const submittedData = [{ technical: 25 }];
const outcomes = [{ code: "PO1", desc_en: "Engineering Design" }];
const groups = [{ id: "g1", count: 2, group_no: 1, title: "Group 1", avg: { technical: 25 } }];

describe("AttainmentRateChart", () => {
  qaTest("coverage.attainment-rate-chart.empty-state", () => {
    render(<AttainmentRateChart submittedData={[]} criteria={[]} />);
    expect(screen.getByText("No Attainment Data")).toBeInTheDocument();
  });

  qaTest("coverage.attainment-rate-chart.with-data", () => {
    render(<AttainmentRateChart submittedData={submittedData} criteria={criteria} />);
    expect(screen.getByText("PO1")).toBeInTheDocument();
  });
});

describe("ThresholdGapChart", () => {
  qaTest("coverage.threshold-gap-chart.empty-state", () => {
    render(<ThresholdGapChart submittedData={[]} criteria={[]} />);
    expect(screen.getByText("No Gap Data")).toBeInTheDocument();
  });

  qaTest("coverage.threshold-gap-chart.with-data", () => {
    render(<ThresholdGapChart submittedData={submittedData} criteria={criteria} />);
    expect(screen.getByText("PO1")).toBeInTheDocument();
  });
});

describe("CoverageMatrix", () => {
  qaTest("coverage.coverage-matrix.empty-state", () => {
    render(<CoverageMatrix criteria={[]} outcomes={[]} />);
    expect(screen.getByText("No Outcomes Configured")).toBeInTheDocument();
  });

  qaTest("coverage.coverage-matrix.with-data", () => {
    render(<CoverageMatrix criteria={criteria} outcomes={outcomes} />);
    expect(screen.getByText("OUTCOME")).toBeInTheDocument();
    expect(screen.getByText("PO1")).toBeInTheDocument();
  });
});

describe("GroupAttainmentHeatmap", () => {
  qaTest("coverage.group-attainment-heatmap.empty-state", () => {
    render(<GroupAttainmentHeatmap dashboardStats={[]} submittedData={[]} criteria={[]} />);
    expect(screen.getByText("No Group Data")).toBeInTheDocument();
  });

  qaTest("coverage.group-attainment-heatmap.with-data", () => {
    render(
      <GroupAttainmentHeatmap
        dashboardStats={groups}
        submittedData={submittedData}
        criteria={criteria}
      />
    );
    expect(screen.getByText(/Criterion/)).toBeInTheDocument();
  });
});

describe("JurorConsistencyHeatmap", () => {
  qaTest("coverage.juror-consistency-heatmap.empty-state", () => {
    render(
      <JurorConsistencyHeatmap dashboardStats={[]} submittedData={[]} criteria={[]} />
    );
    expect(screen.getByText("No Consistency Data")).toBeInTheDocument();
  });
});

describe("OutcomeAttainmentHeatmap", () => {
  qaTest("coverage.outcome-attainment-heatmap.empty-state", () => {
    render(<OutcomeAttainmentHeatmap rows={[]} outcomeMeta={[]} />);
    expect(screen.getByText("No Attainment History")).toBeInTheDocument();
  });

  qaTest("coverage.outcome-attainment-heatmap.with-data", () => {
    const rows = [{ period: "Spring 2024", PO1_att: 80, PO1_avg: 75 }];
    const outcomeMeta = [
      { code: "PO1", label: "Engineering", attKey: "PO1_att", avgKey: "PO1_avg", color: "#22c55e" },
    ];
    render(<OutcomeAttainmentHeatmap rows={rows} outcomeMeta={outcomeMeta} />);
    expect(screen.getByText("Outcome")).toBeInTheDocument();
    expect(screen.getByText("Spring 2024")).toBeInTheDocument();
  });
});
