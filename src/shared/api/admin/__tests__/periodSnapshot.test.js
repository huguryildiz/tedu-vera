// src/shared/api/admin/__tests__/periodSnapshot.test.js
// Tests for setEvalLock, publishPeriod, and closePeriod in periods.js.
// There is no freezePeriodSnapshot export — setEvalLock IS the freeze mechanism.

import { describe, expect, vi, beforeEach } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: { rpc: mockRpc },
}));

import { setEvalLock, publishPeriod, closePeriod } from "../periods.js";

// ─── setEvalLock ─────────────────────────────────────────────────────────────

describe("admin/periods — setEvalLock", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("period.snapshot.01", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    await expect(setEvalLock("p-1", true)).resolves.not.toThrow();
    expect(mockRpc).toHaveBeenCalledWith("rpc_admin_set_period_lock", {
      p_period_id: "p-1",
      p_locked: true,
    });
  });

  qaTest("period.snapshot.02", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    await setEvalLock("p-1", false);
    expect(mockRpc).toHaveBeenCalledWith("rpc_admin_set_period_lock", {
      p_period_id: "p-1",
      p_locked: false,
    });
  });

  qaTest("period.snapshot.03", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    // Truthy string → !!("yes") === true
    await setEvalLock("p-1", "yes");
    expect(mockRpc).toHaveBeenCalledWith("rpc_admin_set_period_lock", {
      p_period_id: "p-1",
      p_locked: true,
    });
  });

  qaTest("period.snapshot.04", async () => {
    const err = { message: "permission denied", code: "42501" };
    mockRpc.mockResolvedValue({ data: null, error: err });
    await expect(setEvalLock("p-1", true)).rejects.toMatchObject({
      message: "permission denied",
    });
  });

  qaTest("period.snapshot.10", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    await setEvalLock("p-1", true);
    await setEvalLock("p-1", true);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});

// ─── publishPeriod ───────────────────────────────────────────────────────────

describe("admin/periods — publishPeriod", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("period.snapshot.05", async () => {
    const payload = { ok: true, published: true };
    mockRpc.mockResolvedValue({ data: payload, error: null });
    const result = await publishPeriod("p-1");
    expect(result).toEqual(payload);
    expect(mockRpc).toHaveBeenCalledWith("rpc_admin_publish_period", {
      p_period_id: "p-1",
    });
  });

  qaTest("period.snapshot.06", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true, already_published: true }, error: null });
    await publishPeriod("p-1");
    await publishPeriod("p-1");
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  qaTest("period.snapshot.07", async () => {
    await expect(publishPeriod(null)).rejects.toThrow("publishPeriod: periodId required");
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

// ─── closePeriod ─────────────────────────────────────────────────────────────

describe("admin/periods — closePeriod", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("period.snapshot.08", async () => {
    const payload = { ok: true, closed_at: "2025-06-01T00:00:00Z" };
    mockRpc.mockResolvedValue({ data: payload, error: null });
    const result = await closePeriod("p-1");
    expect(result).toEqual(payload);
    expect(mockRpc).toHaveBeenCalledWith("rpc_admin_close_period", {
      p_period_id: "p-1",
    });
  });

  qaTest("period.snapshot.09", async () => {
    await expect(closePeriod(null)).rejects.toThrow("closePeriod: periodId required");
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
