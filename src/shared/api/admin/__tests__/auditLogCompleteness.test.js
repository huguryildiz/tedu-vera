// src/shared/api/admin/__tests__/auditLogCompleteness.test.js
// Verifies that critical admin API operations use the correct audit-aware
// code paths (embedded-RPC, edge function, or direct writeAuditLog).

import { describe, expect, vi, beforeEach } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";

// ── Module-level mock setup ──────────────────────────────────────────────────

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));

vi.mock("@/shared/api/core/invokeEdgeFunction", () => ({
  invokeEdgeFunction: mockInvoke,
}));

import {
  writeAuditLog,
  writeAuthFailureEvent,
  listAuditLogs,
} from "../audit.js";

import { revokeEntryToken, generateEntryToken } from "../tokens.js";

import { logExportInitiated } from "../export.js";

import {
  forceCloseJurorEditMode,
  createJuror,
  updateJuror,
  deleteJuror,
  resetJurorPin,
  unlockJurorPin,
} from "../jurors.js";

import { createProject, deleteProject } from "../projects.js";

import {
  createPeriod,
  deletePeriod,
  setEvalLock,
  publishPeriod,
  closePeriod,
  duplicatePeriod,
  savePeriodCriteria,
} from "../periods.js";

// ── Query builder factory for listAuditLogs tests ───────────────────────────

function makeQueryBuilder(resolveWith) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    then: (resolve) => Promise.resolve(resolveWith).then(resolve),
  };
  return builder;
}

// ── writeAuditLog ────────────────────────────────────────────────────────────

describe("audit — writeAuditLog interface", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("audit.completeness.01", async () => {
    mockRpc.mockResolvedValue({ error: null });
    await writeAuditLog("juror.created", { organizationId: "org-1" });
    expect(mockRpc).toHaveBeenCalledWith(
      "rpc_admin_write_audit_event",
      expect.objectContaining({ p_event: expect.any(Object) })
    );
  });

  qaTest("audit.completeness.02", async () => {
    mockRpc.mockResolvedValue({ error: null });
    await writeAuditLog("juror.created", {});
    const call = mockRpc.mock.calls[0];
    expect(call[1].p_event.action).toBe("juror.created");
  });

  qaTest("audit.completeness.03", async () => {
    mockRpc.mockResolvedValue({ error: null });
    await writeAuditLog("test.action", { organizationId: "org-42" });
    const call = mockRpc.mock.calls[0];
    expect(call[1].p_event.organizationId).toBe("org-42");
  });

  qaTest("audit.completeness.04", async () => {
    mockRpc.mockResolvedValue({ error: { message: "fail", code: "P0001" } });
    await expect(writeAuditLog("test.action", {})).rejects.toMatchObject({
      message: "fail",
    });
  });
});

// ── writeAuthFailureEvent ────────────────────────────────────────────────────

describe("audit — writeAuthFailureEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("audit.completeness.05", async () => {
    mockRpc.mockResolvedValue({ error: { message: "auth write failed", code: "42501" } });
    await expect(writeAuthFailureEvent("admin@example.com")).resolves.toBeUndefined();
  });
});

// ── revokeEntryToken ─────────────────────────────────────────────────────────

describe("audit — revokeEntryToken (audit-embedded RPC)", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("audit.completeness.06", async () => {
    mockRpc.mockResolvedValue({ data: { active_juror_count: 0, revoked_count: 1 }, error: null });
    await revokeEntryToken("period-1");
    expect(mockRpc).toHaveBeenCalledWith(
      "rpc_admin_revoke_entry_token",
      expect.any(Object)
    );
  });

  qaTest("audit.completeness.07", async () => {
    mockRpc.mockResolvedValue({ data: { active_juror_count: 0, revoked_count: 1 }, error: null });
    await revokeEntryToken("period-99");
    expect(mockRpc.mock.calls[0][1]).toEqual({ p_period_id: "period-99" });
  });

  qaTest("audit.completeness.08", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "revoke failed" } });
    await expect(revokeEntryToken("period-1")).rejects.toMatchObject({
      message: "revoke failed",
    });
  });
});

// ── logExportInitiated ───────────────────────────────────────────────────────

describe("audit — logExportInitiated (edge function path)", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("audit.completeness.09", async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    await logExportInitiated({ action: "export.scores", organizationId: "org-1" });
    expect(mockInvoke).toHaveBeenCalledWith(
      "log-export-event",
      expect.objectContaining({ body: expect.objectContaining({ action: "export.scores" }) })
    );
  });

  qaTest("audit.completeness.10", async () => {
    await expect(
      logExportInitiated({ action: "download.csv" })
    ).rejects.toThrow();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  qaTest("audit.completeness.11", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: "edge fn error" } });
    await expect(
      logExportInitiated({ action: "export.csv" })
    ).rejects.toMatchObject({ message: "edge fn error" });
  });
});

// ── forceCloseJurorEditMode ──────────────────────────────────────────────────

describe("audit — forceCloseJurorEditMode (audit-embedded RPC)", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("audit.completeness.12", async () => {
    mockRpc.mockResolvedValue({ error: null });
    await forceCloseJurorEditMode({ jurorId: "j1", periodId: "p1" });
    expect(mockRpc).toHaveBeenCalledWith(
      "rpc_admin_force_close_juror_edit_mode",
      expect.any(Object)
    );
  });
});

// ── listAuditLogs filters ────────────────────────────────────────────────────

describe("audit — listAuditLogs filter behavior", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("audit.completeness.13", async () => {
    let dataBuilder, countBuilder;
    mockFrom.mockImplementation(() => {
      if (!dataBuilder) {
        dataBuilder = makeQueryBuilder({ data: [], error: null });
        return dataBuilder;
      }
      countBuilder = makeQueryBuilder({ count: 0, error: null });
      return countBuilder;
    });

    await listAuditLogs({ organizationId: "org-1" });

    const eqCalls = dataBuilder.eq.mock.calls;
    const orgFilter = eqCalls.find((c) => c[0] === "organization_id");
    expect(orgFilter).toBeDefined();
    expect(orgFilter[1]).toBe("org-1");
  });

  qaTest("audit.completeness.14", async () => {
    let dataBuilder, countBuilder;
    mockFrom.mockImplementation(() => {
      if (!dataBuilder) {
        dataBuilder = makeQueryBuilder({ data: [], error: null });
        return dataBuilder;
      }
      countBuilder = makeQueryBuilder({ count: 0, error: null });
      return countBuilder;
    });

    await listAuditLogs({});

    const eqCalls = dataBuilder.eq.mock.calls;
    const orgFilter = eqCalls.find((c) => c[0] === "organization_id");
    expect(orgFilter).toBeUndefined();
  });

  qaTest("audit.completeness.15", async () => {
    let dataBuilder, countBuilder;
    mockFrom.mockImplementation(() => {
      if (!dataBuilder) {
        dataBuilder = makeQueryBuilder({ data: [], error: null });
        return dataBuilder;
      }
      countBuilder = makeQueryBuilder({ count: 0, error: null });
      return countBuilder;
    });

    await listAuditLogs({ actions: ["export.scores"] });

    const inCalls = dataBuilder.in.mock.calls;
    const actionFilter = inCalls.find((c) => c[0] === "action");
    expect(actionFilter).toBeDefined();
    expect(actionFilter[1]).toContain("export.scores");
  });
});

// ── juror mutations ──────────────────────────────────────────────────────────

describe("audit — juror table mutations", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("audit.completeness.16", async () => {
    const builder = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "j1" }, error: null }),
    };
    mockFrom.mockReturnValue(builder);
    await createJuror({ organizationId: "org-1", juror_name: "Test Juror" });
    expect(mockFrom).toHaveBeenCalledWith("jurors");
  });

  qaTest("audit.completeness.17", async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "j1" }, error: null }),
    };
    mockFrom.mockReturnValue(builder);
    await updateJuror({ id: "j1", juror_name: "Updated Name" });
    expect(mockFrom).toHaveBeenCalledWith("jurors");
  });

  qaTest("audit.completeness.18", async () => {
    const builder = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockFrom.mockReturnValue(builder);
    await deleteJuror("j1");
    expect(mockFrom).toHaveBeenCalledWith("jurors");
  });

  qaTest("audit.completeness.19", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    await resetJurorPin({ jurorId: "j1", periodId: "p1" });
    expect(mockRpc).toHaveBeenCalledWith("rpc_juror_reset_pin", expect.any(Object));
  });

  qaTest("audit.completeness.20", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    await unlockJurorPin({ jurorId: "j1", periodId: "p1" });
    expect(mockRpc).toHaveBeenCalledWith("rpc_juror_unlock_pin", expect.any(Object));
  });
});

// ── project mutations ────────────────────────────────────────────────────────

describe("audit — project table mutations", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("audit.completeness.21", async () => {
    const builder = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "pr1" }, error: null }),
    };
    mockFrom.mockReturnValue(builder);
    await createProject({ periodId: "per-1", title: "Test Project", members: [] });
    expect(mockFrom).toHaveBeenCalledWith("projects");
  });

  qaTest("audit.completeness.22", async () => {
    const builder = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockFrom.mockReturnValue(builder);
    await deleteProject("pr1");
    expect(mockFrom).toHaveBeenCalledWith("projects");
  });
});

// ── period lifecycle RPCs ────────────────────────────────────────────────────

describe("audit — period mutations (table + audit-embedded RPCs)", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("audit.completeness.23", async () => {
    const builder = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "per-1" }, error: null }),
    };
    mockFrom.mockReturnValue(builder);
    await createPeriod({ organizationId: "org-1", name: "Spring 2026" });
    expect(mockFrom).toHaveBeenCalledWith("periods");
  });

  qaTest("audit.completeness.24", async () => {
    const builder = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockFrom.mockReturnValue(builder);
    await deletePeriod("per-1");
    expect(mockFrom).toHaveBeenCalledWith("periods");
  });

  qaTest("audit.completeness.25", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    await setEvalLock("per-1", true);
    expect(mockRpc).toHaveBeenCalledWith("rpc_admin_set_period_lock", expect.any(Object));
  });

  qaTest("audit.completeness.26", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    await publishPeriod("per-1");
    expect(mockRpc).toHaveBeenCalledWith("rpc_admin_publish_period", expect.any(Object));
  });

  qaTest("audit.completeness.27", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    await closePeriod("per-1");
    expect(mockRpc).toHaveBeenCalledWith("rpc_admin_close_period", expect.any(Object));
  });

  qaTest("audit.completeness.28", async () => {
    mockRpc.mockResolvedValue({ data: { id: "per-2" }, error: null });
    await duplicatePeriod("per-1");
    expect(mockRpc).toHaveBeenCalledWith("rpc_admin_duplicate_period", expect.any(Object));
  });

  qaTest("audit.completeness.29", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await savePeriodCriteria("per-1", []);
    expect(mockRpc).toHaveBeenCalledWith("rpc_admin_save_period_criteria", expect.any(Object));
  });
});

// ── token generation ─────────────────────────────────────────────────────────

describe("audit — generateEntryToken (audit-embedded RPC)", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("audit.completeness.30", async () => {
    mockRpc.mockResolvedValue({ data: { token: "abc123" }, error: null });
    await generateEntryToken("per-1");
    expect(mockRpc).toHaveBeenCalledWith("rpc_admin_generate_entry_token", expect.any(Object));
  });
});

// ── param shape verification ──────────────────────────────────────────────────

describe("audit — RPC parameter shapes", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("audit.completeness.31", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await resetJurorPin({ jurorId: "j-abc", periodId: "p-xyz" });
    expect(mockRpc.mock.calls[0][1]).toEqual({
      p_period_id: "p-xyz",
      p_juror_id: "j-abc",
    });
  });

  qaTest("audit.completeness.32", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await unlockJurorPin({ jurorId: "j-abc", periodId: "p-xyz" });
    expect(mockRpc.mock.calls[0][1]).toEqual({
      p_period_id: "p-xyz",
      p_juror_id: "j-abc",
    });
  });

  qaTest("audit.completeness.33", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    await setEvalLock("per-1", false);
    const params = mockRpc.mock.calls[0][1];
    expect(params.p_locked).toBe(false);
    expect(params.p_period_id).toBe("per-1");
  });

  qaTest("audit.completeness.34", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    await publishPeriod("per-99");
    expect(mockRpc.mock.calls[0][1]).toEqual({ p_period_id: "per-99" });
  });

  qaTest("audit.completeness.35", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    await closePeriod("per-99");
    expect(mockRpc.mock.calls[0][1]).toEqual({ p_period_id: "per-99" });
  });

  qaTest("audit.completeness.36", async () => {
    mockRpc.mockResolvedValue({ data: { token: "abc" }, error: null });
    await generateEntryToken("per-77");
    expect(mockRpc.mock.calls[0][1]).toEqual({ p_period_id: "per-77" });
  });
});
