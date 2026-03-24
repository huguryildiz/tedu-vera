// src/admin/__tests__/adminApi.shaping.test.js
// ============================================================
// Phase A safety tests — lock the data-shaping behavior of
// adminApi.js before any refactoring begins.
//
// Strategy: Vitest runs with import.meta.env.DEV = true, so
// USE_PROXY is false and callAdminRpc takes the dev path that
// calls supabase.rpc() directly. Mocking supabase.rpc lets us
// supply raw DB rows and verify the UI-shape output without any
// network calls.
// ============================================================

import { describe, expect, vi, beforeEach } from "vitest";
import { qaTest } from "../../test/qaTest.js";

// Must be declared before any import that touches the mocked module.
vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

// Import supabase AFTER the mock so we get the mock instance.
import { supabase } from "../../lib/supabaseClient";

// Import the functions under test.
import {
  adminGetScores,
  adminListJurors,
  adminProjectSummary,
  adminGetOutcomeTrends,
} from "../../shared/api/adminApi";

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Make supabase.rpc resolve with the given rows for the next call.
 */
function mockRpc(rows) {
  supabase.rpc.mockResolvedValueOnce({ data: rows, error: null });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("adminApi — data shaping (Phase A safety)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── phaseA.api.01 — adminGetScores field mapping ──────────────────────

  qaTest("phaseA.api.01", async () => {
    const updatedAtIso = "2026-03-24T10:00:00.000Z";
    const finalAtIso   = "2026-03-24T12:00:00.000Z";

    const rawRow = {
      juror_id:          "juror-uuid-1",
      juror_name:        "Alice Smith",
      juror_inst:        "EE Dept",
      project_id:        "proj-uuid-1",
      group_no:          3,
      project_title:     "Solar Panel Project",
      poster_date:       "2026-03-24",
      criteria_scores:   { technical: 25, design: 20, delivery: 15, teamwork: 8 },
      total:             68,
      comment:           "Good work",
      updated_at:        updatedAtIso,
      final_submitted_at: finalAtIso,
      status:            null,
    };

    mockRpc([rawRow]);

    const result = await adminGetScores("sem-1", "password");

    expect(result).toHaveLength(1);
    const row = result[0];

    // Juror identity mapping
    expect(row.jurorId).toBe("juror-uuid-1");
    expect(row.juryName).toBe("Alice Smith");
    expect(row.juryDept).toBe("EE Dept");

    // Project identity mapping
    expect(row.projectId).toBe("proj-uuid-1");
    expect(row.groupNo).toBe(3);
    expect(row.projectName).toBe("Solar Panel Project");
    expect(row.posterDate).toBe("2026-03-24");

    // Criteria scores spread via dbScoresToUi (keys pass through unchanged)
    expect(row.technical).toBe(25);
    expect(row.design).toBe(20);
    expect(row.delivery).toBe(15);
    expect(row.teamwork).toBe(8);

    // Total and comments
    expect(row.total).toBe(68);
    expect(row.comments).toBe("Good work");

    // Timestamp normalization
    expect(row.updatedAt).toBe(new Date(updatedAtIso).toISOString());
    expect(row.updatedMs).toBe(new Date(updatedAtIso).getTime());
    expect(row.finalSubmittedAt).toBe(new Date(finalAtIso).toISOString());
    expect(row.finalSubmittedMs).toBe(new Date(finalAtIso).getTime());

    // Legacy aliases
    expect(row.timestamp).toBe(row.updatedAt);
    expect(row.tsMs).toBe(row.updatedMs);
  });

  // ── phaseA.api.04 — adminGetScores status derivation ─────────────────

  qaTest("phaseA.api.04", async () => {
    const BASE = {
      juror_id: "j-1", juror_name: "Bob", juror_inst: "CS",
      project_id: "p-1", group_no: 1, project_title: "P1",
      poster_date: "2026-03-24", total: null, comment: "",
      updated_at: null, final_submitted_at: null, status: null,
    };

    // Case 1: all scores null + no comment → not_started
    mockRpc([{
      ...BASE,
      criteria_scores: { technical: null, design: null, delivery: null, teamwork: null },
      comment: "",
    }]);
    const [notStarted] = await adminGetScores("sem-1", "pw");
    expect(notStarted.status).toBe("not_started");

    // Case 2: some scores filled → in_progress
    mockRpc([{
      ...BASE,
      criteria_scores: { technical: 20, design: null, delivery: null, teamwork: null },
      comment: "",
    }]);
    const [inProgress] = await adminGetScores("sem-1", "pw");
    expect(inProgress.status).toBe("in_progress");

    // Case 3: all scores filled (none null) → submitted
    mockRpc([{
      ...BASE,
      criteria_scores: { technical: 25, design: 20, delivery: 15, teamwork: 8 },
      comment: "done",
    }]);
    const [submitted] = await adminGetScores("sem-1", "pw");
    expect(submitted.status).toBe("submitted");

    // Case 4: final_submitted_at present → completed
    mockRpc([{
      ...BASE,
      criteria_scores: { technical: 25, design: 20, delivery: 15, teamwork: 8 },
      final_submitted_at: "2026-03-24T12:00:00.000Z",
    }]);
    const [completed] = await adminGetScores("sem-1", "pw");
    expect(completed.status).toBe("completed");

    // Case 5: DB supplies status explicitly → used as-is
    mockRpc([{
      ...BASE,
      criteria_scores: { technical: 25, design: 20, delivery: 15, teamwork: 8 },
      status: "editing",
    }]);
    const [editing] = await adminGetScores("sem-1", "pw");
    expect(editing.status).toBe("editing");
    expect(editing.editingFlag).toBe("editing");
  });

  // ── phaseA.api.02 — adminListJurors field mapping ─────────────────────

  qaTest("phaseA.api.02", async () => {
    const lastActivityIso  = "2026-03-24T09:30:00.000Z";
    const finalSubmittedIso = "2026-03-24T11:00:00.000Z";
    const lastSeenIso       = "2026-03-24T11:05:00.000Z";
    const updatedAtIso      = "2026-03-24T11:10:00.000Z";

    const rawJuror = {
      juror_id:           "juror-uuid-2",
      juror_name:         "Carol Jones",
      juror_inst:         "ME Dept",
      scored_semesters:   ["sem-1"],
      is_assigned:        true,
      edit_enabled:       false,
      final_submitted_at: finalSubmittedIso,
      last_activity_at:   lastActivityIso,
      last_seen_at:       lastSeenIso,
      updated_at:         updatedAtIso,
      total_projects:     5,
      completed_projects: 5,
      locked_until:       null,
      is_locked:          false,
    };

    mockRpc([rawJuror]);

    const result = await adminListJurors("sem-1", "password");

    expect(result).toHaveLength(1);
    const juror = result[0];

    // Identity mapping
    expect(juror.jurorId).toBe("juror-uuid-2");
    expect(juror.juryName).toBe("Carol Jones");
    expect(juror.juryDept).toBe("ME Dept");

    // Timestamp ms conversion
    expect(juror.lastActivityMs).toBe(new Date(lastActivityIso).getTime());
    expect(juror.lastSeenMs).toBe(new Date(lastSeenIso).getTime());
    expect(juror.updatedMs).toBe(new Date(updatedAtIso).getTime());

    // Boolean coercion for finalSubmitted
    expect(juror.finalSubmitted).toBe(true);
    expect(juror.finalSubmittedAt).toBe(finalSubmittedIso);

    // Pass-through fields
    expect(juror.isAssigned).toBe(true);
    expect(juror.editEnabled).toBe(false);
    expect(juror.totalProjects).toBe(5);
    expect(juror.completedProjects).toBe(5);
    expect(juror.lockedUntil).toBeNull();
    expect(juror.isLocked).toBe(false);
    expect(juror.scoredSemesters).toEqual(["sem-1"]);

    // Edge: null timestamps → ms = 0, boolean false, empty strings
    mockRpc([{
      juror_id: "j-null", juror_name: "Dave", juror_inst: "",
      scored_semesters: [], is_assigned: false, edit_enabled: false,
      final_submitted_at: null, last_activity_at: null,
      last_seen_at: null, updated_at: null,
      total_projects: 0, completed_projects: 0,
      locked_until: null, is_locked: false,
    }]);
    const [nullJuror] = await adminListJurors("sem-1", "pw");
    expect(nullJuror.lastActivityMs).toBe(0);
    expect(nullJuror.finalSubmitted).toBe(false);
    expect(nullJuror.finalSubmittedAt).toBe("");
  });

  // ── phaseA.api.03 — adminProjectSummary field mapping ────────────────

  qaTest("phaseA.api.03", async () => {
    const rawSummary = {
      project_id:     "proj-uuid-3",
      group_no:       2,
      project_title:  "Robotics Arm",
      group_students: "Eve\nFrank",
      juror_count:    "4",
      criteria_avgs:  { technical: "25.5", design: "18.75", delivery: "22.0", teamwork: "7.5" },
      avg_total:      "73.75",
      min_total:      "70.0",
      max_total:      "78.0",
      note:           "High variance",
    };

    mockRpc([rawSummary]);

    const result = await adminProjectSummary("sem-1", "password");

    expect(result).toHaveLength(1);
    const proj = result[0];

    // Identity mapping
    expect(proj.id).toBe("proj-uuid-3");
    expect(proj.groupNo).toBe(2);
    expect(proj.name).toBe("Robotics Arm");
    expect(proj.students).toBe("Eve\nFrank");
    expect(proj.count).toBe(4);
    expect(proj.note).toBe("High variance");

    // criteria_avgs → avg object with numeric values (string→number coercion)
    expect(proj.avg.technical).toBe(25.5);
    expect(proj.avg.design).toBe(18.75);
    expect(proj.avg.delivery).toBe(22.0);
    expect(proj.avg.teamwork).toBe(7.5);

    // avg_total string → totalAvg number
    expect(proj.totalAvg).toBe(73.75);
    expect(proj.totalMin).toBe(70.0);
    expect(proj.totalMax).toBe(78.0);
  });

  // ── phaseA.api.05 — adminGetOutcomeTrends field mapping ──────────────

  qaTest("phaseA.api.05", async () => {
    const rawTrend = {
      semester_id:   "sem-uuid-1",
      semester_name: "2026 Spring",
      poster_date:   "2026-03-24",
      criteria_avgs: { technical: "27.0", design: "21.5", delivery: "19.0", teamwork: "8.0" },
      n_evals:       "12",
    };

    mockRpc([rawTrend]);

    const result = await adminGetOutcomeTrends(["sem-uuid-1"], "password");

    expect(result).toHaveLength(1);
    const trend = result[0];

    // Identity mapping
    expect(trend.semesterId).toBe("sem-uuid-1");
    expect(trend.semesterName).toBe("2026 Spring");
    expect(trend.posterDate).toBe("2026-03-24");

    // criteria_avgs → criteriaAvgs via dbAvgScoresToUi (string→number)
    expect(trend.criteriaAvgs.technical).toBe(27.0);
    expect(trend.criteriaAvgs.design).toBe(21.5);
    expect(trend.criteriaAvgs.delivery).toBe(19.0);
    expect(trend.criteriaAvgs.teamwork).toBe(8.0);

    // n_evals string → nEvals number
    expect(trend.nEvals).toBe(12);
  });
});
