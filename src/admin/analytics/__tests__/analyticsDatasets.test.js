import { describe, expect, vi } from "vitest";
import { qaTest } from "../../../test/qaTest.js";

vi.mock("@/charts", () => ({
  CHART_COPY: {
    outcomeByGroup: { title: "Outcome by Group", note: "" },
    programmeAverages: { title: "Programme Averages", note: "" },
    periodTrend: { title: "Trend", note: "" },
    jurorConsistency: { title: "Juror Consistency", note: "" },
    achievementDistribution: { title: "Achievement Distribution", note: "" },
  },
}));

import {
  buildOutcomes,
  getCriterionColor,
  formatOutcomeCodes,
  outcomeCodeLine,
  computeOverallAvg,
  compareOutcomeCodes,
  buildAttainmentStatusDataset,
  buildAttainmentRateDataset,
  buildOutcomeAttainmentTrendExportDataset,
  buildCoverageMatrixDataset,
  buildThresholdGapDataset,
  buildGroupHeatmapDataset,
} from "../analyticsDatasets.js";

describe("admin/analytics/analyticsDatasets", () => {
  qaTest("analytics.datasets.01", () => {
    const criteria = [
      {
        id: "c1",
        key: "technical",
        label: "Technical",
        shortLabel: "Tech",
        max: 30,
        rubric: [{ level: "Excellent" }],
        outcomes: ["PO1", "PO2"],
      },
    ];
    const result = buildOutcomes(criteria);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "c1",
      key: "technical",
      label: "Tech",
      max: 30,
      rubric: [{ level: "Excellent" }],
      code: "PO1/PO2",
    });
  });

  qaTest("analytics.datasets.02", () => {
    expect(buildOutcomes(null)).toEqual([]);
    expect(buildOutcomes(undefined)).toEqual([]);
    expect(buildOutcomes([])).toEqual([]);
  });

  qaTest("analytics.datasets.03", () => {
    const criteria = [
      { id: "c1", color: "#3b82f6" },
      { id: "c2", color: "#8b5cf6" },
    ];
    expect(getCriterionColor("c1", "#fallback", criteria)).toBe("#3b82f6");
    expect(getCriterionColor("c2", "#fallback", criteria)).toBe("#8b5cf6");
  });

  qaTest("analytics.datasets.04", () => {
    const criteria = [{ id: "c1", color: "#3b82f6" }];
    expect(getCriterionColor("missing", "#fallback", criteria)).toBe("#fallback");
    expect(getCriterionColor("c1", "#fallback", [])).toBe("#fallback");
  });

  qaTest("analytics.datasets.05", () => {
    expect(formatOutcomeCodes("PO1/PO2/PO3")).toBe("PO1 / PO2 / PO3");
    expect(formatOutcomeCodes("PO1 / PO2")).toBe("PO1 / PO2");
    expect(formatOutcomeCodes(" PO1 / PO2 ")).toBe("PO1 / PO2");
  });

  qaTest("analytics.datasets.06", () => {
    expect(formatOutcomeCodes(null)).toBe("");
    expect(formatOutcomeCodes("")).toBe("");
    expect(formatOutcomeCodes(undefined)).toBe("");
  });

  qaTest("analytics.datasets.07", () => {
    expect(outcomeCodeLine("PO1/PO2")).toBe("(PO1 / PO2)");
    expect(outcomeCodeLine("PO1")).toBe("(PO1)");
  });

  qaTest("analytics.datasets.08", () => {
    expect(outcomeCodeLine("")).toBe("");
    expect(outcomeCodeLine(null)).toBe("");
  });

  qaTest("analytics.datasets.09", () => {
    const outcomes = [{ key: "technical", max: 30 }];
    // avg = (24+18)/2 = 21; 21/30 * 100 = 70; fmt1(70) = 70
    const data = [{ technical: 24 }, { technical: 18 }];
    expect(computeOverallAvg(data, outcomes)).toBe(70);
  });

  qaTest("analytics.datasets.10", () => {
    expect(computeOverallAvg([], [{ key: "technical", max: 30 }])).toBeNull();
    expect(computeOverallAvg(null, [])).toBeNull();
  });

  qaTest("analytics.datasets.11", () => {
    const activeOutcomes = [
      { key: "technical", id: "c1", max: 30, outcomes: ["PO1"] },
    ];
    const submittedData = [
      { technical: 27 }, // 90% >= 70% → Met
      { technical: 27 },
      { technical: 27 },
    ];
    const result = buildAttainmentStatusDataset({ submittedData, activeOutcomes, threshold: 70 });
    expect(result.sheet).toBe("Attainment Status");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0][0]).toBe("PO1");
    expect(result.rows[0][3]).toBe("Met");
    expect(result.summary.metCount).toBe(1);
  });

  qaTest("analytics.datasets.12", () => {
    const result = buildAttainmentStatusDataset({});
    expect(result.sheet).toBe("Attainment Status");
    expect(result.rows).toEqual([]);
    expect(result.summary).toEqual({ metCount: 0, totalCount: 0 });
  });

  qaTest("analytics.datasets.13", () => {
    const activeOutcomes = [
      { key: "technical", id: "c1", label: "Technical Content", max: 30, outcomes: ["PO1", "PO2"] },
    ];
    // PO1: score 18/30 = 60% → below 70% threshold; attainment rate = 0%
    // PO2: score 24/30 = 80% → above 70% threshold; attainment rate = 100%
    const submittedData = [{ technical: 18 }, { technical: 24 }];
    const result = buildThresholdGapDataset({ submittedData, activeOutcomes, threshold: 70 });
    expect(result.sheet).toBe("Threshold Gap");
    expect(result.rows).toHaveLength(2);
    // Both PO1 and PO2 share same criterion key → same attainment rate (1/2 = 50%)
    expect(result.rows[0][0]).toMatch(/^PO/);
    expect(result.rows[0][1]).toBe("Technical Content"); // criterion label
    expect(result.rows[0][2]).toBe(50); // attainment rate %
    expect(result.rows[0][3]).toBe("-20%"); // gap formatted
  });

  qaTest("analytics.datasets.14", () => {
    const result = buildGroupHeatmapDataset({ dashboardStats: [], activeOutcomes: [], threshold: 70 });
    expect(result.sheet).toBe("Project Heatmap");
    expect(result.rows).toEqual([]);
    // Group leads the headers when no data is present; trailing Cells-Below-Threshold
    // column is only appended when criteria/groups exist.
    expect(result.headers).toEqual(["Project Title"]);
  });

  // Group Heatmap with real data: rows = project groups, columns = criteria.
  qaTest("analytics.datasets.19", () => {
    const activeOutcomes = [
      { id: "c1", key: "technical", label: "Technical", max: 30, outcomes: ["PO1"] },
      { id: "c2", key: "teamwork",  label: "Teamwork",  max: 20, outcomes: ["PO2"] },
    ];
    const dashboardStats = [
      { id: "g1", group_no: 1, title: "Signal Processing", count: 3,
        avg: { technical: 27, teamwork: 12 } }, // 90%, 60%
      { id: "g2", group_no: 2, title: "IoT Sensor",        count: 2,
        avg: { technical: 21, teamwork: 18 } }, // 70%, 90%
    ];
    const result = buildGroupHeatmapDataset({ dashboardStats, activeOutcomes, threshold: 70 });
    expect(result.headers).toEqual([
      "Project Title", "Technical", "Teamwork", "Cells Below Threshold",
    ]);
    expect(result.rows).toHaveLength(2);
    // g1: technical 90%, teamwork 60% → 1 below threshold
    expect(result.rows[0]).toEqual(["P1 — Signal Processing", 90, 60, 1]);
    // g2: technical 70%, teamwork 90% → 0 below threshold
    expect(result.rows[1]).toEqual(["P2 — IoT Sensor", 70, 90, 0]);
  });

  // ── Attainment Rate dataset: per-outcome % ≥ threshold, matches chart ──
  qaTest("analytics.datasets.15", () => {
    const activeOutcomes = [
      { id: "c1", key: "technical", label: "Tech", max: 30, outcomes: ["PO1"] },
    ];
    // 3 of 4 evaluations score ≥ 70% on PO1 → attainment rate = 75%
    const submittedData = [
      { technical: 27 }, // 90%
      { technical: 21 }, // 70%
      { technical: 24 }, // 80%
      { technical: 18 }, // 60% (below)
    ];
    const result = buildAttainmentRateDataset({ submittedData, activeOutcomes, threshold: 70 });
    expect(result.sheet).toBe("Attainment Rate");
    expect(result.headers).toEqual(["Outcome", "Description", "Attainment Rate (%)", "N", "Status"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0][0]).toBe("PO1");
    expect(result.rows[0][2]).toBe(75);
    expect(result.rows[0][3]).toBe(4);
    expect(result.rows[0][4]).toBe("Met");
  });

  // ── Attainment Status: per-outcome delta from outcome-level prior stats ──
  qaTest("analytics.datasets.16", () => {
    const activeOutcomes = [
      // Two outcomes share the same criterion — under the old criterion-level delta
      // logic, both would show the same Δ. Per-outcome delta lets them diverge.
      { id: "c1", key: "technical", max: 30, outcomes: ["PO1", "PO2"] },
    ];
    const submittedData = [{ technical: 27 }, { technical: 27 }]; // 90% ≥ threshold → Met
    const priorPeriodStats = {
      currentTrend: { outcomes: [
        { code: "PO1", avg: 80, attainmentRate: 90 },
        { code: "PO2", avg: 60, attainmentRate: 50 },
      ] },
      prevTrend: { outcomes: [
        { code: "PO1", avg: 70, attainmentRate: 80 },
        { code: "PO2", avg: 75, attainmentRate: 75 },
      ] },
    };
    const result = buildAttainmentStatusDataset({
      submittedData, activeOutcomes, threshold: 70, priorPeriodStats,
    });
    expect(result.headers).toContain("Δ vs Prior Period (%)");
    // Rows are sorted by status then attRate — find by outcome code.
    const po1 = result.rows.find((r) => r[0] === "PO1");
    const po2 = result.rows.find((r) => r[0] === "PO2");
    expect(po1[4]).toBe(10);   // 80 − 70
    expect(po2[4]).toBe(-15);  // 60 − 75
  });

  // ── Trend export dataset: transposed outcome × period table ──
  qaTest("analytics.datasets.17", () => {
    const outcomeTrendData = [
      { periodId: "p2", periodName: "2024 Fall", nEvals: 20, outcomes: [
        { code: "PO1", label: "Engineering Knowledge", avg: 82.5, attainmentRate: 90 },
        { code: "PO2", label: "Teamwork", avg: 68.0, attainmentRate: 45 },
      ] },
      { periodId: "p1", periodName: "2024 Spring", nEvals: 18, outcomes: [
        { code: "PO1", label: "Engineering Knowledge", avg: 75.0, attainmentRate: 78 },
        { code: "PO2", label: "Teamwork", avg: 70.0, attainmentRate: 60 },
      ] },
    ];
    const periodOptions = [
      { id: "p1", period_name: "2024 Spring", startDate: "2024-02-01" },
      { id: "p2", period_name: "2024 Fall",   startDate: "2024-09-01" },
    ];
    const result = buildOutcomeAttainmentTrendExportDataset(
      outcomeTrendData, periodOptions, ["p1", "p2"]
    );
    expect(result.sheet).toBe("Attainment Trend");
    // Transposed shape: Outcome · Metric · {period columns, chronological}
    expect(result.headers).toEqual(["Outcome", "Metric", "2024 Spring", "2024 Fall"]);
    // 2 outcomes × 2 metric rows + 1 N footer row = 5 rows
    expect(result.rows).toHaveLength(5);
    // PO1 Attainment row: [label, "Attainment (%)", spring att, fall att]
    expect(result.rows[0]).toEqual(["PO1 — Engineering Knowledge", "Attainment (%)", 78, 90]);
    // PO1 Average row: leading outcome cell is blank for visual grouping
    expect(result.rows[1]).toEqual(["", "Average (%)", 75.0, 82.5]);
    // PO2 Attainment row
    expect(result.rows[2]).toEqual(["PO2 — Teamwork", "Attainment (%)", 60, 45]);
    // N footer row
    expect(result.rows[4]).toEqual(["N (evaluations)", "", 18, 20]);
  });

  // ── Coverage Matrix: outcome×criterion grid with Direct/Indirect/— ──
  qaTest("analytics.datasets.18", () => {
    const criteria = [
      { id: "c1", label: "Technical", outcomes: ["PO1"], outcomeTypes: { PO1: "direct", PO2: "indirect" } },
      { id: "c2", label: "Teamwork",  outcomes: [], outcomeTypes: { PO2: "direct" } },
    ];
    const outcomes = [
      { code: "PO1", label: "Engineering Knowledge", desc_en: "Apply eng principles" },
      { code: "PO2", label: "Teamwork", desc_en: "Work in teams" },
      { code: "PO3", label: "Ethics",   desc_en: "Ethical responsibility" }, // not mapped
    ];
    const result = buildCoverageMatrixDataset(criteria, outcomes);
    expect(result.sheet).toBe("Coverage Matrix");
    expect(result.headers).toEqual(["Outcome", "Description", "Technical", "Teamwork"]);
    expect(result.rows).toHaveLength(3);
    // PO1: direct on c1, none on c2
    expect(result.rows[0]).toEqual(["PO1", "Apply eng principles", "Direct", "—"]);
    // PO2: indirect on c1, direct on c2
    expect(result.rows[1]).toEqual(["PO2", "Work in teams", "Indirect", "Direct"]);
    // PO3: unmapped
    expect(result.rows[2]).toEqual(["PO3", "Ethical responsibility", "—", "—"]);
    // Summary extra section
    const summary = result.extra[0];
    expect(summary.title).toBe("Coverage Summary");
    expect(summary.rows).toEqual([
      ["Directly assessed", 2],
      ["Indirectly assessed", 1],
      ["Not mapped", 1],
    ]);
  });

  // Natural ordering for PO codes: "PO 2" precedes "PO 10.1"; "PO 1.2" precedes "PO 1.10".
  qaTest("analytics.datasets.20", () => {
    const input = [
      "PO 10.1", "PO 1.1", "PO 2", "PO 11", "PO 1.10", "PO 10.2", "PO 1.2", "PO 3.1",
    ];
    const sorted = [...input].sort(compareOutcomeCodes);
    expect(sorted).toEqual([
      "PO 1.1", "PO 1.2", "PO 1.10", "PO 2", "PO 3.1", "PO 10.1", "PO 10.2", "PO 11",
    ]);
  });
});
