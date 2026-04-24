import { describe, expect } from "vitest";
import { qaTest } from "../../../test/qaTest.js";

// scoreHelpers re-export requires Icon mocks — mock via scoreHelpers directly
import { vi } from "vitest";
vi.mock("@/shared/ui/Icons", () => ({
  CheckCircle2Icon: "CheckCircle2Icon",
  CheckIcon: "CheckIcon",
  SendIcon: "SendIcon",
  Clock3Icon: "Clock3Icon",
  CircleIcon: "CircleIcon",
  CircleDotDashedIcon: "CircleDotDashedIcon",
  PencilIcon: "PencilIcon",
}));

import {
  computeNeedsAttention,
  computeTopProjects,
} from "../overviewMetrics.js";

describe("overviewMetrics — computeNeedsAttention", () => {
  qaTest("overview.sel.01", () => {
    const groups = [
      { id: "g1", completedEvals: 3 },
      { id: "g2", completedEvals: 1 },
      { id: "g3", completedEvals: 2 },
    ];
    const metrics = { totalJurors: 3 };

    const jurorStats = [
      { key: "j1", progress: 0,   status: "not_started" },
      { key: "j2", progress: 50,  status: "in_progress" },
      { key: "j3", progress: 100, status: "completed" },
      { key: "j4", progress: 0,   status: "in_progress" }, // progress=0 → stale
    ];

    const { staleJurors, incompleteProjects } = computeNeedsAttention(jurorStats, groups, metrics);

    // j1 (progress=0, not_started) and j4 (progress=0) are stale
    expect(staleJurors).toHaveLength(2);
    expect(staleJurors.map((j) => j.key)).toContain("j1");
    expect(staleJurors.map((j) => j.key)).toContain("j4");
    expect(staleJurors.map((j) => j.key)).not.toContain("j2");
    expect(staleJurors.map((j) => j.key)).not.toContain("j3");

    // g1: completedEvals=3 = totalJurors=3 → complete (excluded)
    // g2: 1 < 3 → incomplete
    // g3: 2 < 3 → incomplete
    expect(incompleteProjects).toHaveLength(2);
    expect(incompleteProjects.map((g) => g.id)).toContain("g2");
    expect(incompleteProjects.map((g) => g.id)).toContain("g3");
    expect(incompleteProjects.map((g) => g.id)).not.toContain("g1");

    // Null inputs → empty arrays
    const empty = computeNeedsAttention(null, null, null);
    expect(empty.staleJurors).toEqual([]);
    expect(empty.incompleteProjects).toEqual([]);

    // All jurors fully evaluated → no incomplete projects
    const fullMetrics = { totalJurors: 2 };
    const fullGroups = [{ id: "g1", completedEvals: 2 }, { id: "g2", completedEvals: 2 }];
    const { incompleteProjects: none } = computeNeedsAttention([], fullGroups, fullMetrics);
    expect(none).toHaveLength(0);
  });
});

describe("overviewMetrics — computeNeedsAttention (boundary)", () => {
  qaTest("overview.sel.03", () => {
    // totalJurors = 0 → completed < 0 is always false → no incomplete projects
    const groups = [
      { id: "g1", completedEvals: 0 },
      { id: "g2", completedEvals: 0 },
    ];
    const { incompleteProjects } = computeNeedsAttention([], groups, { totalJurors: 0 });
    expect(incompleteProjects).toHaveLength(0);

    // Juror with status="not_started" AND progress > 0 → OR condition → still stale
    const jurors = [
      { key: "j1", progress: 50, status: "not_started" }, // status flag overrides progress
      { key: "j2", progress: 50, status: "in_progress" }, // not stale
    ];
    const { staleJurors } = computeNeedsAttention(jurors, [], { totalJurors: 0 });
    expect(staleJurors).toHaveLength(1);
    expect(staleJurors[0].key).toBe("j1");

    // Empty arrays (not null) → empty results
    const empty = computeNeedsAttention([], [], {});
    expect(empty.staleJurors).toEqual([]);
    expect(empty.incompleteProjects).toEqual([]);
  });
});

describe("overviewMetrics — computeTopProjects (boundary)", () => {
  qaTest("overview.sel.04", () => {
    // Tie at 3rd position — stable sort preserves input order for equal totalAvg
    const withTie = [
      { id: "p1", totalAvg: 90 },
      { id: "p2", totalAvg: 85 },
      { id: "p3", totalAvg: 80 }, // first at 80 — wins rank 3
      { id: "p4", totalAvg: 80 }, // second at 80 — pushed to rank 4
      { id: "p5", totalAvg: 70 },
    ];
    const top = computeTopProjects(withTie);
    expect(top).toHaveLength(3);
    expect(top[2].id).toBe("p3"); // stable sort: p3 before p4 in input
    expect(top[2].rank).toBe(3);
    expect(top.find((p) => p.id === "p4")).toBeUndefined();

    // All ≥5 projects have null totalAvg → filter removes all → []
    const allNull = [
      { id: "p1", totalAvg: null },
      { id: "p2", totalAvg: null },
      { id: "p3", totalAvg: null },
      { id: "p4", totalAvg: null },
      { id: "p5", totalAvg: null },
    ];
    expect(computeTopProjects(allNull)).toEqual([]);
  });
});

describe("overviewMetrics — computeTopProjects", () => {
  qaTest("overview.sel.02", () => {
    // Fewer than 5 projects → always returns []
    expect(computeTopProjects(null)).toEqual([]);
    expect(computeTopProjects([])).toEqual([]);

    const four = [
      { id: "p1", totalAvg: 85 },
      { id: "p2", totalAvg: 78 },
      { id: "p3", totalAvg: 90 },
      { id: "p4", totalAvg: 72 },
    ];
    expect(computeTopProjects(four)).toEqual([]);

    // 5+ projects → top 3 sorted descending, with rank
    const five = [
      { id: "p1", totalAvg: 85 },
      { id: "p2", totalAvg: 78 },
      { id: "p3", totalAvg: 90 },
      { id: "p4", totalAvg: 72 },
      { id: "p5", totalAvg: 88 },
    ];
    const top = computeTopProjects(five);
    expect(top).toHaveLength(3);
    expect(top[0].id).toBe("p3");   // totalAvg=90 → rank 1
    expect(top[0].rank).toBe(1);
    expect(top[1].id).toBe("p5");   // totalAvg=88 → rank 2
    expect(top[1].rank).toBe(2);
    expect(top[2].id).toBe("p1");   // totalAvg=85 → rank 3
    expect(top[2].rank).toBe(3);

    // Custom limit
    const topTwo = computeTopProjects(five, 2);
    expect(topTwo).toHaveLength(2);
    expect(topTwo[0].rank).toBe(1);
    expect(topTwo[1].rank).toBe(2);

    // Null totalAvg projects are excluded from ranking
    const withNull = [
      { id: "p1", totalAvg: 85 },
      { id: "p2", totalAvg: null },
      { id: "p3", totalAvg: 90 },
      { id: "p4", totalAvg: 72 },
      { id: "p5", totalAvg: 88 },
      { id: "p6", totalAvg: null },
    ];
    const topFiltered = computeTopProjects(withNull);
    expect(topFiltered.every((p) => p.totalAvg != null)).toBe(true);
    expect(topFiltered[0].totalAvg).toBe(90);
  });
});
