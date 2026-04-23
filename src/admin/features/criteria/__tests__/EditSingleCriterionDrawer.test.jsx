import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Drawer", () => ({
  default: ({ open, children }) => (open ? <div data-testid="drawer">{children}</div> : null),
}));
vi.mock("@/shared/ui/AutoTextarea", () => ({ default: () => null }));
vi.mock("@/shared/ui/AlertCard", () => ({ default: () => null }));
vi.mock("@/shared/ui/InlineError", () => ({ default: () => null }));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({ default: () => null }));
vi.mock("@/shared/constants", () => ({ RUBRIC_EDITOR_TEXT: {} }));
vi.mock("@/shared/criteriaValidation", () => ({
  validateCriterion: vi.fn(() => ({
    errors: {},
    rubricErrors: { bandRangeErrors: {}, bandLevelErrors: {}, bandDescErrors: {}, coverageError: false },
  })),
}));
vi.mock("@/shared/criteria/criteriaHelpers", () => ({
  criterionToConfig: vi.fn((r) => r),
}));
vi.mock("../criteriaFormHelpers", () => ({
  templateToRow: vi.fn((c) => ({ _id: "r0", label: c.label ?? "", max: "30", rubric: [], outcomes: [] })),
  emptyRow: vi.fn(() => ({ _id: "empty", label: "", max: "30", rubric: [], outcomes: [] })),
  clampRubricBandsToCriterionMax: vi.fn((r) => r),
  rescaleRubricBandsByWeight: vi.fn((r) => r),
  defaultRubricBands: vi.fn(() => []),
  getConfigRubricSeed: vi.fn(() => null),
}));
vi.mock("../OutcomePillSelector", () => ({ default: () => null }));
vi.mock("../RubricBandEditor", () => ({ default: () => null }));

import EditSingleCriterionDrawer from "../EditSingleCriterionDrawer";

const DEFAULT_PO = {
  outcomes: [],
  mappings: [],
  addMapping: vi.fn(),
  removeMapping: vi.fn(),
};

describe("EditSingleCriterionDrawer", () => {
  qaTest("admin.criteria.drawer.single", () => {
    render(
      <EditSingleCriterionDrawer
        open={true}
        onClose={vi.fn()}
        period={null}
        criterion={null}
        editIndex={-1}
        criteriaConfig={[]}
        outcomeConfig={[]}
        onSave={vi.fn()}
        disabled={false}
        isLocked={false}
        po={DEFAULT_PO}
      />
    );
    expect(screen.getAllByText("Add Criterion").length).toBeGreaterThan(0);
  });
});
