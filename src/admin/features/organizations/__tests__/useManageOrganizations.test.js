import { describe, vi, expect, beforeEach } from "vitest";
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

const mockUpdateOrganization = vi.fn().mockResolvedValue({ data: {}, error: null });
const mockInviteOrgAdmin = vi.fn().mockResolvedValue({ status: "invited" });

vi.mock("@/shared/api", () => ({
  listOrganizations: vi.fn().mockResolvedValue(EMPTY_ORGS),
  createOrganization: mockCreateOrg,
  updateOrganization: (...a) => mockUpdateOrganization(...a),
  inviteOrgAdmin: (...a) => mockInviteOrgAdmin(...a),
  approveJoinRequest: vi.fn().mockResolvedValue({ data: {}, error: null }),
  rejectJoinRequest: vi.fn().mockResolvedValue({ data: {}, error: null }),
  deleteOrganization: vi.fn().mockResolvedValue({ data: {}, error: null }),
  cancelInvite: vi.fn().mockResolvedValue({ data: {}, error: null }),
  deleteTenantAdmin: vi.fn().mockResolvedValue({ data: {}, error: null }),
  updateTenantAdmin: vi.fn().mockResolvedValue({ data: {}, error: null }),
  updateMemberAdmin: vi.fn().mockResolvedValue({ data: {}, error: null }),
  deleteMemberHard: vi.fn().mockResolvedValue({ data: {}, error: null }),
  cancelOrgAdminInvite: vi.fn().mockResolvedValue({ data: {}, error: null }),
  approveApplication: vi.fn().mockResolvedValue({ data: {}, error: null }),
  rejectApplication: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

import { useManageOrganizations } from "@/admin/shared/useManageOrganizations";
import { updateOrganization, inviteOrgAdmin } from "@/shared/api";

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
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateOrg.mockResolvedValue({ data: { id: "org-new" }, error: null });
    mockUpdateOrganization.mockResolvedValue({ data: {}, error: null });
    mockInviteOrgAdmin.mockResolvedValue({ status: "invited" });
  });

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

  // ── Partial-failure scenarios ──────────────────────────────

  qaTest("admin.orgs.create.validation-failure", async () => {
    // Partial failure: field validation error (missing email)
    // Hook should set field error and NOT call API
    const { result } = renderHook(() => useManageOrganizations(makeOpts()));

    await act(async () => {
      result.current.openCreate();
    });

    // Try to create with empty email (fails field validation check at line 258)
    await act(async () => {
      result.current.setCreateForm({
        name: "Test Org",
        shortLabel: "TEST",
        contact_email: "", // Empty email triggers field validation
        status: "active",
      });
    });

    await act(async () => {
      await result.current.handleCreateOrg();
    });

    // Field errors should be set for missing email
    expect(result.current.createFieldErrors.contact_email).toMatch(/required/);
    // API call should NOT have happened (validation failed before API attempt)
    expect(mockCreateOrg).not.toHaveBeenCalled();
  });

  qaTest("admin.orgs.create.api-failure-preserves-form", async () => {
    // Partial failure: API rejects with duplicate code
    // Form data should be preserved so user can edit and retry without losing input
    // Modal should close on success, but NOT on failure
    mockCreateOrg.mockRejectedValueOnce(
      new Error("duplicate key value violates unique constraint")
    );

    const { result } = renderHook(() => useManageOrganizations(makeOpts()));

    await act(async () => {
      result.current.openCreate();
    });

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

    // Form should still be populated (not cleared due to API failure)
    expect(result.current.createForm.name).toBe("Test University");
    expect(result.current.createForm.shortLabel).toBe("TESTU");
    // Error should be set from API failure
    expect(result.current.createError).toMatch(/already exists/);
    // Modal should still be open (closeCreate only called on success, line 284)
    expect(result.current.showCreate).toBe(true);
  });

  qaTest("admin.orgs.update.api-failure-surfaces-error", async () => {
    // Partial failure: update API fails (org not found)
    // Hook should surface error, NOT close modal, preserve user's edited values
    mockUpdateOrganization.mockRejectedValueOnce(
      new Error("organization_not_found")
    );

    const { result } = renderHook(() => useManageOrganizations(makeOpts()));

    await act(async () => {
      result.current.openEdit({
        id: "org-1",
        name: "Test Org",
        code: "test",
        shortLabel: "TEST",
        contact_email: "admin@test.edu",
        status: "active",
        created_at: "2025-01-01",
        updated_at: "2025-01-01",
      });
    });

    await act(async () => {
      result.current.setEditForm({
        ...result.current.editForm,
        name: "Updated Org Name",
      });
    });

    await act(async () => {
      await result.current.handleUpdateOrg();
    });

    // Error should be set from API failure
    expect(result.current.editError).toMatch(/not found/);
    // Modal should still be open (closeEdit only called on success)
    expect(result.current.showEdit).toBe(true);
    // Form should still have the updated name user entered (not reverted)
    expect(result.current.editForm.name).toBe("Updated Org Name");
  });

  qaTest("admin.orgs.invite.api-failure-returns-error", async () => {
    // Partial failure: invite API fails (email already member)
    // Hook should return error object and set hook-level error
    // inviteLoading should be false (indicating async complete)
    mockInviteOrgAdmin.mockRejectedValueOnce(
      new Error("already_member")
    );

    const { result } = renderHook(() => useManageOrganizations(makeOpts()));

    let inviteResult;
    await act(async () => {
      inviteResult = await result.current.handleInviteAdmin(
        "org-1",
        "admin@test.edu"
      );
    });

    // Result should indicate failure
    expect(inviteResult.ok).toBe(false);
    expect(inviteResult.error).toMatch(/already a member/);
    // Hook-level error should also be set
    expect(result.current.error).toMatch(/already a member/);
    // inviteLoading should be false (finished)
    expect(result.current.inviteLoading).toBe(false);
  });
});
