// src/admin/pages/OrgSettingsPage.jsx
// Standalone page for organization management (super-admin) and general settings.

import { useCallback } from "react";
import { useToast } from "../../components/toast/useToast";
import { useAuth } from "../../shared/auth";
import { useManageOrganizations } from "../hooks/useManageOrganizations";
import ManageOrganizationsPanel from "../settings/ManageOrganizationsPanel";
import PageShell from "./PageShell";

export default function OrgSettingsPage({
  organizationId,
  isDemoMode = false,
  onDirtyChange,
}) {
  const { isSuper } = useAuth();
  const _toast = useToast();
  const setMessage = (msg) => { if (msg) _toast.success(msg); };

  // Loading helpers (lightweight — no global loading bar for settings page)
  const incLoading = useCallback(() => {}, []);
  const decLoading = useCallback(() => {}, []);

  const org = useManageOrganizations({
    enabled: isSuper,
    setMessage,
    incLoading,
    decLoading,
    onDirtyChange,
  });

  return (
    <PageShell
      title="Settings"
      description={isSuper ? "Organization and system configuration" : "System configuration"}
    >
      {isSuper && (
        <ManageOrganizationsPanel
          isDemoMode={isDemoMode}
          {...org}
        />
      )}
      {!isSuper && (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          No additional settings available for your account type.
        </div>
      )}
    </PageShell>
  );
}
