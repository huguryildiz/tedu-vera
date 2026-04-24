// src/shared/api/admin/__tests__/crossOrgBoundary.test.js
// Cross-org data leakage boundary tests.
// Tests that RLS errors propagate and that no client-side filtering is silently skipped.

import { describe, expect, vi, beforeEach } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";
import { mockError, makeSheetRow, makeItem, makeProject } from "../../../../test/adminApiMocks.js";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: { from: mockFrom },
}));

import { getScores, getProjectSummary, listJurorsSummary } from "../scores.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function simpleEqChain(result) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(result),
    }),
  };
}

function scoresSheetsEqLimitChain(result) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("admin/scores — cross-org boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("scores.cross-org.01", async () => {
    // RLS blocks the query with 42501 — getScores must throw, not return []
    const rlsError = { message: "permission denied for table score_sheets", code: "42501" };
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: null, error: rlsError }),
        }),
      }),
    });
    await expect(getScores("period-x")).rejects.toMatchObject({
      message: "permission denied for table score_sheets",
      code: "42501",
    });
  });

  qaTest("scores.cross-org.02", async () => {
    // RLS blocks the projects query inside getProjectSummary — must throw
    const rlsError = { message: "permission denied for table projects", code: "42501" };
    mockFrom.mockImplementation((table) => {
      if (table === "projects") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: rlsError }),
            }),
          }),
        };
      }
      return scoresSheetsEqLimitChain({ data: [], error: null });
    });
    await expect(getProjectSummary("period-x")).rejects.toMatchObject({ code: "42501" });
  });

  qaTest("scores.cross-org.03", async () => {
    // undefined periodId must not crash client-side — the call reaches Supabase
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
    const result = await getScores(undefined);
    expect(Array.isArray(result)).toBe(true);
  });

  qaTest("scores.cross-org.04", async () => {
    // null periodId must not crash client-side — the call reaches Supabase
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
    const result = await getScores(null);
    expect(Array.isArray(result)).toBe(true);
  });

  qaTest("scores.cross-org.05", async () => {
    // Documents that pivotItems has NO client-side org_id filter.
    // If RLS fails and rows from two orgs are returned, both pass through.
    // This test records the current behavior — the sole boundary is DB-side RLS.
    const orgASheet = makeSheetRow({
      id: "sh-a",
      project_id: "p-a",
      items: [makeItem("c1", 90)],
      project: { id: "p-a", title: "Org A Project", members: null, project_no: 1 },
    });
    const orgBSheet = makeSheetRow({
      id: "sh-b",
      project_id: "p-b",
      items: [makeItem("c1", 60)],
      project: { id: "p-b", title: "Org B Project", members: null, project_no: 2 },
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [orgASheet, orgBSheet], error: null }),
        }),
      }),
    });
    const rows = await getScores("period-1");
    // Both rows are returned — no client-side filtering by org
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.projectName)).toContain("Org A Project");
    expect(rows.map((r) => r.projectName)).toContain("Org B Project");
  });

  qaTest("scores.cross-org.06", async () => {
    // RLS blocks juror_period_auth query in listJurorsSummary — must throw
    const rlsError = { message: "permission denied for table juror_period_auth", code: "42501" };
    mockFrom.mockImplementation((table) => {
      if (table === "juror_period_auth") {
        return simpleEqChain({ data: null, error: rlsError });
      }
      if (table === "score_sheets") {
        return simpleEqChain({ data: [], error: null });
      }
      // projects
      return simpleEqChain({ data: [], error: null });
    });
    await expect(listJurorsSummary("period-x")).rejects.toMatchObject({ code: "42501" });
  });
});
