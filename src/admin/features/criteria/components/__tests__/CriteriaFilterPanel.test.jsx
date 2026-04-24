import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/CustomSelect", () => ({ default: () => null }));

import CriteriaFilterPanel from "../CriteriaFilterPanel";

const noop = vi.fn();
const baseProps = {
  mappingFilter: "",
  rubricFilter: "",
  onMappingChange: noop,
  onRubricChange: noop,
  onClose: noop,
  onClearAll: noop,
};

describe("CriteriaFilterPanel", () => {
  qaTest("coverage.criteria-filter-panel.renders", () => {
    render(<CriteriaFilterPanel {...baseProps} />);
    expect(screen.getByText(/Filter Criteria/)).toBeInTheDocument();
  });

  qaTest("coverage.criteria-filter-panel.close-button", () => {
    render(<CriteriaFilterPanel {...baseProps} />);
    expect(screen.getByRole("button", { name: /close filter panel/i })).toBeInTheDocument();
  });
});
