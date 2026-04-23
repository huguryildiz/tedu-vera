import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/FbAlert", () => ({
  default: ({ children }) => <div data-testid="fb-alert">{children}</div>,
}));

vi.mock("../../../shared/SpotlightTour", () => ({
  default: () => null,
}));

vi.mock("../RubricSheet", () => ({
  default: () => <div data-testid="rubric-sheet" />,
}));

vi.mock("../SegmentedBar", () => ({
  default: () => <div data-testid="segmented-bar" />,
}));

vi.mock("../ProjectDrawer", () => ({
  default: () => null,
}));

vi.mock("@/shared/ui/EntityMeta", () => ({
  TeamMemberNames: ({ names }) => <span>{(names || []).join(", ")}</span>,
}));

import EvalStep from "../EvalStep";

const CRITERIA = [{ id: "technical", label: "Technical", max: 25, color: "#60a5fa" }];
const PROJECT = {
  project_id: "proj-1",
  title: "Smart Home System",
  members: ["Ali", "Veli"],
};

function makeState(overrides = {}) {
  return {
    project: PROJECT,
    projects: [PROJECT],
    current: 0,
    scores: { "proj-1": { technical: "" } },
    comments: { "proj-1": "" },
    effectiveCriteria: CRITERIA,
    juryName: "Jane Doe",
    affiliation: "TEDU",
    saveStatus: "saved",
    editLockActive: false,
    allComplete: false,
    handleScore: vi.fn(),
    handleCommentChange: vi.fn(),
    handleCommentBlur: vi.fn(),
    handleScoreBlur: vi.fn(),
    handleNavigate: vi.fn(),
    handleRequestSubmit: vi.fn(),
    ...overrides,
  };
}

describe("EvalStep", () => {
  qaTest("jury.step.eval.01", () => {
    const state = makeState();
    render(<EvalStep state={state} onBack={vi.fn()} />);
    expect(screen.getByText("Smart Home System")).toBeInTheDocument();
  });

  qaTest("jury.step.eval.02", () => {
    const state = makeState({ project: null });
    render(<EvalStep state={state} onBack={vi.fn()} />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
