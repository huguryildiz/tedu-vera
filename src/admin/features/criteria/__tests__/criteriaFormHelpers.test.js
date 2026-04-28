import { describe, expect, vi } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";

vi.mock("@/shared/constants", () => ({
  RUBRIC_DEFAULT_LEVELS: ["Excellent", "Good", "Developing", "Insufficient"],
}));

vi.mock("@/shared/criteria/criteriaHelpers", () => ({
  normalizeCriterion: (c) => ({
    key: c.key ?? c.id ?? "",
    label: c.label ?? "",
    shortLabel: c.shortLabel ?? "",
    color: c.color ?? "#3b82f6",
    max: c.max ?? 30,
    blurb: c.blurb ?? "",
    outcomes: c.outcomes ?? [],
    rubric: c.rubric ?? [],
  }),
}));

import {
  CRITERION_COLORS,
  nextCriterionColor,
  defaultRubricBands,
  getConfigRubricSeed,
  clampToCriterionMax,
  getBandDisplayLabel,
  getBandRangeLabel,
  getCriterionTintStyle,
  getCriterionDisplayName,
  rescaleRubricBandsByWeight,
} from "../criteriaFormHelpers.js";

describe("admin/features/criteria/criteriaFormHelpers", () => {
  qaTest("criteria.helpers.01", () => {
    const existingRows = [{ color: "#3b82f6" }, { color: "#8b5cf6" }];
    const next = nextCriterionColor(existingRows);
    expect(next).toBe("#f59e0b"); // 3rd palette color
    expect(CRITERION_COLORS).toContain(next);
  });

  qaTest("criteria.helpers.02", () => {
    // All 8 palette colors used — wraps around to index 0
    const existingRows = CRITERION_COLORS.map((color) => ({ color }));
    const next = nextCriterionColor(existingRows);
    expect(next).toBe(CRITERION_COLORS[existingRows.length % CRITERION_COLORS.length]);
  });

  qaTest("criteria.helpers.03", () => {
    const bands = defaultRubricBands(30);
    expect(bands).toHaveLength(4);
    expect(bands[0].level).toBe("Excellent");
    expect(bands[1].level).toBe("Good");
    expect(bands[2].level).toBe("Developing");
    expect(bands[3].level).toBe("Insufficient");
    expect(bands[0].min).toBe(27); // Math.round(30 * 0.9)
    expect(bands[0].max).toBe(30);
    expect(bands[3].min).toBe(0);
  });

  qaTest("criteria.helpers.04", () => {
    const bands = defaultRubricBands(null);
    expect(bands).toHaveLength(4);
    // Falls back to m = 30
    expect(bands[0].max).toBe(30);
    expect(bands[3].min).toBe(0);
  });

  qaTest("criteria.helpers.05", () => {
    const rubric = [{ level: "Excellent", min: 27, max: 30, desc: "" }];
    const criteria = [{ id: "c1", key: "c1", rubric }];
    const result = getConfigRubricSeed({ _key: "c1" }, criteria);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(rubric[0]);
    expect(result[0]).not.toBe(rubric[0]); // shallow copy, not same reference
  });

  qaTest("criteria.helpers.06", () => {
    const criteria = [{ id: "c1", key: "c1", rubric: [{ level: "Excellent" }] }];
    expect(getConfigRubricSeed({ _key: "no-match" }, criteria)).toBeNull();
    expect(getConfigRubricSeed(null, criteria)).toBeNull();
  });

  qaTest("criteria.helpers.07", () => {
    expect(clampToCriterionMax(50, 30)).toBe("30");
    expect(clampToCriterionMax(25, 30)).toBe("25");
    expect(clampToCriterionMax(-5, 30)).toBe("0");
  });

  qaTest("criteria.helpers.08", () => {
    expect(clampToCriterionMax("", 30)).toBe("");
  });

  qaTest("criteria.helpers.09", () => {
    const bands = [{ level: "Excellent" }, { level: "Good" }];
    expect(getBandDisplayLabel(bands, 0)).toBe("Excellent");
    expect(getBandDisplayLabel(bands, 1)).toBe("Good");
  });

  qaTest("criteria.helpers.10", () => {
    const bands = [{ level: "" }, { level: "   " }];
    expect(getBandDisplayLabel(bands, 0)).toBe("Band 1");
    expect(getBandDisplayLabel(bands, 1)).toBe("Band 2");
    expect(getBandDisplayLabel(null, 0)).toBe("Band 1");
  });

  qaTest("criteria.helpers.11", () => {
    expect(getBandRangeLabel({ min: 27, max: 30 })).toBe("27–30");
    expect(getBandRangeLabel({ min: 0, max: 12 })).toBe("0–12");
    expect(getBandRangeLabel({ min: "abc", max: 30 })).toBe("");
  });

  qaTest("criteria.helpers.12", () => {
    const style = getCriterionTintStyle("#3b82f6");
    expect(style.backgroundColor).toBe("#3b82f622");
    expect(style.borderColor).toBe("#3b82f6");
    expect(style.color).toBe("#3b82f6");
  });

  qaTest("criteria.helpers.13", () => {
    expect(getCriterionDisplayName({ label: "Technical" }, 0)).toBe("Technical");
    expect(getCriterionDisplayName({ label: "", shortLabel: "Tech" }, 0)).toBe("Tech");
    expect(getCriterionDisplayName({ label: "", shortLabel: "" }, 2)).toBe("Criterion 3");
  });

  qaTest("criteria.helpers.14", () => {
    // rescaleRubricBandsByWeight: the highest band max must equal newMax (totalWeight).
    const bands = [
      { min: 0, max: 30, level: "Insufficient", desc: "" },
      { min: 30, max: 50, level: "Developing", desc: "" },
      { min: 50, max: 100, level: "Excellent", desc: "" },
    ];
    const newMax = 40;
    const rescaled = rescaleRubricBandsByWeight(bands, newMax);
    const totalWeight = Number(rescaled[rescaled.length - 1].max);
    expect(totalWeight).toBe(newMax);
  });
});
