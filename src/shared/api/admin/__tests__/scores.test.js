// src/shared/api/admin/__tests__/scores.test.js
// Isolation tests for pivotItems behavior (via getScores / getProjectSummary)
// and score aggregation logic. pivotItems is a private fn — tested through public API.

import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";
import {
  makeSheetRow,
  makeItem,
  makeProject,
} from "../../../../test/adminApiMocks.js";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: { from: mockFrom },
}));

import { getScores, getProjectSummary } from "../scores.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function mockGetScores(data, error = null) {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  });
}

function mockGetProjectSummary(projects, sheets, { projError = null, sheetError = null } = {}) {
  mockFrom.mockImplementation((table) => {
    if (table === "projects") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: projects, error: projError }),
          }),
        }),
      };
    }
    // score_sheets
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: sheets, error: sheetError }),
          }),
        }),
      }),
    };
  });
}

// ─── pivotItems via getScores ────────────────────────────────────────────────

describe("admin/scores — pivotItems (via getScores)", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("scores.pivot.01", async () => {
    const sheet = makeSheetRow({
      items: [makeItem("c1", 70), makeItem("c2", 85)],
    });
    mockGetScores([sheet]);
    const [row] = await getScores("period-1");
    expect(row.c1).toBe(70);
    expect(row.c2).toBe(85);
    expect(row.total).toBe(155);
  });

  qaTest("scores.pivot.02", async () => {
    const sheet = makeSheetRow({ items: [] });
    mockGetScores([sheet]);
    const [row] = await getScores("period-1");
    expect(row.total).toBe(0);
    // Empty items spread nothing — no criterion keys should be present
    const structuralKeys = new Set([
      "id","jurorId","juryName","affiliation","projectId","projectName",
      "groupNo","students","total","status","comments","createdAt","updatedAt",
    ]);
    const criterionKeys = Object.keys(row).filter((k) => !structuralKeys.has(k));
    expect(criterionKeys).toHaveLength(0);
  });

  qaTest("scores.pivot.03", async () => {
    const sheet = makeSheetRow({ items: null });
    mockGetScores([sheet]);
    const [row] = await getScores("period-1");
    expect(row.total).toBe(0);
  });

  qaTest("scores.pivot.04", async () => {
    const sheet = makeSheetRow({
      items: [makeItem("c1", null), makeItem("c2", 50)],
    });
    mockGetScores([sheet]);
    const [row] = await getScores("period-1");
    expect(row.c1).toBeNull();
    expect(row.c2).toBe(50);
    expect(row.total).toBe(50);
  });

  qaTest("scores.pivot.05", async () => {
    const badItem = {
      id: "bad",
      score_value: 99,
      period_criterion_id: null,
      period_criteria: null,
      criterion_key: undefined,
    };
    const sheet = makeSheetRow({ items: [badItem] });
    mockGetScores([sheet]);
    const [row] = await getScores("period-1");
    expect(row.total).toBe(0);
    expect("undefined" in row).toBe(false);
  });

  qaTest("scores.pivot.06", async () => {
    // Item has no period_criteria join but has criterion_key on the item itself
    const item = {
      id: "item-leg",
      score_value: 60,
      period_criterion_id: "pc-x",
      period_criteria: null,
      criterion_key: "legacy_key",
    };
    const sheet = makeSheetRow({ items: [item] });
    mockGetScores([sheet]);
    const [row] = await getScores("period-1");
    expect(row.legacy_key).toBe(60);
  });

  qaTest("scores.pivot.07", async () => {
    // period_criteria.key takes priority over any criterion_key property
    const item = {
      id: "item-prio",
      score_value: 75,
      period_criterion_id: "pc-1",
      period_criteria: { key: "authoritative_key" },
      criterion_key: "fallback_key",
    };
    const sheet = makeSheetRow({ items: [item] });
    mockGetScores([sheet]);
    const [row] = await getScores("period-1");
    expect(row.authoritative_key).toBe(75);
    expect("fallback_key" in row).toBe(false);
  });

  qaTest("scores.pivot.08", async () => {
    const sheet = makeSheetRow({
      items: [makeItem("c1", -10), makeItem("c2", 50)],
    });
    mockGetScores([sheet]);
    const [row] = await getScores("period-1");
    expect(row.c1).toBe(-10);
    expect(row.total).toBe(40);
  });

  qaTest("scores.pivot.09", async () => {
    // Explicitly zero score — must not be skipped as falsy
    const sheet = makeSheetRow({
      items: [makeItem("c1", 0), makeItem("c2", 90)],
    });
    mockGetScores([sheet]);
    const [row] = await getScores("period-1");
    expect(row.c1).toBe(0);
    expect(row.total).toBe(90);
  });

  qaTest("scores.pivot.10", async () => {
    // Supabase numeric may arrive as string — coerced to number
    const item = { ...makeItem("c1", "85"), score_value: "85" };
    const sheet = makeSheetRow({ items: [item] });
    mockGetScores([sheet]);
    const [row] = await getScores("period-1");
    expect(typeof row.c1).toBe("number");
    expect(row.c1).toBe(85);
    expect(row.total).toBe(85);
  });

  qaTest("scores.pivot.11", async () => {
    const sheet = makeSheetRow({
      items: [makeItem("c1", 70), makeItem("c2", 80), makeItem("c3", 90)],
    });
    mockGetScores([sheet]);
    const [row] = await getScores("period-1");
    expect(row.c1).toBe(70);
    expect(row.c2).toBe(80);
    expect(row.c3).toBe(90);
  });

  qaTest("scores.pivot.12", async () => {
    const sheet = makeSheetRow({
      items: [makeItem("c1", 70), makeItem("c2", null), makeItem("c3", 85)],
    });
    mockGetScores([sheet]);
    const [row] = await getScores("period-1");
    expect(row.c2).toBeNull();
    expect(row.total).toBe(155);
  });

  qaTest("scores.pivot.13", async () => {
    const err = { message: "relation does not exist", code: "42P01" };
    mockGetScores(null, err);
    await expect(getScores("period-1")).rejects.toMatchObject({ message: "relation does not exist" });
  });

  qaTest("scores.pivot.14", async () => {
    mockGetScores([]);
    const result = await getScores("period-1");
    expect(result).toEqual([]);
  });

  qaTest("scores.pivot.15", async () => {
    const sheet = makeSheetRow({
      items: [makeItem("c1", 80)],
      juror: { id: "j1", juror_name: "Dr. Smith", affiliation: "METU" },
      project: { id: "p1", title: "Bridge Project", members: null, project_no: 5 },
    });
    mockGetScores([sheet]);
    const [row] = await getScores("period-1");
    expect(row.juryName).toBe("Dr. Smith");
    expect(row.projectName).toBe("Bridge Project");
    expect(row.affiliation).toBe("METU");
  });

  qaTest("scores.pivot.21", async () => {
    const SCORE_QUERY_CAP = 20000;
    const rows = Array.from({ length: SCORE_QUERY_CAP }, (_, i) =>
      makeSheetRow({ id: `sheet-${i}`, items: [makeItem("c1", 50)] })
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockGetScores(rows);
    await getScores("period-1");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("hit row cap"));
    warnSpy.mockRestore();
  });
});

// ─── getProjectSummary aggregation ──────────────────────────────────────────

describe("admin/scores — getProjectSummary aggregation", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  qaTest("scores.pivot.16", async () => {
    const project = makeProject({ id: "p1", title: "Alpha" });
    const sheet = {
      id: "sh1",
      project_id: "p1",
      items: [makeItem("c1", 80), makeItem("c2", 70)],
    };
    mockGetProjectSummary([project], [sheet]);
    const [row] = await getProjectSummary("period-1");
    expect(row.count).toBe(1);
    expect(row.totalAvg).toBe(150);
  });

  qaTest("scores.pivot.17", async () => {
    const project = makeProject({ id: "p1", title: "Alpha" });
    // Juror A: total 100; Juror B: total 60 → avg = 80
    const sheetA = {
      id: "sh1",
      project_id: "p1",
      items: [makeItem("c1", 60), makeItem("c2", 40)],
    };
    const sheetB = {
      id: "sh2",
      project_id: "p1",
      items: [makeItem("c1", 40), makeItem("c2", 20)],
    };
    mockGetProjectSummary([project], [sheetA, sheetB]);
    const [row] = await getProjectSummary("period-1");
    expect(row.count).toBe(2);
    expect(row.totalAvg).toBe(80);
  });

  qaTest("scores.pivot.18", async () => {
    const project = makeProject({ id: "p1", title: "Alpha" });
    mockGetProjectSummary([project], []);
    const [row] = await getProjectSummary("period-1");
    expect(row.count).toBe(0);
    expect(row.totalAvg).toBeNull();
  });

  qaTest("scores.pivot.19", async () => {
    const project = makeProject({ id: "p1", title: "Alpha" });
    // Juror A: c1=80; Juror B: c1=60 → avg.c1 = 70
    const sheetA = { id: "sh1", project_id: "p1", items: [makeItem("c1", 80)] };
    const sheetB = { id: "sh2", project_id: "p1", items: [makeItem("c1", 60)] };
    mockGetProjectSummary([project], [sheetA, sheetB]);
    const [row] = await getProjectSummary("period-1");
    expect(row.avg.c1).toBe(70);
  });

  qaTest("scores.pivot.20", async () => {
    const projA = makeProject({ id: "p1", title: "Alpha" });
    const projB = makeProject({ id: "p2", title: "Beta" });
    const sheetA = { id: "sh1", project_id: "p1", items: [makeItem("c1", 90)] };
    const sheetB = { id: "sh2", project_id: "p2", items: [makeItem("c1", 50)] };
    mockGetProjectSummary([projA, projB], [sheetA, sheetB]);
    const rows = await getProjectSummary("period-1");
    const alpha = rows.find((r) => r.id === "p1");
    const beta = rows.find((r) => r.id === "p2");
    expect(alpha.totalAvg).toBe(90);
    expect(beta.totalAvg).toBe(50);
  });

  qaTest("scores.pivot.22", async () => {
    const err = { message: "permission denied", code: "42501" };
    mockGetProjectSummary(null, null, { projError: err });
    await expect(getProjectSummary("period-1")).rejects.toMatchObject({ message: "permission denied" });
  });
});
