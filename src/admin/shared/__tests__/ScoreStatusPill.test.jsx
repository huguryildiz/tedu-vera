import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Icons", () => ({
  CheckIcon: () => <span data-testid="check-icon" />,
  CircleDotDashedIcon: () => <span data-testid="partial-icon" />,
  CircleIcon: () => <span data-testid="empty-icon" />,
}));

import ScoreStatusPill from "../ScoreStatusPill";

describe("ScoreStatusPill", () => {
  qaTest("coverage.score-status-pill.scored", () => {
    render(<ScoreStatusPill status="scored" />);
    expect(screen.getByText("Scored")).toBeInTheDocument();
  });

  qaTest("coverage.score-status-pill.partial", () => {
    render(<ScoreStatusPill status="partial" />);
    expect(screen.getByText("Partial")).toBeInTheDocument();
  });

  qaTest("coverage.score-status-pill.empty-fallback", () => {
    render(<ScoreStatusPill status="unknown_xyz" />);
    expect(screen.getByText("Empty")).toBeInTheDocument();
  });
});
