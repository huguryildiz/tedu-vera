import { describe, vi, expect, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

const mockListOrgAdminMembers = vi.fn();
const mockInviteOrgAdmin = vi.fn();
const mockCancelOrgAdminInvite = vi.fn();
const mockTransferOwnership = vi.fn();
const mockRemoveOrgAdmin = vi.fn();
const mockSetAdminsCanInvite = vi.fn();

vi.mock("@/shared/api", () => ({
  listOrgAdminMembers: (...a) => mockListOrgAdminMembers(...a),
  inviteOrgAdmin: (...a) => mockInviteOrgAdmin(...a),
  cancelOrgAdminInvite: (...a) => mockCancelOrgAdminInvite(...a),
  transferOwnership: (...a) => mockTransferOwnership(...a),
  removeOrgAdmin: (...a) => mockRemoveOrgAdmin(...a),
  setAdminsCanInvite: (...a) => mockSetAdminsCanInvite(...a),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError }),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: {} }));

import { useAdminTeam } from "../useAdminTeam";

const FAKE_MEMBERS = [
  { id: "m1", user_id: "u1", email: "owner@test.com", display_name: "Owner", status: "active", created_at: "2024-01-01", is_owner: true, is_you: true },
  { id: "m2", user_id: "u2", email: "admin@test.com", display_name: "Admin", status: "active", created_at: "2024-01-02", is_owner: false, is_you: false },
  { id: "m3", user_id: null, email: "invited@test.com", display_name: null, status: "invited", created_at: "2024-01-03", is_owner: false, is_you: false },
];

describe("useAdminTeam", () => {
  beforeEach(() => {
    mockListOrgAdminMembers.mockResolvedValue({ members: FAKE_MEMBERS, adminsCanInvite: false });
    mockInviteOrgAdmin.mockResolvedValue({ status: "sent" });
    mockCancelOrgAdminInvite.mockResolvedValue(null);
    mockSetAdminsCanInvite.mockResolvedValue({ ok: true });
    mockInviteOrgAdmin.mockClear();
    mockCancelOrgAdminInvite.mockClear();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  qaTest("admin.shared.adminTeam.01", async () => {
    const { result } = renderHook(() => useAdminTeam("org-001"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.members).toHaveLength(3);
    expect(result.current.members[0].email).toBe("owner@test.com");
    expect(result.current.members[0].isOwner).toBe(true);
    expect(result.current.members[0].isYou).toBe(true);
    expect(result.current.members[2].status).toBe("invited");
    expect(result.current.adminsCanInvite).toBe(false);
    expect(result.current.canInvite).toBe(true); // isOwnerViewer is true
  });

  qaTest("admin.shared.adminTeam.02", async () => {
    mockInviteOrgAdmin.mockResolvedValue({ status: "sent" });
    mockListOrgAdminMembers
      .mockResolvedValueOnce({ members: FAKE_MEMBERS, adminsCanInvite: false })
      .mockResolvedValue({ members: [...FAKE_MEMBERS, { id: "m4", user_id: null, email: "new@test.com", display_name: null, status: "invited", created_at: "2024-01-04", is_owner: false, is_you: false }], adminsCanInvite: false });

    const { result } = renderHook(() => useAdminTeam("org-001"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.setInviteEmail("new@test.com"); });
    await act(async () => { await result.current.sendInvite(); });

    expect(mockInviteOrgAdmin).toHaveBeenCalledWith("org-001", "new@test.com");
    expect(mockToastSuccess).toHaveBeenCalledWith("Invite sent");
    await waitFor(() => expect(result.current.members).toHaveLength(4));
    expect(result.current.inviteForm.open).toBe(false);
  });

  qaTest("admin.shared.adminTeam.03", async () => {
    const { result } = renderHook(() => useAdminTeam("org-001"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.openInviteForm(); });
    await act(async () => { await result.current.sendInvite(); });

    expect(mockInviteOrgAdmin).not.toHaveBeenCalled();
    expect(result.current.inviteForm.error).toBe("Email is required");
  });

  qaTest("admin.shared.adminTeam.04", async () => {
    mockListOrgAdminMembers
      .mockResolvedValueOnce({ members: FAKE_MEMBERS, adminsCanInvite: false })
      .mockResolvedValue({ members: FAKE_MEMBERS.slice(0, 2), adminsCanInvite: false });

    const { result } = renderHook(() => useAdminTeam("org-001"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.cancelInvite("m3"); });

    expect(mockCancelOrgAdminInvite).toHaveBeenCalledWith("m3");
    expect(mockToastSuccess).toHaveBeenCalledWith("Invite cancelled");
    await waitFor(() => expect(result.current.members).toHaveLength(2));
  });

  qaTest("admin.shared.adminTeam.05", async () => {
    mockSetAdminsCanInvite.mockRejectedValue(new Error("Permission denied"));

    const { result } = renderHook(() => useAdminTeam("org-001"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const prevValue = result.current.adminsCanInvite; // false

    await act(async () => { await result.current.setAdminsCanInvite(true); });

    // Should have been set optimistically then rolled back
    expect(result.current.adminsCanInvite).toBe(prevValue);
    expect(mockToastError).toHaveBeenCalledWith("Permission denied");
  });
});
