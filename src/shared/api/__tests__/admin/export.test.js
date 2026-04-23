import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    supabaseUrl: "https://test.supabase.co",
    supabaseKey: "test-anon-key",
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

import { logExportInitiated } from "../../admin/export.js";

describe("admin/export", () => {
  let fetchSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  qaTest("api.admin.export.01", async () => {
    await expect(
      logExportInitiated({ action: "download.csv", organizationId: "org1" })
    ).rejects.toThrow("logExportInitiated: action must start with 'export.'");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
