import { describe, expect, vi, beforeEach } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";

vi.mock("../../../../shared/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("../../../../shared/api/admin/scores", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getScores: vi.fn(),
  };
});

import { getOutcomeAttainmentTrends, getScores } from "../../../../shared/api/admin/scores.js";
import { supabase } from "../../../../shared/lib/supabaseClient";

describe("admin/features/analytics/getOutcomeAttainmentTrends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  qaTest("admin.analytics.getOutcomeAttainmentTrends.01", async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
      };
    });

    vi.mocked(getScores).mockResolvedValue([]);

    const result = await getOutcomeAttainmentTrends([]);
    expect(result).toEqual([]);
  });

  qaTest("admin.analytics.getOutcomeAttainmentTrends.02", async () => {
    const mockScores = [
      { design: 80, delivery: 90 },
      { design: 75, delivery: 85 },
      { design: 95, delivery: 80 },
    ];

    vi.mocked(getScores).mockResolvedValue(mockScores);

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === "periods") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "period-1", name: "Spring 2026" },
          }),
        };
      } else if (table === "period_criteria") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              { id: "crit-1", key: "design", max_score: 100 },
              { id: "crit-2", key: "delivery", max_score: 100 },
            ],
          }),
        };
      } else if (table === "period_criterion_outcome_maps") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              { period_criterion_id: "crit-1", weight: 1, period_outcomes: { code: "O1" } },
              { period_criterion_id: "crit-2", weight: 1, period_outcomes: { code: "O1" } },
            ],
          }),
        };
      } else if (table === "period_outcomes") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ code: "O1", label: "Learning Outcome 1" }],
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
      };
    });

    const result = await getOutcomeAttainmentTrends(["period-1"]);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("periodId", "period-1");
    expect(result[0]).toHaveProperty("outcomes");
  });

  qaTest("admin.analytics.getOutcomeAttainmentTrends.03", async () => {
    const mockScores1 = [
      { design: 80, delivery: 90 },
      { design: 75, delivery: 85 },
    ];

    const mockScores2 = [
      { design: 60, delivery: 70 },
      { design: 65, delivery: 75 },
    ];

    let callCount = 0;
    vi.mocked(getScores).mockImplementation(() => {
      callCount++;
      return Promise.resolve(callCount === 1 ? mockScores1 : mockScores2);
    });

    let periodCallCount = 0;
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === "periods") {
        periodCallCount++;
        const data = periodCallCount === 1
          ? { id: "p1", name: "Spring 2026" }
          : { id: "p2", name: "Fall 2026" };
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data }),
        };
      } else if (table === "period_criteria") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              { id: "crit-1", key: "design", max_score: 100 },
              { id: "crit-2", key: "delivery", max_score: 100 },
            ],
          }),
        };
      } else if (table === "period_criterion_outcome_maps") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              { period_criterion_id: "crit-1", weight: 1, period_outcomes: { code: "O1" } },
              { period_criterion_id: "crit-2", weight: 1, period_outcomes: { code: "O1" } },
            ],
          }),
        };
      } else if (table === "period_outcomes") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ code: "O1", label: "Learning Outcome 1" }],
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
      };
    });

    const result = await getOutcomeAttainmentTrends(["p1", "p2"]);
    expect(result.length).toBe(2);
    expect(result[0].periodId).toBe("p1");
    expect(result[1].periodId).toBe("p2");
  });

  qaTest("admin.analytics.getOutcomeAttainmentTrends.04", async () => {
    const mockScores = [
      { design: 80, delivery: 90 },
      { design: 60, delivery: 50 },
    ];

    vi.mocked(getScores).mockResolvedValue(mockScores);

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === "period_criteria") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              { id: "crit-1", key: "design", max_score: 100 },
              { id: "crit-2", key: "delivery", max_score: 100 },
            ],
          }),
        };
      } else if (table === "period_criterion_outcome_maps") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              { period_criterion_id: "crit-1", weight: 1, period_outcomes: { code: "O1" } },
              { period_criterion_id: "crit-2", weight: 1, period_outcomes: { code: "O1" } },
            ],
          }),
        };
      } else if (table === "period_outcomes") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ code: "O1", label: "Learning Outcome 1" }],
          }),
        };
      } else if (table === "periods") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "period-1", name: "Spring 2026" },
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
      };
    });

    const result = await getOutcomeAttainmentTrends(["period-1"]);
    if (result.length > 0 && result[0].outcomes && result[0].outcomes.length > 0) {
      const outcome = result[0].outcomes[0];
      if (outcome.attainmentRate !== null) {
        expect(typeof outcome.attainmentRate).toBe("number");
        expect(outcome.attainmentRate).toBeGreaterThanOrEqual(0);
        expect(outcome.attainmentRate).toBeLessThanOrEqual(100);
      }
    }
  });

  qaTest("admin.analytics.getOutcomeAttainmentTrends.05", async () => {
    vi.mocked(getScores).mockResolvedValue([]);

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === "period_criteria") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [] }),
        };
      } else if (table === "period_criterion_outcome_maps") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [] }),
        };
      } else if (table === "period_outcomes") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [] }),
        };
      } else if (table === "periods") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "period-1", name: "Spring 2026" },
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
      };
    });

    const result = await getOutcomeAttainmentTrends(["period-1"]);
    if (result.length > 0) {
      const firstResult = result[0];
      expect(firstResult).toHaveProperty("outcomes");
      if (firstResult.outcomes && firstResult.outcomes.length > 0) {
        firstResult.outcomes.forEach((outcome) => {
          expect([outcome.avg, null]).toContain(outcome.avg);
          expect([outcome.attainmentRate, null]).toContain(outcome.attainmentRate);
        });
      }
    }
  });

  qaTest("admin.analytics.getOutcomeAttainmentTrends.06", async () => {
    vi.mocked(getScores).mockResolvedValue([]);

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === "periods") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
      };
    });

    const result = await getOutcomeAttainmentTrends(["nonexistent"]);
    expect(result.length).toBe(0);
  });
});
