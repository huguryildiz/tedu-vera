// src/admin/drawers/EditProfileDrawer.jsx
// Drawer: edit the current user's display name.
// Email, role, and organization are read-only.
//
// Props:
//   open         — boolean
//   onClose      — () => void
//   profile      — { displayName, email, role, organization }
//   onSave       — ({ displayName }) => Promise<void>
//   error        — string | null

import { useState, useEffect } from "react";
import Drawer from "@/shared/ui/Drawer";

export default function EditProfileDrawer({ open, onClose, profile, onSave, error }) {
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (open) {
      setDisplayName(profile?.displayName ?? "");
      setSaveError("");
      setSaving(false);
    }
  }, [open, profile]);

  const handleSave = async () => {
    setSaveError("");
    setSaving(true);
    try {
      await onSave?.({ displayName: displayName.trim() });
      onClose();
    } catch (e) {
      setSaveError(e?.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const displayError = saveError || error;

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="fs-drawer-header">
        <div className="fs-drawer-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="fs-icon identity">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="fs-title-group">
              <div className="fs-title">Edit Profile</div>
              <div className="fs-subtitle">Update your display name and account details</div>
            </div>
          </div>
          <button className="fs-close" type="button" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="fs-drawer-body" style={{ gap: 16 }}>
        {displayError && (
          <div className="fs-alert danger" style={{ marginBottom: 4 }}>
            <div className="fs-alert-body">{displayError}</div>
          </div>
        )}

        <div className="fs-field-row">
          <label className="fs-label">Display Name</label>
          <input
            className="fs-input"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={saving}
            placeholder="Your display name"
          />
        </div>

        <div className="fs-field-row">
          <label className="fs-label">Email</label>
          <input
            className="fs-input"
            type="email"
            value={profile?.email ?? ""}
            disabled
            style={{ opacity: 0.6, cursor: "not-allowed" }}
            readOnly
          />
          <div className="fs-field-helper hint">
            Email is managed by your authentication provider and cannot be changed here.
          </div>
        </div>

        <div className="fs-field-row">
          <label className="fs-label">Role</label>
          <input
            className="fs-input"
            type="text"
            value={profile?.role ?? ""}
            disabled
            style={{ opacity: 0.6, cursor: "not-allowed" }}
            readOnly
          />
          <div className="fs-field-helper hint">Role changes require Super Admin approval.</div>
        </div>

        <div className="fs-field-row">
          <label className="fs-label">Organization</label>
          <input
            className="fs-input"
            type="text"
            value={profile?.organization ?? ""}
            disabled
            style={{ opacity: 0.6, cursor: "not-allowed" }}
            readOnly
          />
        </div>
      </div>

      <div className="fs-drawer-footer">
        <button className="fs-btn fs-btn-secondary" type="button" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button
          className="fs-btn fs-btn-primary"
          type="button"
          onClick={handleSave}
          disabled={saving || !displayName.trim()}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </Drawer>
  );
}
