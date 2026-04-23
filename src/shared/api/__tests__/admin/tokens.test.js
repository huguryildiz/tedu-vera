import { describe, expect, vi, beforeEach } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  },
}));

import { getActiveEntryTokenPlain, revokeEntryToken } from "../../admin/tokens.js";

describe("admin/tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  qaTest("api.admin.tokens.01", async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { token_plain: "ABC123", expires_at: pastDate },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });
    const result = await getActiveEntryTokenPlain("p1");
    expect(result).toBeNull();
  });

  qaTest("api.admin.tokens.02", async () => {
    mockRpc.mockResolvedValue({
      data: { active_juror_count: 5, revoked_count: 1 },
      error: null,
    });
    const result = await revokeEntryToken("p1");
    expect(result).toEqual({ success: true, active_juror_count: 5, revoked_count: 1 });
    expect(mockRpc).toHaveBeenCalledWith("rpc_admin_revoke_entry_token", { p_period_id: "p1" });
  });
});
