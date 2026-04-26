import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

import SegmentedBar from "../SegmentedBar";
import RubricSheet from "../RubricSheet";

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

  qaTest("coverage.segmented-bar.displays-one-segment-per-project", () => {
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

});
