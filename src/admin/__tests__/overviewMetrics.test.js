// src/admin/__tests__/overviewMetrics.test.js
// ============================================================
// computeOverviewMetrics — pure function unit tests.
// Audit items: metrics.01 / .02 / .03
// ============================================================

import { describe, expect } from "vitest";
import { computeOverviewMetrics } from "../scoreHelpers";
import { computeNeedsAttention, computeTopProjects } from "../selectors/overviewMetrics";
import { qaTest } from "../../test/qaTest.js";

// Helpers to build minimal test fixtures
function makeJuror(overrides = {}) {
  return {
    jurorId: "j1",
    key: "j1",
    editEnabled: false,
    finalSubmitted: false,
    finalSubmittedAt: null,
    ...overrides,
  };
}

function makeScore(jurorId, projectId, total = 85) {
  return { jurorId, projectId, key: jurorId, total };
}

describe("computeOverviewMetrics", () => {
  qaTest("metrics.01", () => {
    const result = computeOverviewMetrics([], [], 0);

    expect(result.totalJurors).toBe(0);
    expect(result.totalEvaluations).toBe(0);
    expect(result.completedJurors).toBe(0);
    expect(result.scoredEvaluations).toBe(0);
    expect(result.partialEvaluations).toBe(0);
    expect(result.emptyEvaluations).toBe(0);
    expect(result.editingJurors).toBe(0);
    expect(result.inProgressJurors).toBe(0);
    expect(result.readyToSubmitJurors).toBe(0);
    expect(result.notStartedJurors).toBe(0);
    // No NaN values
    Object.values(result).forEach((v) => {
      if (typeof v === "number") expect(Number.isFinite(v)).toBe(true);
    });
  });

  qaTest("metrics.02", () => {
    const juror1 = makeJuror({ jurorId: "j1", key: "j1", finalSubmitted: true, finalSubmittedAt: "2026-01-01" });
    const juror2 = makeJuror({ jurorId: "j2", key: "j2", editEnabled: true });
    const juror3 = makeJuror({ jurorId: "j3", key: "j3" });
    const jurorList = [juror1, juror2, juror3];

    // juror1 has all 3 groups scored (finalSubmitted → completed)
    // juror2 is editing
    // juror3 has 1 of 3 groups scored (in_progress)
    const scores = [
      makeScore("j1", "g1", 85),
      makeScore("j1", "g2", 80),
      makeScore("j1", "g3", 90),
      makeScore("j3", "g1", 75), // 1 scored, not all 3 → in_progress
    ];
    const totalProjects = 3;

    const result = computeOverviewMetrics(scores, jurorList, totalProjects);

    expect(result.totalJurors).toBe(3);
    expect(result.completedJurors).toBe(1);  // juror1 only
    expect(result.editingJurors).toBe(1);    // juror2
    expect(result.inProgressJurors).toBe(1); // juror3 (started but not all scored)
    expect(result.notStartedJurors).toBe(0); // juror2 is editing (excluded), juror3 started
    expect(result.scoredEvaluations).toBe(4); // j1×3 + j3×1
  });

  qaTest("metrics.03", () => {
    // scoredEvaluations + partialEvaluations > totalEvaluations — emptyEvaluations must be 0, not negative
    const juror = makeJuror({ jurorId: "j1", key: "j1" });
    const scores = [
      makeScore("j1", "g1", 85),
      makeScore("j1", "g2", 80),
      makeScore("j1", "g3", 90),
    ];
    // totalProjects = 1, but there are 3 scored rows → totalEvaluations = 1
    // emptyEvaluations = max(1 - 3 - 0, 0) = max(-2, 0) = 0
    const result = computeOverviewMetrics(scores, [juror], 1);
    expect(result.emptyEvaluations).toBe(0);
    expect(result.emptyEvaluations).toBeGreaterThanOrEqual(0);
  });
});

describe("computeNeedsAttention", () => {
  qaTest("overview.needs-attention.01", () => {
    // Empty inputs produce empty arrays
    const result = computeNeedsAttention([], [], {});
    expect(result.staleJurors).toEqual([]);
    expect(result.incompleteProjects).toEqual([]);
  });

  qaTest("overview.needs-attention.02", () => {
    // Jurors with progress=0 are included
    const jurors = [
      { key: "j1", name: "Alice", progress: 0 },
      { key: "j2", name: "Bob", progress: 0 },
      { key: "j3", name: "Carol", progress: 50 },
    ];
    const result = computeNeedsAttention(jurors, [], {});
    expect(result.staleJurors).toHaveLength(2);
    expect(result.staleJurors[0].key).toBe("j1");
    expect(result.staleJurors[1].key).toBe("j2");
  });

  qaTest("overview.needs-attention.03", () => {
    // Jurors with progress > 0 are excluded
    const jurors = [
      { key: "j1", name: "Alice", progress: 1 },
      { key: "j2", name: "Bob", progress: 50 },
      { key: "j3", name: "Carol", progress: 100 },
    ];
    const result = computeNeedsAttention(jurors, [], {});
    expect(result.staleJurors).toHaveLength(0);
  });

  qaTest("overview.needs-attention.04", () => {
    // Projects with completedEvals < totalJurors are incomplete
    const groups = [
      { id: "g1", title: "Project A", completedEvals: 2 },
      { id: "g2", title: "Project B", completedEvals: 5 },
      { id: "g3", title: "Project C", completedEvals: 5 },
    ];
    const metrics = { totalJurors: 5 };
    const result = computeNeedsAttention([], groups, metrics);
    expect(result.incompleteProjects).toHaveLength(1);
    expect(result.incompleteProjects[0].id).toBe("g1");
  });
});

describe("computeTopProjects", () => {
  function makeProject(id, groupNo, name, totalAvg) {
    return { id, groupNo, name, totalAvg, count: 5 };
  }

  qaTest("overview.top-projects.01", () => {
    // Fewer than 5 projects → return empty array
    const result = computeTopProjects([
      makeProject("g1", 1, "Project A", 85),
      makeProject("g2", 2, "Project B", 90),
      makeProject("g3", 3, "Project C", 80),
    ]);
    expect(result).toEqual([]);
  });

  qaTest("overview.top-projects.02", () => {
    // 6 projects → return top 3 sorted by totalAvg descending
    const projects = [
      makeProject("g1", 1, "Project A", 85),
      makeProject("g2", 2, "Project B", 92),
      makeProject("g3", 3, "Project C", 88),
      makeProject("g4", 4, "Project D", 78),
      makeProject("g5", 5, "Project E", 95),
      makeProject("g6", 6, "Project F", 80),
    ];
    const result = computeTopProjects(projects, 3);
    expect(result).toHaveLength(3);
    expect(result[0].rank).toBe(1);
    expect(result[0].totalAvg).toBe(95);
    expect(result[0].name).toBe("Project E");
    expect(result[1].rank).toBe(2);
    expect(result[1].totalAvg).toBe(92);
    expect(result[1].name).toBe("Project B");
    expect(result[2].rank).toBe(3);
    expect(result[2].totalAvg).toBe(88);
    expect(result[2].name).toBe("Project C");
  });

  qaTest("overview.top-projects.03", () => {
    // Projects with null totalAvg are excluded
    const projects = [
      makeProject("g1", 1, "Project A", 85),
      makeProject("g2", 2, "Project B", 92),
      makeProject("g3", 3, "Project C", null),
      makeProject("g4", 4, "Project D", 88),
      makeProject("g5", 5, "Project E", 95),
      makeProject("g6", 6, "Project F", 80),
    ];
    const result = computeTopProjects(projects, 3);
    // Should have 3 results (5 projects with valid avgScore)
    expect(result).toHaveLength(3);
    // Top 3 should be 95, 92, 88 (skipping null)
    expect(result[0].totalAvg).toBe(95);
    expect(result[1].totalAvg).toBe(92);
    expect(result[2].totalAvg).toBe(88);
  });
});
