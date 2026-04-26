import { describe, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

import OutcomePillSelector from "../OutcomePillSelector";

describe("OutcomePillSelector", () => {
  qaTest("coverage.outcome-pill-selector.empty-state", () => {
    render(
      <OutcomePillSelector
        selected={[]}
        outcomeConfig={[]}
        onChange={vi.fn()}
        disabled={false}
      />
    );
    expect(screen.getByText("No outcomes defined yet.")).toBeInTheDocument();
  });

  qaTest("coverage.outcome-pill-selector.renders-pills", () => {
    const outcomes = [
      { code: "PO1", label: "Engineering Design", desc_en: "Design engineering systems" },
      { code: "PO2", label: "Analysis", desc_en: "Analyze complex problems" },
    ];
    render(
      <OutcomePillSelector
        selected={["PO1"]}
        outcomeConfig={outcomes}
        onChange={vi.fn()}
        disabled={false}
      />
    );
    expect(screen.getAllByText("PO1").length).toBeGreaterThan(0);
    expect(screen.getByText("PO2")).toBeInTheDocument();
  });
});
