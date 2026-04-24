import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

const EMPTY_ARRAY = Object.freeze([]);

const MOCK_FORM = Object.freeze({
  rows: EMPTY_ARRAY,
  activeRows: EMPTY_ARRAY,
  saveError: "",
  saving: false,
  saveAttempted: false,
  pendingDeleteIndex: null,
  setPendingDeleteIndex: vi.fn(),
  errors: {},
  rubricErrorsByCriterion: {},
  totalMax: 100,
  totalOk: true,
  saveBlockReasons: EMPTY_ARRAY,
  canSave: true,
  fullyLocked: false,
  outcomeByCode: new Map(),
  sanitizeOutcomeSelection: (s) => s || EMPTY_ARRAY,
  markTouched: vi.fn(),
  setRow: vi.fn(),
  addRow: vi.fn(),
  requestRemoveRow: vi.fn(),
  confirmRemoveRow: vi.fn(),
  toggleRubric: vi.fn(),
  toggleOutcome: vi.fn(),
  toggleCriterionCard: vi.fn(),
  sensors: EMPTY_ARRAY,
  handleDragEnd: vi.fn(),
  handleSave: vi.fn(),
});

vi.mock("../useCriteriaForm", () => ({
  useCriteriaForm: () => ({ ...MOCK_FORM }),
}));

vi.mock("../CriterionEditor", () => ({
  default: () => <div data-testid="criterion-editor" />,
}));

vi.mock("../CriterionDeleteDialog", () => ({
  default: () => null,
}));

vi.mock("../criteriaFormHelpers", () => ({
  getCriterionDisplayName: () => "Criterion 1",
  templateToRow: (c, i) => ({ ...c, _id: `row-${i}` }),
  emptyRow: () => ({ _id: "empty-0" }),
  clampRubricBandsToCriterionMax: (bands) => bands,
  defaultRubricBands: [],
  getConfigRubricSeed: () => [],
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
    render(<CriteriaManager template={EMPTY_ARRAY} outcomeConfig={EMPTY_ARRAY} />);
    expect(screen.getByText("Total weight")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  qaTest("coverage.criteria-manager.locked-notice", () => {
    render(
      <CriteriaManager
        template={EMPTY_ARRAY}
        outcomeConfig={EMPTY_ARRAY}
        isLocked={true}
      />
    );
    expect(
      screen.getByText(/Scores exist for this period/)
    ).toBeInTheDocument();
  });

  qaTest("coverage.criteria-manager.add-criterion-btn", () => {
    render(<CriteriaManager template={EMPTY_ARRAY} outcomeConfig={EMPTY_ARRAY} />);
    expect(screen.getByText("Add Criterion")).toBeInTheDocument();
  });
});
