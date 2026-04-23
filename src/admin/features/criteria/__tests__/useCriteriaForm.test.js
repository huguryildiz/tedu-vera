import { describe, vi, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@dnd-kit/core", () => ({
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...args) => args),
  PointerSensor: class {},
  TouchSensor: class {},
}));

vi.mock("@/shared/criteriaValidation", () => ({
  validatePeriodCriteria: vi.fn(() => ({
    errors: {},
    rubricErrorsByCriterion: {},
    totalMax: 100,
  })),
  isDisposableEmptyDraftCriterion: vi.fn(() => false),
}));

vi.mock("@/shared/criteria/criteriaHelpers", () => ({
  criterionToConfig: vi.fn((r) => r),
}));

vi.mock("../criteriaFormHelpers", () => ({
  templateToRow: vi.fn((c, i) => ({
    _id: `row-${i}`,
    label: c.label,
    max: String(c.max ?? 30),
    rubric: [],
    outcomes: [],
  })),
  emptyRow: vi.fn(() => ({
    _id: "empty-0",
    label: "",
    max: "30",
    rubric: [],
    outcomes: [],
  })),
  clampRubricBandsToCriterionMax: vi.fn((r) => r),
  defaultRubricBands: vi.fn(() => []),
  getConfigRubricSeed: vi.fn(() => null),
}));

import { useCriteriaForm } from "../useCriteriaForm";

describe("useCriteriaForm", () => {
  qaTest("admin.criteria.form.init", () => {
    const template = [{ label: "Technical Quality", max: 40, rubric: [], outcomes: [] }];
    const { result } = renderHook(() =>
      useCriteriaForm({
        template,
        outcomeConfig: [],
        onSave: vi.fn(),
        onDirtyChange: vi.fn(),
        disabled: false,
        isLocked: false,
      })
    );
    expect(result.current.rows[0].label).toBe("Technical Quality");
  });

  qaTest("admin.criteria.form.empty", () => {
    const { result } = renderHook(() =>
      useCriteriaForm({
        template: [],
        outcomeConfig: [],
        onSave: vi.fn(),
        onDirtyChange: vi.fn(),
        disabled: false,
        isLocked: false,
      })
    );
    expect(result.current.rows).toHaveLength(1);
  });
});
