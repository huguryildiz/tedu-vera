import { useState, useEffect, useCallback } from "react";
import {
  listOrgAdminMembers,
  inviteOrgAdmin,
  cancelOrgAdminInvite,
  transferOwnership as apiTransferOwnership,
  removeOrgAdmin as apiRemoveOrgAdmin,
  setAdminsCanInvite as apiSetAdminsCanInvite,
} from "../../shared/api";
import { useToast } from "@/shared/hooks/useToast";

function mapMembers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => ({
    id: m.id,
    userId: m.user_id || null,
    email: m.email || "",
    displayName: m.display_name || null,
    status: m.status === "active" ? "active" : "invited",
    joinedAt: m.status === "active" ? m.created_at || null : null,
    invitedAt: m.status === "invited" ? m.created_at || null : null,
    isOwner: Boolean(m.is_owner),
    isYou: Boolean(m.is_you),
  }));
}

const INITIAL_INVITE_FORM = { open: false, email: "", submitting: false, error: null };

export function useAdminTeam(orgId) {
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inviteForm, setInviteForm] = useState(INITIAL_INVITE_FORM);
  const [adminsCanInvite, setAdminsCanInviteState] = useState(false);

  const refetch = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const { members: raw, adminsCanInvite: flag } = await listOrgAdminMembers();
      setMembers(mapMembers(raw));
      setAdminsCanInviteState(flag);
    } catch (e) {
      setError(e.message || "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const openInviteForm = useCallback(
    () => setInviteForm((f) => ({ ...f, open: true })),
    []
  );

  const closeInviteForm = useCallback(() => setInviteForm(INITIAL_INVITE_FORM), []);

  const setInviteEmail = useCallback(
    (email) => setInviteForm((f) => ({ ...f, email })),
    []
  );

  const sendInvite = useCallback(async () => {
    const email = inviteForm.email.trim();
    if (!email) {
      setInviteForm((f) => ({ ...f, error: "Email is required" }));
      return;
    }
    setInviteForm((f) => ({ ...f, submitting: true, error: null }));
    try {
      const result = await inviteOrgAdmin(orgId, email);
      const msg =
        result?.status === "reinvited"
          ? "Invite resent"
          : result?.status === "added"
          ? "Admin added"
          : "Invite sent";
      toast.success(msg);
      setInviteForm(INITIAL_INVITE_FORM);
      await refetch();
    } catch (e) {
      setInviteForm((f) => ({
        ...f,
        submitting: false,
        error: e.message || "Failed to send invite",
      }));
    }
  }, [orgId, inviteForm.email, toast, refetch]);

  const resendInvite = useCallback(
    async (_membershipId, email) => {
      try {
        await inviteOrgAdmin(orgId, email);
        toast.success("Invite resent");
        await refetch();
      } catch (e) {
        toast.error(e.message || "Failed to resend");
      }
    },
    [orgId, toast, refetch]
  );

  const cancelInvite = useCallback(
    async (membershipId) => {
      try {
        await cancelOrgAdminInvite(membershipId);
        toast.success("Invite cancelled");
        await refetch();
      } catch (e) {
        toast.error(e.message || "Failed to cancel");
      }
    },
    [toast, refetch]
  );

  const isOwnerViewer = members.some((m) => m.isYou && m.isOwner);
  const canInvite = isOwnerViewer || adminsCanInvite;

  const transferOwnership = useCallback(
    async (targetMembershipId) => {
      try {
        await apiTransferOwnership(targetMembershipId);
        toast.success("Ownership transferred");
        await refetch();
      } catch (e) {
        toast.error(e.message || "Failed to transfer ownership");
      }
    },
    [toast, refetch]
  );

  const removeMember = useCallback(
    async (membershipId) => {
      try {
        await apiRemoveOrgAdmin(membershipId);
        toast.success("Admin removed");
        await refetch();
      } catch (e) {
        toast.error(e.message || "Failed to remove admin");
      }
    },
    [toast, refetch]
  );

  const setAdminsCanInviteFlag = useCallback(
    async (enabled) => {
      if (!orgId) return;
      const prev = adminsCanInvite;
      setAdminsCanInviteState(enabled); // optimistic
      try {
        await apiSetAdminsCanInvite(orgId, enabled);
        toast.success(enabled ? "Admins can now invite" : "Only owner can invite now");
      } catch (e) {
        setAdminsCanInviteState(prev); // revert
        toast.error(e.message || "Failed to update setting");
      }
    },
    [orgId, adminsCanInvite, toast]
  );

  return {
    members,
    loading,
    error,
    inviteForm,
    openInviteForm,
    closeInviteForm,
    setInviteEmail,
    sendInvite,
    resendInvite,
    cancelInvite,
    adminsCanInvite,
    canInvite,
    isOwnerViewer,
    transferOwnership,
    removeMember,
    setAdminsCanInvite: setAdminsCanInviteFlag,
  };
}
