import { describe, expect, vi, beforeEach } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  },
}));

import { getPeriodMaxScore, getDeleteCounts, deleteEntity } from "../../admin/scores.js";

describe("admin/scores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  qaTest("api.admin.scores.01", async () => {
    const result = await getPeriodMaxScore(null);
    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  qaTest("api.admin.scores.02", async () => {
    mockFrom.mockImplementation((table) => {
      const countResult = { count: table === "projects" ? 3 : table === "score_sheets" ? 10 : 2, error: null };
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(countResult),
        }),
      };
    });
    const counts = await getDeleteCounts("period", "p1");
    expect(counts).toEqual({ projects: 3, scores: 10, jurorAssignments: 2 });
  });

  qaTest("api.admin.scores.03", async () => {
    await expect(deleteEntity({ targetType: "unknown", targetId: "x1" })).rejects.toThrow(
      "Unsupported delete target."
    );
  });
});
