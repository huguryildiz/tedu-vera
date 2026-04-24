import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/CustomSelect", () => ({ default: () => null }));

import JurorsFilterPanel from "../JurorsFilterPanel";

const noop = vi.fn();
const baseProps = {
  affiliations: [],
  statusFilter: "",
  affilFilter: "",
  progressFilter: "",
  onStatusChange: noop,
  onAffilChange: noop,
  onProgressChange: noop,
  onClearAll: noop,
  onClose: noop,
};

describe("JurorsFilterPanel", () => {
  qaTest("coverage.jurors-filter-panel.renders", () => {
    render(<JurorsFilterPanel {...baseProps} />);
    expect(screen.getByText(/Filter Jurors/)).toBeInTheDocument();
  });

  qaTest("coverage.jurors-filter-panel.close-button", () => {
    render(<JurorsFilterPanel {...baseProps} />);
    expect(screen.getByText("×")).toBeInTheDocument();
  });
});
