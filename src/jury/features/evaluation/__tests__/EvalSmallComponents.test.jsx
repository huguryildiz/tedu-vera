import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

import SegmentedBar from "../SegmentedBar";
import RubricSheet from "../RubricSheet";
import ProjectDrawer from "../ProjectDrawer";

describe("SegmentedBar", () => {
  qaTest("coverage.segmented-bar.returns-null-empty", () => {
    const { container } = render(
      <SegmentedBar
        projects={[]}
        scores={{}}
        criteria={[]}
        current={0}
        onNavigate={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  qaTest("coverage.segmented-bar.renders-segments", () => {
    const projects = [
      { project_id: "p1", title: "Alpha" },
      { project_id: "p2", title: "Beta" },
    ];
    render(
      <SegmentedBar
        projects={projects}
        scores={{}}
        criteria={[{ id: "technical", max: 30 }]}
        current={0}
        onNavigate={vi.fn()}
      />
    );
    expect(screen.getByText(/scored/)).toBeInTheDocument();
  });
});

describe("RubricSheet", () => {
  qaTest("coverage.rubric-sheet.null-no-crit", () => {
    const { container } = render(
      <RubricSheet crit={null} score="" outcomeLookup={{}} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  qaTest("coverage.rubric-sheet.renders", () => {
    const crit = {
      id: "technical",
      label: "Technical",
      max: 30,
      color: "#22c55e",
      blurb: "Technical quality",
      rubric: [
        { level: "Excellent", min: 25, max: 30, desc: "Outstanding work" },
        { level: "Good", min: 15, max: 24, desc: "Solid work" },
      ],
      outcomes: [],
    };
    render(
      <RubricSheet crit={crit} score="28" outcomeLookup={{}} onClose={vi.fn()} />
    );
    expect(screen.getByText("Technical")).toBeInTheDocument();
  });
});

describe("ProjectDrawer", () => {
  qaTest("coverage.project-drawer.renders", () => {
    const projects = [
      { project_id: "p1", title: "Alpha Group", members: ["Alice", "Bob"] },
    ];
    render(
      <ProjectDrawer
        open={true}
        onClose={vi.fn()}
        projects={projects}
        scores={{}}
        criteria={[{ id: "technical", max: 30 }]}
        current={0}
        onNavigate={vi.fn()}
      />
    );
    expect(screen.getByText("Alpha Group")).toBeInTheDocument();
    expect(screen.getByText("Select Group")).toBeInTheDocument();
  });
});
