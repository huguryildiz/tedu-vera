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

import {
  authenticateJuror,
  listPeriods,
  upsertScore,
  getJurorById,
  getJurorEditState,
  finalizeJurorSubmission,
  freezePeriodSnapshot,
  getProjectRankings,
  submitJuryFeedback,
} from "../juryApi.js";

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

  qaTest("api.juryApi.05", async () => {
    const jurorRow = { id: "j1", name: "Alice", period_id: "p1" };
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: jurorRow, error: null }),
        }),
      }),
    });
    const result = await getJurorById("j1");
    expect(result).toEqual(jurorRow);
    expect(mockFrom).toHaveBeenCalledWith("jurors");

    // Error branch
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: new Error("not found") }),
        }),
      }),
    });
    await expect(getJurorById("missing")).rejects.toThrow("not found");
  });

  qaTest("api.juryApi.06", async () => {
    const futureExpiry = new Date(Date.now() + 3_600_000).toISOString();
    const editData = {
      edit_enabled: true,
      edit_expires_at: futureExpiry,
      is_blocked: false,
      last_seen_at: "2025-06-01T00:00:00Z",
      final_submitted_at: null,
    };
    const makeMock = (data) => {
      const result = { data: { ok: true, ...data }, error: null };
      const chainable = Object.assign(Promise.resolve(result), {
        abortSignal: vi.fn().mockReturnValue(Promise.resolve(result)),
      });
      mockRpc.mockReturnValue(chainable);
    };

    // edit_enabled=true + future expiry → edit_allowed=true
    makeMock(editData);
    const active = await getJurorEditState("p1", "j1", "token1", null);
    expect(mockRpc).toHaveBeenCalledWith("rpc_jury_get_edit_state", {
      p_juror_id: "j1",
      p_period_id: "p1",
    });
    expect(active.edit_allowed).toBe(true);
    expect(active.lock_active).toBe(false);
    expect(active.final_submitted_at).toBeNull();

    // edit_enabled=true but expired → edit_allowed=false
    const pastExpiry = new Date(Date.now() - 3_600_000).toISOString();
    makeMock({ ...editData, edit_expires_at: pastExpiry });
    const expired = await getJurorEditState("p1", "j1", "token1", null);
    expect(expired.edit_allowed).toBe(false);

    // edit_enabled=false → edit_allowed=false
    makeMock({ ...editData, edit_enabled: false });
    const disabled = await getJurorEditState("p1", "j1", "token1", null);
    expect(disabled.edit_allowed).toBe(false);

    // is_blocked=true maps to lock_active=true
    makeMock({ ...editData, is_blocked: true });
    const blocked = await getJurorEditState("p1", "j1", "token1", null);
    expect(blocked.lock_active).toBe(true);

    // ok:false → throws error_code
    mockRpc.mockResolvedValue({ data: { ok: false, error_code: "juror_session_not_found" }, error: null });
    await expect(getJurorEditState("p1", "j1", "token1", null)).rejects.toThrow("juror_session_not_found");
  });

  qaTest("api.juryApi.07", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    const result = await finalizeJurorSubmission("p1", "j1", "token1");
    expect(result).toEqual({ ok: true });
    expect(mockRpc).toHaveBeenCalledWith(
      "rpc_jury_finalize_submission",
      expect.objectContaining({
        p_period_id: "p1",
        p_juror_id: "j1",
        p_session_token: "token1",
        p_correlation_id: expect.any(String),
      })
    );

    // Error branch
    mockRpc.mockResolvedValue({ data: null, error: new Error("finalize failed") });
    await expect(finalizeJurorSubmission("p1", "j1", "token1")).rejects.toThrow("finalize failed");
  });

  qaTest("api.juryApi.08", async () => {
    mockRpc.mockResolvedValue({ data: { frozen: true }, error: null });

    // Without force → only p_period_id
    await freezePeriodSnapshot("p1");
    expect(mockRpc).toHaveBeenCalledWith("rpc_period_freeze_snapshot", { p_period_id: "p1" });

    // With force=true → includes p_force
    mockRpc.mockResolvedValue({ data: { frozen: true }, error: null });
    await freezePeriodSnapshot("p1", true);
    expect(mockRpc).toHaveBeenCalledWith("rpc_period_freeze_snapshot", {
      p_period_id: "p1",
      p_force: true,
    });

    // Error branch
    mockRpc.mockResolvedValue({ data: null, error: new Error("freeze error") });
    await expect(freezePeriodSnapshot("p1")).rejects.toThrow("freeze error");
  });

  qaTest("api.juryApi.09", async () => {
    const rankings = [
      { project_id: "p1", avg: 85 },
      { project_id: "p2", avg: 78 },
    ];
    mockRpc.mockResolvedValue({ data: rankings, error: null });
    const result = await getProjectRankings("period1", "token1");
    expect(result).toEqual(rankings);
    expect(mockRpc).toHaveBeenCalledWith("rpc_jury_project_rankings", {
      p_period_id: "period1",
      p_session_token: "token1",
    });

    // null data → []
    mockRpc.mockResolvedValue({ data: null, error: null });
    const empty = await getProjectRankings("period1", "token1");
    expect(empty).toEqual([]);

    // Error branch
    mockRpc.mockResolvedValue({ data: null, error: new Error("rankings error") });
    await expect(getProjectRankings("period1", "token1")).rejects.toThrow("rankings error");
  });

  qaTest("api.juryApi.10", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    const result = await submitJuryFeedback("p1", "token1", 5, "Great experience!");
    expect(result).toEqual({ ok: true });
    expect(mockRpc).toHaveBeenCalledWith("rpc_submit_jury_feedback", {
      p_period_id: "p1",
      p_session_token: "token1",
      p_rating: 5,
      p_comment: "Great experience!",
    });

    // Null/falsy comment → passes null
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    await submitJuryFeedback("p1", "token1", 4, "");
    expect(mockRpc).toHaveBeenCalledWith("rpc_submit_jury_feedback", {
      p_period_id: "p1",
      p_session_token: "token1",
      p_rating: 4,
      p_comment: null,
    });

    // Error branch
    mockRpc.mockResolvedValue({ data: null, error: new Error("feedback error") });
    await expect(submitJuryFeedback("p1", "token1", 3, null)).rejects.toThrow("feedback error");
  });
});
