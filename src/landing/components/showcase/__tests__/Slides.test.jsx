import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("../showcaseData", () => ({
  ACTIVITY_FEED: [
    { initials: "EA", who: "Prof. Aslan", action: "scored project", time: "2m ago", color: "#3b82f6" },
  ],
  JURORS: [
    { initials: "EA", name: "Prof. E. Aslan", affiliation: "EE Dept", status: "done", color: "#3b82f6" },
  ],
  PROJECTS: [
    { code: "P01", title: "SmartGrid", score: 91, team: 3 },
    { code: "P02", title: "MedAlert", score: 88, team: 4 },
    { code: "P03", title: "EcoTrack", score: 82, team: 3 },
    { code: "P04", title: "AutoDrive", score: 79, team: 2 },
  ],
  PERIODS: [
    { name: "Spring 2025", status: "active" },
    { name: "Fall 2024", status: "locked" },
  ],
  HEATMAP_DATA: [[88, 91, 82, 79]],
  REVIEW_ROWS: [
    { juror: "Prof. Aslan", project: "P01", initials: "EA", color: "#3b82f6", scores: [25, 22, 27, 8] },
  ],
  CRITERIA: [
    { color: "#f59e0b" }, { color: "#22c55e" }, { color: "#3b82f6" }, { color: "#ef4444" },
  ],
}));

import SlideOverview from "../SlideOverview";
import SlideAnalytics from "../SlideAnalytics";
import SlideCriteria from "../SlideCriteria";
import SlideEntryControl from "../SlideEntryControl";
import SlideJuryFlow from "../SlideJuryFlow";
import SlideManagement from "../SlideManagement";
import SlideEvaluation from "../SlideEvaluation";

describe("SlideOverview", () => {
  qaTest("coverage.slide-overview.renders", () => {
    render(<SlideOverview />);
    expect(screen.getByText("Live Activity")).toBeInTheDocument();
  });
});

describe("SlideAnalytics", () => {
  qaTest("coverage.slide-analytics.renders", () => {
    render(<SlideAnalytics />);
    expect(screen.getByText("analytics")).toBeInTheDocument();
  });
});

describe("SlideCriteria", () => {
  qaTest("coverage.slide-criteria.renders", () => {
    render(<SlideCriteria />);
    expect(screen.getByText("criteria & outcomes")).toBeInTheDocument();
  });
});

describe("SlideEntryControl", () => {
  qaTest("coverage.slide-entry-control.renders", () => {
    render(<SlideEntryControl />);
    expect(screen.getByText("entry-control")).toBeInTheDocument();
  });
});

describe("SlideJuryFlow", () => {
  qaTest("coverage.slide-jury-flow.renders", () => {
    render(<SlideJuryFlow />);
    expect(screen.getByText("jury / scoring")).toBeInTheDocument();
  });
});

describe("SlideManagement", () => {
  qaTest("coverage.slide-management.renders", () => {
    render(<SlideManagement />);
    expect(screen.getByText("management")).toBeInTheDocument();
  });
});

describe("SlideEvaluation", () => {
  qaTest("coverage.slide-evaluation.renders", () => {
    render(<SlideEvaluation />);
    expect(screen.getByText("evaluation")).toBeInTheDocument();
  });
});
