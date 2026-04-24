import { describe, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

import CoverageBar from "../CoverageBar";

describe("CoverageBar", () => {
  qaTest("coverage.coverage-bar.empty", () => {
    const { container } = render(<CoverageBar bands={[]} maxScore={30} />);
    expect(container.firstChild).toBeNull();
  });

  qaTest("coverage.coverage-bar.with-bands", () => {
    const bands = [
      { min: 0, max: 14, level: "Insufficient" },
      { min: 15, max: 22, level: "Developing" },
      { min: 23, max: 30, level: "Excellent" },
    ];
    render(<CoverageBar bands={bands} maxScore={30} />);
    expect(screen.getByText("Score Coverage")).toBeInTheDocument();
  });
});
