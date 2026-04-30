// src/shared/api/admin/__tests__/scores.test.js
// Isolation tests for pivotItems behavior (via getScores / getProjectSummary)
// and score aggregation logic. pivotItems is a private fn — tested through public API.

import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";
import {
  makeSheetRow,
  makeItem,
} from "../../../../test/adminApiMocks.js";

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}));

import {
  getScores,
  getProjectSummary,
  getJurorSummary,
  getPeriodSummary,
} from "../scores.js";

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

// New shape: getProjectSummary calls rpc_admin_project_summary which returns
// pre-aggregated rows. Tests verify the RPC→UI field mapping (snake → camel
// + legacy aliases) rather than re-checking server-side aggregation math
// (the math now lives in pgTAP contract tests for the RPC).
function mockProjectSummaryRpc(rows, error = null) {
  mockRpc.mockImplementation((name) => {
    if (name === "rpc_admin_project_summary") {
      return Promise.resolve({ data: rows, error });
    }
    return Promise.resolve({ data: null, error: null });
  });
}

function mockJurorSummaryRpc(rows, error = null) {
  mockRpc.mockImplementation((name) => {
    if (name === "rpc_admin_juror_summary") {
      return Promise.resolve({ data: rows, error });
    }
    return Promise.resolve({ data: null, error: null });
  });
}

function mockPeriodSummaryRpc(rows, error = null) {
  mockRpc.mockImplementation((name) => {
    if (name === "rpc_admin_period_summary") {
      return Promise.resolve({ data: rows, error });
    }
    return Promise.resolve({ data: null, error: null });
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

// ─── getProjectSummary RPC mapping ──────────────────────────────────────────
// Aggregation math is now enforced by the pgTAP contract test for
// `rpc_admin_project_summary`. These JS tests verify that the API wrapper
// faithfully maps the RPC's snake_case columns to the legacy + new
// camelCase fields consumed by ProjectsPage / RankingsPage / drawers.

describe("admin/scores — getProjectSummary RPC mapping", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  qaTest("scores.pivot.16", async () => {
    mockProjectSummaryRpc([{
      project_id: "p1", title: "Alpha", project_no: 7, members: null,
      advisor: "Advisor A",
      juror_count: 1, submitted_count: 1, assigned_count: 1,
      total_avg: 150, total_pct: 75, total_min: 150, total_max: 150,
      std_dev_pct: 0, rank: 1,
      per_criterion: { c1: { avg: 80, max: 100, pct: 80 }, c2: { avg: 70, max: 100, pct: 70 } },
    }]);
    const [row] = await getProjectSummary("period-1");
    expect(row.count).toBe(1);
    expect(row.totalAvg).toBe(150);
    expect(row.id).toBe("p1");
    expect(row.group_no).toBe(7);
  });

  qaTest("scores.pivot.17", async () => {
    // Two-juror aggregation: server returns total_avg=80 (avg of 100 and 60).
    mockProjectSummaryRpc([{
      project_id: "p1", title: "Alpha",
      juror_count: 2, total_avg: 80, total_pct: 40,
      per_criterion: { c1: { avg: 50, max: 100, pct: 50 } },
    }]);
    const [row] = await getProjectSummary("period-1");
    expect(row.count).toBe(2);
    expect(row.totalAvg).toBe(80);
    expect(row.totalPct).toBe(40);
  });

  qaTest("scores.pivot.18", async () => {
    mockProjectSummaryRpc([{
      project_id: "p1", title: "Alpha",
      juror_count: 0, total_avg: null, per_criterion: {},
    }]);
    const [row] = await getProjectSummary("period-1");
    expect(row.count).toBe(0);
    expect(row.totalAvg).toBeNull();
  });

  qaTest("scores.pivot.19", async () => {
    // Per-criterion average flows through `avg[key]` legacy alias from
    // per_criterion[key].avg field.
    mockProjectSummaryRpc([{
      project_id: "p1", title: "Alpha", juror_count: 2, total_avg: 70,
      per_criterion: { c1: { avg: 70, max: 100, pct: 70 } },
    }]);
    const [row] = await getProjectSummary("period-1");
    expect(row.avg.c1).toBe(70);
  });

  qaTest("scores.pivot.20", async () => {
    mockProjectSummaryRpc([
      { project_id: "p1", title: "Alpha", juror_count: 1, total_avg: 90, per_criterion: {} },
      { project_id: "p2", title: "Beta",  juror_count: 1, total_avg: 50, per_criterion: {} },
    ]);
    const rows = await getProjectSummary("period-1");
    const alpha = rows.find((r) => r.id === "p1");
    const beta = rows.find((r) => r.id === "p2");
    expect(alpha.totalAvg).toBe(90);
    expect(beta.totalAvg).toBe(50);
  });

  qaTest("scores.pivot.22", async () => {
    const err = { message: "permission denied", code: "42501" };
    mockProjectSummaryRpc(null, err);
    await expect(getProjectSummary("period-1")).rejects.toMatchObject({ message: "permission denied" });
  });
});

// ─── getJurorSummary + getPeriodSummary RPC wrappers ────────────────────────

describe("admin/scores — getJurorSummary RPC mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("scores.juror_summary.01", async () => {
    mockJurorSummaryRpc([{
      juror_id: "j1", juror_name: "Dr. A", affiliation: "EE",
      scored_count: 5, assigned_count: 5, completion_pct: 100,
      avg_total: 80, avg_total_pct: 80, std_dev_pct: 5.2,
      final_submitted_at: "2026-04-30T10:00:00Z",
    }]);
    const [row] = await getJurorSummary("period-1");
    expect(row.jurorId).toBe("j1");
    expect(row.avgTotalPct).toBe(80);
    expect(row.completionPct).toBe(100);
    expect(row.finalSubmittedAt).toBe("2026-04-30T10:00:00Z");
  });

  qaTest("scores.juror_summary.02", async () => {
    mockJurorSummaryRpc([]);
    const rows = await getJurorSummary("period-1");
    expect(rows).toEqual([]);
  });
});

describe("admin/scores — getPeriodSummary RPC mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("scores.period_summary.01", async () => {
    mockPeriodSummaryRpc([{
      total_max: 100, total_projects: 10, ranked_count: 10,
      total_jurors: 12, finalized_jurors: 12,
      avg_total_pct: 74.78, avg_juror_pct: 75.1,
    }]);
    const result = await getPeriodSummary("period-1");
    expect(result.totalMax).toBe(100);
    expect(result.avgTotalPct).toBe(74.78);
    expect(result.avgJurorPct).toBe(75.1);
    expect(result.finalizedJurors).toBe(12);
  });

  qaTest("scores.period_summary.02", async () => {
    // Empty RPC response (period with no data) → safe defaults
    mockPeriodSummaryRpc([]);
    const result = await getPeriodSummary("period-1");
    expect(result.totalMax).toBe(0);
    expect(result.totalProjects).toBe(0);
    expect(result.avgTotalPct).toBeUndefined();
  });
});
