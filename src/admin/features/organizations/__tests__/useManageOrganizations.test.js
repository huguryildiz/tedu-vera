import { describe, vi, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

const { mockCreateOrg, EMPTY_ORGS } = vi.hoisted(() => ({
  mockCreateOrg: vi.fn().mockResolvedValue({ data: { id: "org-new" }, error: null }),
  EMPTY_ORGS: Object.freeze([]),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  },
}));

vi.mock("@/shared/api", () => ({
  listOrganizations: vi.fn().mockResolvedValue(EMPTY_ORGS),
  createOrganization: mockCreateOrg,
  updateOrganization: vi.fn().mockResolvedValue({ data: {}, error: null }),
  inviteOrgAdmin: vi.fn().mockResolvedValue({ data: {}, error: null }),
  approveJoinRequest: vi.fn().mockResolvedValue({ data: {}, error: null }),
  rejectJoinRequest: vi.fn().mockResolvedValue({ data: {}, error: null }),
  deleteOrganization: vi.fn().mockResolvedValue({ data: {}, error: null }),
  cancelInvite: vi.fn().mockResolvedValue({ data: {}, error: null }),
  deleteTenantAdmin: vi.fn().mockResolvedValue({ data: {}, error: null }),
  updateTenantAdmin: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

import { useManageOrganizations } from "@/admin/shared/useManageOrganizations";

function makeOpts(overrides = {}) {
  return {
    enabled: true,
    organizationId: null,
    onDirtyChange: vi.fn(),
    setMessage: vi.fn(),
    incLoading: vi.fn(),
    decLoading: vi.fn(),
    ...overrides,
  };
}

describe("useManageOrganizations", () => {
  qaTest("admin.orgs.hook.load", () => {
    const { result } = renderHook(() => useManageOrganizations(makeOpts()));
    expect(Array.isArray(result.current.orgList)).toBe(true);
    expect(result.current.orgList).toEqual([]);
    expect(typeof result.current.handleCreateOrg).toBe("function");
  });

  qaTest("admin.orgs.create.happy", async () => {
    const { result } = renderHook(() => useManageOrganizations(makeOpts()));

    await act(async () => {
      result.current.setCreateForm({
        name: "Test University",
        shortLabel: "TESTU",
        contact_email: "admin@testu.edu",
        status: "active",
      });
    });

    await act(async () => {
      await result.current.handleCreateOrg();
    });

    expect(mockCreateOrg).toHaveBeenCalled();
  });
});
