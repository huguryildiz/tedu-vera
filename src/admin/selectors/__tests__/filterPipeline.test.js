import { describe, expect, vi } from "vitest";
import { qaTest } from "../../../test/qaTest.js";

// Mock the hook module — only the pure utility exports matter here
vi.mock("@/admin/features/reviews/useReviewsFilters", () => ({
  buildDateRange: (from, to) => ({ from, to }),
  toFiniteNumber: (v) => (Number.isFinite(Number(v)) ? Number(v) : NaN),
  hasActiveValidNumberRange: (r) => !!(r?.from != null || r?.to != null),
  isMissing: (v) => v == null || v === "",
  buildScoreCols: () => [],
  buildScoreMaxByKey: () => ({}),
  SCORE_COLS: [],
  SCORE_KEYS: [],
  SCORE_FILTER_MIN: 0,
  SCORE_FILTER_MAX: 0,
  SCORE_MAX_BY_KEY: {},
  STATUS_OPTIONS: [],
  JUROR_STATUS_OPTIONS: [],
  SCORE_STATUS_LEGEND: [],
  JUROR_STATUS_LEGEND: [],
  VALID_SORT_DIRS: ["asc", "desc"],
  DEFAULT_SORT_KEY: "updatedMs",
  DEFAULT_SORT_DIR: "desc",
}));

// scoreHelpers is pure — no need to mock
import {
  buildProjectMetaMap,
  buildJurorEditMap,
  buildJurorFinalMap,
  deriveGroupNoOptions,
  computeActiveFilterCount,
} from "../filterPipeline.js";

describe("selectors/filterPipeline — buildProjectMetaMap", () => {
  qaTest("filter.pipe.01", () => {
    const summaryData = [
      { id: "p1", title: "Alpha Project", members: "Alice, Bob" },
      { id: "p2", name: "Beta Project", students: "Charlie" },
    ];
    const map = buildProjectMetaMap(summaryData);
    expect(map.size).toBe(2);
    expect(map.get("p1")).toEqual({ title: "Alpha Project", students: "Alice, Bob", advisor: "" });
    expect(map.get("p2")).toEqual({ title: "Beta Project", students: "Charlie", advisor: "" });
  });

  qaTest("filter.pipe.02", () => {
    expect(buildProjectMetaMap(null).size).toBe(0);
    expect(buildProjectMetaMap([]).size).toBe(0);

    // Missing title / students / advisor → empty strings
    const map = buildProjectMetaMap([{ id: "p3" }]);
    expect(map.get("p3")).toEqual({ title: "", students: "", advisor: "" });
  });
});

describe("selectors/filterPipeline — buildJurorEditMap", () => {
  qaTest("filter.pipe.03", () => {
    const jurors = [
      { jurorId: "j1", name: "Alice", affiliation: "MIT", editEnabled: true },
      { jurorId: "j2", name: "Bob", affiliation: "Harvard", edit_enabled: false },
    ];
    const map = buildJurorEditMap(jurors);
    expect(map.get("j1")).toBe(true);
    expect(map.get("j2")).toBe(false);
    // Compound name__dept key also populated
    expect(map.get("alice__mit")).toBe(true);
    expect(map.get("bob__harvard")).toBe(false);
  });
});

describe("selectors/filterPipeline — buildJurorFinalMap", () => {
  qaTest("filter.pipe.04", () => {
    const jurors = [
      { jurorId: "j1", finalSubmittedAt: "2025-06-15T12:00:00Z", name: "Alice", affiliation: "MIT" },
      { jurorId: "j2", final_submitted_at: "", name: "Bob", affiliation: "Harvard" },
      { jurorId: "j3", name: "Carol", affiliation: "Stanford" },
    ];
    const map = buildJurorFinalMap(jurors);
    expect(map.get("j1")).toBe("2025-06-15T12:00:00Z");
    expect(map.get("j2")).toBe("");
    expect(map.get("j3")).toBe("");
    // Compound key
    expect(map.get("alice__mit")).toBe("2025-06-15T12:00:00Z");
  });
});

describe("selectors/filterPipeline — deriveGroupNoOptions", () => {
  qaTest("filter.pipe.05", () => {
    const data = [
      { groupNo: "G02" },
      { groupNo: "G10" },
      { groupNo: "G02" }, // duplicate
      { groupNo: "G1" },
      { groupNo: "" },    // empty — excluded
    ];
    const opts = deriveGroupNoOptions(data);
    // No duplicates
    expect(opts).toHaveLength(3);
    // Sorted numerically
    expect(opts[0]).toBe("G1");
    expect(opts[1]).toBe("G02");
    expect(opts[2]).toBe("G10");
  });

  qaTest("filter.pipe.06", () => {
    expect(deriveGroupNoOptions(null)).toEqual([]);
    expect(deriveGroupNoOptions([])).toEqual([]);

    // Single entry
    const opts = deriveGroupNoOptions([{ groupNo: "A1" }]);
    expect(opts).toEqual(["A1"]);
  });
});

describe("selectors/filterPipeline — computeActiveFilterCount", () => {
  qaTest("filter.pipe.export-column-count", () => {
    // filter count export: active filter count determines which rows appear in export output
    expect(computeActiveFilterCount({})).toBe(0);
    // Two filters active: juror name + status array → exportColumn row count reduced to matching subset
    expect(
      computeActiveFilterCount({
        filterJuror: "Alice",
        filterStatus: ["completed"],
      })
    ).toBe(2);
    // Only group filter → count = 1
    expect(computeActiveFilterCount({ filterGroupNo: ["G01"] })).toBe(1);
  });
});
