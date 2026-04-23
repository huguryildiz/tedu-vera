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

import { createPeriod, updatePeriod } from "../../admin/periods.js";

describe("admin/periods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  qaTest("api.admin.periods.01", async () => {
    const created = { id: "p1", name: "Spring 2025", organization_id: "org1" };
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: created, error: null }),
        }),
      }),
    });
    const result = await createPeriod({ organizationId: "org1", name: "Spring 2025" });
    expect(result).toEqual(created);
  });

  qaTest("api.admin.periods.02", async () => {
    await expect(updatePeriod({ id: null, name: "Test" })).rejects.toThrow(
      "updatePeriod: id required"
    );
  });
});
