import { describe, vi, expect } from "vitest";
import { qaTest } from "@/test/qaTest";

const { mockRpc, mockStorage } = vi.hoisted(() => {
  const mockStorage = {
    from: vi.fn(() => ({
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.url/file.json" }, error: null }),
      upload: vi.fn(),
      remove: vi.fn(),
    })),
  };
  return { mockRpc: vi.fn(), mockStorage };
});

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    rpc: (...args) => mockRpc(...args),
    storage: mockStorage,
  },
}));

vi.mock("../../../lib/randomUUID", () => ({ randomUUID: () => "test-uuid" }));
vi.mock("../export.js", () => ({
  fullExport: vi.fn().mockResolvedValue({ periods: [], projects: [], jurors: [], scores: [], audit_logs: [] }),
  logExportInitiated: vi.fn().mockResolvedValue(undefined),
}));

import { listBackups, getBackupSignedUrl } from "../backups";

describe("backups", () => {
  qaTest("coverage.backups.list", async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ id: "b1" }], error: null });
    const result = await listBackups("org-1");
    expect(result).toEqual([{ id: "b1" }]);
    expect(mockRpc).toHaveBeenCalledWith("rpc_backup_list", { p_organization_id: "org-1" });
  });

  qaTest("coverage.backups.get-signed-url", async () => {
    const url = await getBackupSignedUrl("org-1/uuid.json");
    expect(url).toBe("https://signed.url/file.json");
  });
});
