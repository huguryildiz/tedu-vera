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

import { updateJuror, resetJurorPin, setJurorEditMode } from "../../admin/jurors.js";

describe("admin/jurors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  qaTest("api.admin.jurors.01", async () => {
    await expect(updateJuror({ id: null, jurorId: undefined })).rejects.toThrow(
      "updateJuror: id required"
    );
  });

  qaTest("api.admin.jurors.02", async () => {
    await expect(resetJurorPin({ jurorId: "j1", periodId: "" })).rejects.toThrow(
      "resetJurorPin: jurorId and periodId required"
    );
    await expect(resetJurorPin({ jurorId: "", periodId: "p1" })).rejects.toThrow(
      "resetJurorPin: jurorId and periodId required"
    );
  });

  qaTest("api.admin.jurors.03", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await setJurorEditMode({ jurorId: "j1", periodId: "p1", enabled: true, reason: "Correction" });
    expect(mockRpc).toHaveBeenCalledWith("rpc_juror_toggle_edit_mode", expect.objectContaining({
      p_juror_id: "j1",
      p_period_id: "p1",
      p_enabled: true,
    }));
  });
});
