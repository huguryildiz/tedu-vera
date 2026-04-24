import { describe, vi, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";
import { mockSuccess } from "@/test/adminApiMocks";

vi.mock("@/auth", () => ({
  useAuth: () => ({
    user: { id: "u-001", email: "admin@example.com" },
    displayName: "Demo Admin",
    setDisplayName: vi.fn(),
    updatePassword: vi.fn(),
  }),
}));

vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/shared/api", () => ({
  upsertProfile: vi.fn().mockResolvedValue({ display_name: "Demo Admin" }),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    auth: { updateUser: vi.fn().mockResolvedValue({ error: null }) },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/avatar.jpg" } })),
      })),
    },
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue(mockSuccess(null)) })),
    })),
  },
}));

vi.mock("@/shared/passwordPolicy", () => ({
  isStrongPassword: vi.fn(() => true),
  PASSWORD_POLICY_ERROR_TEXT: "Password too weak",
}));

import { useProfileEdit } from "../useProfileEdit";

describe("useProfileEdit", () => {
  qaTest("admin.settings.hook.profile", () => {
    const { result } = renderHook(() => useProfileEdit());
    expect(result.current.form).toBeDefined();
    expect(result.current.isDirty).toBe(false);
  });
});
