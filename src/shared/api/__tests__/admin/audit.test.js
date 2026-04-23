import { describe, expect, vi, beforeEach } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    rpc: mockRpc,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  },
}));

import { writeAuditLog, writeAuthFailureEvent } from "../../admin/audit.js";

describe("admin/audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  qaTest("api.admin.audit.01", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await writeAuditLog("period.create", { resourceType: "period", resourceId: "p1" });
    expect(mockRpc).toHaveBeenCalledWith("rpc_admin_write_audit_event", expect.objectContaining({
      p_event: expect.objectContaining({ action: "period.create", resourceType: "period" }),
    }));
  });

  qaTest("api.admin.audit.02", async () => {
    const rpcError = new Error("connection lost");
    mockRpc.mockResolvedValue({ data: null, error: rpcError });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(writeAuthFailureEvent("bad@example.com")).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
