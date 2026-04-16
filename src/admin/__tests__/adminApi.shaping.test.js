// src/admin/__tests__/adminApi.shaping.test.js
// ============================================================
// Phase A safety tests — lock the data-shaping behavior of
// the PostgREST admin API.
//
// Strategy: Mock supabase.from() with a chainable builder that
// resolves with fixture data. Verify the UI-shape output
// without any network calls.
// ============================================================

import { describe, expect, vi, beforeEach } from "vitest";
import { qaTest } from "../../test/qaTest.js";

// ── Chainable PostgREST mock ───────────────────────────────────────────────

/**
 * Returns a chainable mock that resolves to { data: rows, error }.
 * .single() resolves to { data: rows[0], error }.
 */
function makeChain(rows, error = null) {
  const data = Array.isArray(rows) ? rows : [rows];
  const p = Promise.resolve({ data, error });
  const chain = {
    select:  vi.fn().mockReturnThis(),
    eq:      vi.fn().mockReturnThis(),
    order:   vi.fn().mockReturnThis(),
    limit:   vi.fn().mockReturnThis(),
    single:  vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    then:    p.then.bind(p),
    catch:   p.catch.bind(p),
    finally: p.finally.bind(p),
  };
  return chain;
}

// Must be declared before any import that touches the mocked module.
vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Import supabase AFTER the mock so we get the mock instance.
import { supabase } from "@/shared/lib/supabaseClient";

// Import the functions under test.
import {
  getScores,
  listJurorsSummary,
  getProjectSummary,
  getOutcomeTrends,
} from "../../shared/api/admin";

// ── Tests ─────────────────────────────────────────────────────────────────

describe("adminApi — data shaping (Phase A safety)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── phaseA.api.01 — getScores field mapping ───────────────────────────

  qaTest("phaseA.api.01", async () => {
    const rawRow = {
      id:          "score-uuid-1",
      juror_id:    "juror-uuid-1",
      project_id:  "proj-uuid-1",
      technical:   25,
      written:     20,   // maps to design
      oral:        15,   // maps to delivery
      teamwork:    8,
      comments:    "Good work",
      created_at:  "2026-03-24T09:00:00.000Z",
      updated_at:  "2026-03-24T10:00:00.000Z",
      juror:   { id: "juror-uuid-1", juror_name: "Alice Smith", affiliation: "EE Dept" },
      project: { id: "proj-uuid-1",  title: "Solar Panel Project", members: "Eve\nFrank" },
    };

    supabase.from.mockReturnValue(makeChain([rawRow]));

    const result = await getScores("period-1");

    expect(result).toHaveLength(1);
    const row = result[0];

    // Score identity
    expect(row.id).toBe("score-uuid-1");
    expect(row.jurorId).toBe("juror-uuid-1");
    expect(row.juryName).toBe("Alice Smith");
    expect(row.affiliation).toBe("EE Dept");

    // Project identity
    expect(row.projectId).toBe("proj-uuid-1");
    expect(row.projectName).toBe("Solar Panel Project");
    expect(row.students).toBe("Eve\nFrank");

    // Field mapping: written→design, oral→delivery
    expect(row.technical).toBe(25);
    expect(row.design).toBe(20);
    expect(row.delivery).toBe(15);
    expect(row.teamwork).toBe(8);

    // Total and comments
    expect(row.total).toBe(68);
    expect(row.comments).toBe("Good work");

    // Timestamps pass through as-is
    expect(row.updatedAt).toBe("2026-03-24T10:00:00.000Z");
    expect(row.createdAt).toBe("2026-03-24T09:00:00.000Z");
  });

  // ── phaseA.api.02 — listJurorsSummary field mapping ───────────────────

  qaTest("phaseA.api.02", async () => {
    const lastSeenIso       = "2026-03-24T11:05:00.000Z";
    const finalSubmittedIso = "2026-03-24T11:00:00.000Z";

    const authRow = {
      juror_id:           "juror-uuid-2",
      period_id:          "period-1",
      edit_enabled:       false,
      final_submitted_at: finalSubmittedIso,
      last_seen_at:       lastSeenIso,
      locked_until:       null,
      is_blocked:         false,
      juror: { id: "juror-uuid-2", juror_name: "Carol Jones", affiliation: "ME Dept" },
    };

    supabase.from
      .mockReturnValueOnce(makeChain([authRow]))              // juror_period_auth
      .mockReturnValueOnce(makeChain([{ juror_id: "juror-uuid-2", id: "score-1" }])) // scores
      .mockReturnValueOnce(makeChain([{ id: "proj-1" }]));   // projects

    const result = await listJurorsSummary("period-1");

    expect(result).toHaveLength(1);
    const juror = result[0];

    // Identity mapping
    expect(juror.jurorId).toBe("juror-uuid-2");
    expect(juror.juryName).toBe("Carol Jones");
    expect(juror.affiliation).toBe("ME Dept");

    // Submission state
    expect(juror.finalSubmitted).toBe(true);
    expect(juror.finalSubmittedAt).toBe(finalSubmittedIso);

    // Timestamps
    expect(juror.lastSeenMs).toBe(new Date(lastSeenIso).getTime());

    // Project counts
    expect(juror.totalProjects).toBe(1);
    expect(juror.completedProjects).toBe(1);

    // Lock state
    expect(juror.lockedUntil).toBeNull();
    expect(juror.isLocked).toBe(false);
    expect(juror.editEnabled).toBe(false);

    // Edge: null timestamps → ms = 0, finalSubmitted = false
    supabase.from
      .mockReturnValueOnce(makeChain([{
        juror_id: "j-null", period_id: "period-1",
        edit_enabled: false, final_submitted_at: null, last_seen_at: null,
        locked_until: null, is_blocked: false,
        juror: { id: "j-null", juror_name: "Dave", affiliation: "" },
      }]))
      .mockReturnValueOnce(makeChain([]))  // no scores
      .mockReturnValueOnce(makeChain([])); // no projects

    const [nullJuror] = await listJurorsSummary("period-1");
    expect(nullJuror.lastSeenMs).toBe(0);
    expect(nullJuror.finalSubmitted).toBe(false);
    expect(nullJuror.finalSubmittedAt).toBe("");
  });

  // ── phaseA.api.03 — getProjectSummary field mapping ───────────────────

  qaTest("phaseA.api.03", async () => {
    const project = {
      id:        "proj-uuid-3",
      title:     "Robotics Arm",
      members:   "Eve\nFrank",
      advisor:   "Dr. Smith",
      period_id: "period-1",
    };

    const scores = [
      { project_id: "proj-uuid-3", technical: 25, written: 20, oral: 18, teamwork: 8 },
      { project_id: "proj-uuid-3", technical: 22, written: 19, oral: 16, teamwork: 7 },
    ];

    supabase.from
      .mockReturnValueOnce(makeChain([project])) // projects
      .mockReturnValueOnce(makeChain(scores));   // scores

    const result = await getProjectSummary("period-1");

    expect(result).toHaveLength(1);
    const proj = result[0];

    // Identity
    expect(proj.id).toBe("proj-uuid-3");
    expect(proj.title).toBe("Robotics Arm");
    expect(proj.members).toBe("Eve\nFrank");
    expect(proj.advisor).toBe("Dr. Smith");
    expect(proj.count).toBe(2);

    // avg uses dbAvgScoresToUi: written→design, oral→delivery
    expect(proj.avg.technical).toBeCloseTo(23.5);
    expect(proj.avg.design).toBeCloseTo(19.5);    // written avg
    expect(proj.avg.delivery).toBeCloseTo(17.0);  // oral avg
    expect(proj.avg.teamwork).toBeCloseTo(7.5);

    // totalAvg = ((25+20+18+8) + (22+19+16+7)) / 2 = (71 + 64) / 2
    expect(proj.totalAvg).toBeCloseTo(67.5);
  });

  // ── phaseA.api.05 — getOutcomeTrends field mapping ────────────────────

  qaTest("phaseA.api.05", async () => {
    const period = { id: "sem-uuid-1", name: "2026 Spring" };
    const scores = [
      { technical: 27, written: 21, oral: 19, teamwork: 8 },
      { technical: 25, written: 22, oral: 20, teamwork: 9 },
    ];

    supabase.from
      .mockReturnValueOnce(makeChain([period])) // periods (.single())
      .mockReturnValueOnce(makeChain(scores));  // scores

    const result = await getOutcomeTrends(["sem-uuid-1"]);

    expect(result).toHaveLength(1);
    const trend = result[0];

    // Identity
    expect(trend.periodId).toBe("sem-uuid-1");
    expect(trend.periodName).toBe("2026 Spring");
    expect(trend.nEvals).toBe(2);

    // criteriaAvgs uses dbAvgScoresToUi: written→design, oral→delivery
    expect(trend.criteriaAvgs.technical).toBeCloseTo(26.0);
    expect(trend.criteriaAvgs.design).toBeCloseTo(21.5);    // written avg
    expect(trend.criteriaAvgs.delivery).toBeCloseTo(19.5);  // oral avg
    expect(trend.criteriaAvgs.teamwork).toBeCloseTo(8.5);
  });
});
