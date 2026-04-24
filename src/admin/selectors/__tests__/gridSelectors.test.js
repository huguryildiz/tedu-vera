import { describe, expect, vi } from "vitest";
import { qaTest } from "../../../test/qaTest.js";

// scoreHelpers imports Lucide icons — mock the whole module for selector isolation
vi.mock("@/admin/utils/scoreHelpers", () => ({
  getCellState: vi.fn((entry, criteria = []) => {
    if (!entry) return "empty";
    const filled = (criteria || []).filter((c) => entry[c.id] != null).length;
    if (filled === 0) return "empty";
    return filled === criteria.length ? "scored" : "partial";
  }),
  getPartialTotal: vi.fn((entry, criteria = []) => {
    if (!entry) return 0;
    return (criteria || []).reduce(
      (sum, c) => sum + (typeof entry[c.id] === "number" ? entry[c.id] : 0),
      0
    );
  }),
  getJurorWorkflowState: vi.fn(() => "not_started"),
  jurorStatusMeta: {
    not_started:      { label: "Not Started" },
    in_progress:      { label: "In Progress" },
    completed:        { label: "Completed" },
    ready_to_submit:  { label: "Ready to Submit" },
    editing:          { label: "Editing" },
  },
}));

import {
  buildLookup,
  buildJurorFinalMap,
  filterCompletedJurors,
  computeGroupAverages,
  buildExportRowsData,
} from "../gridSelectors.js";

const CRITERIA = [{ id: "design" }, { id: "delivery" }];

describe("gridSelectors — buildLookup", () => {
  qaTest("grid.sel.01", () => {
    const data = [
      { jurorId: "j1", juryName: "Alice", affiliation: "MIT", projectId: "p1", total: 80, status: "ok", editingFlag: false, finalSubmittedAt: "2025-06-01", design: 40, delivery: 40 },
      { jurorId: "j1", juryName: "Alice", affiliation: "MIT", projectId: "p2", total: 75, status: "ok", editingFlag: false, finalSubmittedAt: "",         design: 35, delivery: 40 },
      { jurorId: "j2", juryName: "Bob",   affiliation: "CU",  projectId: "p1", total: 70, status: "ok", editingFlag: false, finalSubmittedAt: "",         design: 30, delivery: 40 },
    ];

    const lookup = buildLookup(data, CRITERIA);

    // jurorId-based key: "j1" (rowKey prefers jurorId)
    expect(lookup["j1"]).toBeDefined();
    expect(lookup["j1"]["p1"].total).toBe(80);
    expect(lookup["j1"]["p1"].design).toBe(40);
    expect(lookup["j1"]["p2"].total).toBe(75);
    expect(lookup["j2"]["p1"].total).toBe(70);

    // Handles null/undefined data
    expect(buildLookup(null, CRITERIA)).toEqual({});
    expect(buildLookup([], CRITERIA)).toEqual({});
  });
});

describe("gridSelectors — buildJurorFinalMap", () => {
  qaTest("grid.sel.02", () => {
    const jurors = [
      { key: "j1", finalSubmitted: true,  finalSubmittedAt: "2025-06-01" },
      { key: "j2", finalSubmitted: false, finalSubmittedAt: "" },
      { key: "j3", finalSubmitted: null,  finalSubmittedAt: null },
    ];
    const map = buildJurorFinalMap(jurors);
    expect(map.get("j1")).toBe(true);
    expect(map.get("j2")).toBe(false);
    expect(map.get("j3")).toBe(false);

    expect(buildJurorFinalMap(null).size).toBe(0);
    expect(buildJurorFinalMap([]).size).toBe(0);
  });
});

describe("gridSelectors — filterCompletedJurors", () => {
  qaTest("grid.sel.03", () => {
    const jurors = [
      { key: "j1", finalSubmitted: true,  finalSubmittedAt: "2025-06-01", editEnabled: false },
      { key: "j2", finalSubmitted: true,  finalSubmittedAt: "2025-06-01", editEnabled: true  }, // editing — excluded
      { key: "j3", finalSubmitted: false, finalSubmittedAt: null,         editEnabled: false },
      { key: "j4", finalSubmittedAt: "2025-06-01", editEnabled: false },
    ];

    const result = filterCompletedJurors(jurors);
    expect(result).toHaveLength(2);
    expect(result.map((j) => j.key)).toContain("j1");
    expect(result.map((j) => j.key)).toContain("j4");
    expect(result.map((j) => j.key)).not.toContain("j2");
    expect(result.map((j) => j.key)).not.toContain("j3");

    expect(filterCompletedJurors(null)).toEqual([]);
    expect(filterCompletedJurors([])).toEqual([]);
  });
});

describe("gridSelectors — computeGroupAverages", () => {
  qaTest("grid.sel.04", () => {
    const groups = [{ id: "g1" }, { id: "g2" }];
    const jurors = [
      { key: "j1" },
      { key: "j2" },
    ];
    const lookup = {
      j1: {
        g1: { design: 40, delivery: 40, total: 80 },
        g2: { design: 35, delivery: 35, total: 70 },
      },
      j2: {
        g1: { design: 30, delivery: 40, total: 70 },
        g2: null, // no entry
      },
    };

    // getCellState mock: entry with all criteria → "scored"
    const avgs = computeGroupAverages(jurors, groups, lookup, CRITERIA);
    // g1: both scored → (80 + 70) / 2 = 75.00
    expect(avgs[0]).toBe("75.00");
    // g2: j1 scored (70), j2 null (empty) → only j1 → 70.00
    expect(avgs[1]).toBe("70.00");

    // No completed jurors → all null
    const noJurors = computeGroupAverages([], groups, lookup, CRITERIA);
    expect(noJurors).toEqual([null, null]);

    // Empty groups
    expect(computeGroupAverages(jurors, [], lookup, CRITERIA)).toEqual([]);
  });
});

describe("gridSelectors — computeGroupAverages (edge cases)", () => {
  qaTest("grid.sel.07", () => {
    const groups = [{ id: "g1" }, { id: "g2" }, { id: "g3" }];

    // Juror j1: fully scored g1 and g2; Juror j2: completely absent from lookup
    const jurors = [{ key: "j1" }, { key: "j2" }];
    const lookup = {
      j1: {
        g1: { design: 40, delivery: 40, total: 80 },
        g2: { design: 35, delivery: 35, total: 70 },
        // g3 not present → entry = undefined → getCellState("empty") → excluded
      },
      // j2 not in lookup at all → lookup["j2"] is undefined → entry = undefined
    };

    const avgs = computeGroupAverages(jurors, groups, lookup, CRITERIA);
    // g1: j1 scored(80), j2 absent(null) → only j1 → 80.00
    expect(avgs[0]).toBe("80.00");
    // g2: j1 scored(70), j2 absent(null) → only j1 → 70.00
    expect(avgs[1]).toBe("70.00");
    // g3: j1 absent(null), j2 absent(null) → no valid vals → null
    expect(avgs[2]).toBeNull();

    // Juror with partial scores → getCellState returns "partial" → excluded
    const partialLookup = {
      j1: {
        g1: { design: 40, delivery: null, total: null }, // partial: only 1 of 2 criteria
      },
    };
    // getCellState mock: filled=1, criteria.length=2 → "partial" → not "scored" → excluded
    const partialAvgs = computeGroupAverages([{ key: "j1" }], [{ id: "g1" }], partialLookup, CRITERIA);
    expect(partialAvgs[0]).toBeNull();

    // Multiple jurors with mixed scored/partial/absent across two groups
    const j3 = { key: "j3" };
    const j4 = { key: "j4" };
    const mixedLookup = {
      j3: {
        g1: { design: 40, delivery: 40, total: 80 }, // scored
        g2: { design: 30, delivery: null, total: null }, // partial → excluded
      },
      j4: {
        g1: { design: 30, delivery: 30, total: 60 }, // scored
        // g2 absent → excluded
      },
    };
    const mixedAvgs = computeGroupAverages([j3, j4], [{ id: "g1" }, { id: "g2" }], mixedLookup, CRITERIA);
    // g1: j3(80) + j4(60) → 70.00
    expect(mixedAvgs[0]).toBe("70.00");
    // g2: j3 partial(excluded), j4 absent(excluded) → null
    expect(mixedAvgs[1]).toBeNull();
  });
});

describe("gridSelectors — buildExportRowsData (edge cases)", () => {
  qaTest("grid.sel.08", () => {
    const jurorFinalMap = new Map([["j1", true]]);
    const jurorWorkflowMap = new Map([["j1", "completed"]]);

    // Empty groups array → rows have empty scores object, no crash
    const jurors = [{ key: "j1", name: "Alice", dept: "MIT" }];
    const lookup = { j1: { g1: { design: 40, delivery: 40, total: 80 } } };
    const rows = buildExportRowsData(jurors, [], lookup, jurorFinalMap, jurorWorkflowMap, CRITERIA);
    expect(rows).toHaveLength(1);
    expect(rows[0].scores).toEqual({});

    // Juror completely absent from lookup → all scores null, no crash
    const groups = [{ id: "g1" }, { id: "g2" }];
    const emptyLookup = {}; // j1 not present at all
    const rows2 = buildExportRowsData(jurors, groups, emptyLookup, jurorFinalMap, jurorWorkflowMap, CRITERIA);
    expect(rows2).toHaveLength(1);
    expect(rows2[0].scores["g1"]).toBeNull();
    expect(rows2[0].scores["g2"]).toBeNull();
  });
});

describe("gridSelectors — buildExportRowsData", () => {
  qaTest("grid.sel.05", () => {
    const groups = [{ id: "g1" }, { id: "g2" }];
    const jurors = [
      { key: "j1", name: "Alice", dept: "MIT" },
    ];
    const lookup = {
      j1: {
        g1: { design: 40, delivery: 40, total: 80 },
        g2: null, // not scored
      },
    };
    const jurorFinalMap = new Map([["j1", true]]);
    const jurorWorkflowMap = new Map([["j1", "completed"]]);

    const rows = buildExportRowsData(jurors, groups, lookup, jurorFinalMap, jurorWorkflowMap, CRITERIA);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Alice");
    expect(rows[0].dept).toBe("MIT");
    expect(rows[0].statusLabel).toBe("Completed");
    // g1 scored → numeric total; g2 null entry → null score
    expect(rows[0].scores["g1"]).toBe(80);
    expect(rows[0].scores["g2"]).toBeNull();

    // Empty input
    expect(buildExportRowsData(null, groups, lookup, jurorFinalMap, jurorWorkflowMap, CRITERIA)).toEqual([]);
  });

  qaTest("grid.sel.06", () => {
    const groups = [{ id: "g1" }, { id: "g2" }];
    const jurors = [{ key: "j1", name: "Bob", dept: "EE" }];
    const lookup = {
      j1: {
        g1: { design: 38, delivery: 42, total: 80 },
        g2: { design: 30, delivery: null, total: null },
      },
    };
    const jurorFinalMap = new Map([["j1", false]]);
    const jurorWorkflowMap = new Map([["j1", "in_progress"]]);

    // activeTab = "design" → scores should be the criterion value, not total
    const rows = buildExportRowsData(jurors, groups, lookup, jurorFinalMap, jurorWorkflowMap, CRITERIA, "design");
    expect(rows[0].scores["g1"]).toBe(38);
    // g2 has design=30 even though total is null
    expect(rows[0].scores["g2"]).toBe(30);

    // activeTab = "delivery" with null value → null
    const rows2 = buildExportRowsData(jurors, groups, lookup, jurorFinalMap, jurorWorkflowMap, CRITERIA, "delivery");
    expect(rows2[0].scores["g1"]).toBe(42);
    expect(rows2[0].scores["g2"]).toBeNull();

    // activeTab = "all" (default) still returns total
    const rowsAll = buildExportRowsData(jurors, groups, lookup, jurorFinalMap, jurorWorkflowMap, CRITERIA, "all");
    expect(rowsAll[0].scores["g1"]).toBe(80);
  });
});
