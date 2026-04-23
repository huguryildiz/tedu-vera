import { describe, expect, vi, beforeEach } from "vitest";
import { qaTest } from "../../../test/qaTest.js";

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
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}));

import { authenticateJuror, listPeriods, upsertScore } from "../juryApi.js";

describe("juryApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  qaTest("api.juryApi.01", async () => {
    mockRpc.mockResolvedValue({ data: { token: "abc" }, error: null });
    await authenticateJuror("period-1", "  Alice  ", "  TEDU  ");
    expect(mockRpc).toHaveBeenCalledWith("rpc_jury_authenticate", {
      p_period_id: "period-1",
      p_juror_name: "Alice",
      p_affiliation: "TEDU",
      p_force_reissue: false,
      p_email: null,
    });
  });

  qaTest("api.juryApi.02", async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error("auth failure") });
    await expect(authenticateJuror("p1", "Alice", "TEDU")).rejects.toThrow("auth failure");
  });

  qaTest("api.juryApi.03", async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: orderMock,
      }),
    });
    const result = await listPeriods();
    expect(result).toEqual([]);
  });

  qaTest("api.juryApi.04", async () => {
    mockRpc.mockResolvedValue({
      data: { error_code: "session_expired" },
      error: null,
    });
    await expect(
      upsertScore("p1", "proj1", "juror1", "token1", { technical: 80 }, null, null)
    ).rejects.toThrow("juror_session_expired");
  });
});
