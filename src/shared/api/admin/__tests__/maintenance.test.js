import { describe, vi, expect } from "vitest";
import { qaTest } from "@/test/qaTest";

const mockRpc = vi.fn();

vi.mock("../../core/client", () => ({
  supabase: {
    rpc: (...args) => mockRpc(...args),
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

vi.mock("../../core/invokeEdgeFunction", () => ({
  invokeEdgeFunction: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

import { getMaintenanceStatus, cancelMaintenance } from "../maintenance";

describe("maintenance", () => {
  qaTest("coverage.maintenance.get-status", async () => {
    mockRpc.mockResolvedValueOnce({ data: { is_active: false }, error: null });
    const result = await getMaintenanceStatus();
    expect(result).toEqual({ is_active: false });
    expect(mockRpc).toHaveBeenCalledWith("rpc_public_maintenance_status");
  });

  qaTest("coverage.maintenance.cancel", async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const result = await cancelMaintenance();
    expect(result).toEqual({ ok: true });
    expect(mockRpc).toHaveBeenCalledWith("rpc_admin_cancel_maintenance");
  });
});
