import { describe, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "../../test/qaTest.js";
import AdminTeamCard from "@/admin/shared/AdminTeamCard.jsx";

vi.mock("../../shared/lib/supabaseClient", () => ({ supabase: {} }));

function baseProps(overrides = {}) {
  return {
    members: [],
    loading: false,
    error: null,
    inviteForm: { open: false, email: "", submitting: false, error: null },
    openInviteForm: vi.fn(),
    closeInviteForm: vi.fn(),
    setInviteEmail: vi.fn(),
    sendInvite: vi.fn(),
    resendInvite: vi.fn(),
    cancelInvite: vi.fn(),
    transferOwnership: vi.fn(),
    removeMember: vi.fn(),
    setAdminsCanInvite: vi.fn(),
    adminsCanInvite: false,
    canInvite: false,
    isOwnerViewer: false,
    currentUserId: "viewer-id",
    ...overrides,
  };
}

const owner = {
  id: "m-own",
  userId: "viewer-id",
  email: "owner@x.com",
  status: "active",
  isOwner: true,
  isYou: true,
  displayName: "Owner User",
};

const other = {
  id: "m-oth",
  userId: "u2",
  email: "other@x.com",
  status: "active",
  isOwner: false,
  isYou: false,
  displayName: "Other Admin",
};

describe("AdminTeamCard ownership UI", () => {
  qaTest("settings.team.ui.owner-pill", () => {
    render(
      <AdminTeamCard
        {...baseProps({ members: [owner, other], canInvite: true, isOwnerViewer: true })}
      />
    );
    const ownerCell = screen.getByText("Owner User").closest("td");
    expect(ownerCell?.textContent).toMatch(/Owner/i);
  });

  qaTest("settings.team.ui.owner-invite-button", () => {
    render(
      <AdminTeamCard
        {...baseProps({ members: [owner], canInvite: true, isOwnerViewer: true })}
      />
    );
    expect(screen.getByRole("button", { name: /Invite Admin/i })).toBeInTheDocument();
  });

  qaTest("settings.team.ui.non-owner-info-note", () => {
    const viewer = { ...other, isYou: true };
    const otherOwner = { ...owner, isYou: false };
    render(
      <AdminTeamCard
        {...baseProps({
          members: [otherOwner, viewer],
          canInvite: false,
          isOwnerViewer: false,
        })}
      />
    );
    expect(screen.queryByRole("button", { name: /Invite Admin/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Only the owner can invite/i)).toBeInTheDocument();
  });

  qaTest("settings.team.ui.non-owner-no-kebab", () => {
    const viewer = { ...other, isYou: true };
    const otherOwner = { ...owner, isYou: false };
    const third = {
      id: "m-third",
      userId: "u3",
      email: "b@x",
      status: "active",
      isOwner: false,
      isYou: false,
      displayName: "Third",
    };
    render(
      <AdminTeamCard
        {...baseProps({
          members: [otherOwner, viewer, third],
          canInvite: false,
          isOwnerViewer: false,
        })}
      />
    );
    expect(screen.queryByRole("button", { name: /More actions/i })).not.toBeInTheDocument();
  });

  qaTest("settings.team.ui.owner-toggle", () => {
    render(
      <AdminTeamCard
        {...baseProps({ members: [owner], isOwnerViewer: true, canInvite: true })}
      />
    );
    expect(screen.getByText(/Allow admins to invite other admins/i)).toBeInTheDocument();
  });
});
