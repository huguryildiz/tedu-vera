import { describe, expect, vi, beforeEach } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";

const { mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
    },
  },
}));

import { upsertProfile, getProfile } from "../../admin/profiles.js";

describe("admin/profiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  qaTest("api.admin.profiles.01", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(upsertProfile("Alice")).rejects.toThrow("Not authenticated");
  });

  qaTest("api.admin.profiles.02", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await getProfile();
    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
