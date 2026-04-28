import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

const EMPTY_ARRAY = Object.freeze([]);

// Real useCriteriaForm + criteriaFormHelpers run. Template totals 100
// so the weight summary renders the "100" text node and the "Valid"
// badge (totalOk=true). Sub-components stay mocked to keep scope tight.
const VALID_TEMPLATE = Object.freeze([
  Object.freeze({
    key: "k1",
    label: "Criterion 1",
    shortLabel: "C1",
    color: "#3b82f6",
    max: 100,
    blurb: "blurb",
    outcomes: [],
    rubric: [],
  }),
]);

vi.mock("../CriterionEditor", () => ({
  default: () => <div data-testid="criterion-editor" />,
}));

vi.mock("../CriterionDeleteDialog", () => ({
  default: () => null,
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }) => <>{children}</>,
  closestCenter: null,
  PointerSensor: class {},
  TouchSensor: class {},
  useSensor: () => null,
  useSensors: () => EMPTY_ARRAY,
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }) => <>{children}</>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: null,
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

vi.mock("@/shared/ui/AlertCard", () => ({
  default: ({ children }) => <div data-testid="alert-card">{children}</div>,
}));

vi.mock("@/shared/ui/Icons", () => ({
  LockIcon: () => <span data-testid="lock-icon" />,
}));

import CriteriaManager from "../CriteriaManager";

describe("CriteriaManager", () => {
  qaTest("coverage.criteria-manager.weight-summary", () => {
    render(<CriteriaManager template={VALID_TEMPLATE} outcomeConfig={EMPTY_ARRAY} />);
    expect(screen.getByText("Total weight")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  qaTest("coverage.criteria-manager.locked-notice", () => {
    render(
      <CriteriaManager
        template={VALID_TEMPLATE}
        outcomeConfig={EMPTY_ARRAY}
        isLocked={true}
      />
    );
    expect(
      screen.getByText(/Scores exist for this period/)
    ).toBeInTheDocument();
  });

});
