// src/components/admin/AdminSecurityPanel.jsx

import { useState } from "react";
import { ChevronDownIcon, ShieldUserIcon } from "../../shared/Icons";
import { adminBootstrapPassword, adminChangePassword, adminChangeDeletePassword } from "../../shared/api";

export default function AdminSecurityPanel({
  isMobile,
  isOpen,
  onToggle,
  onPasswordChanged,
  adminPass,
  innerRef,
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [missingHash, setMissingHash] = useState(false);
  const [deleteCurrent, setDeleteCurrent] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteErrors, setDeleteErrors] = useState({});
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const validate = () => {
    const nextErrors = {};
    if (!missingHash && !currentPassword.trim()) {
      nextErrors.current = "Current password is required.";
    }
    if (!newPassword.trim()) nextErrors.next = "New password is required.";
    if (newPassword.trim() && newPassword.length < 8) {
      nextErrors.next = "New password must be at least 8 characters.";
    }
    if (!confirmPassword.trim()) nextErrors.confirm = "Confirm your new password.";
    if (newPassword.trim() && confirmPassword.trim() && newPassword !== confirmPassword) {
      nextErrors.confirm = "Passwords do not match.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    setSuccess("");
    setError("");
    if (!validate()) return;
    setLoading(true);
    try {
      if (missingHash) {
        await adminBootstrapPassword(newPassword);
        setSuccess("Admin password initialized successfully.");
        setMissingHash(false);
      } else {
        await adminChangePassword(currentPassword, newPassword);
        setSuccess("Password updated successfully.");
      }
      if (onPasswordChanged) {
        onPasswordChanged(newPassword);
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErrors({});
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.includes("incorrect_password")) {
        setError("Incorrect current password.");
      } else if (msg.includes("admin_password_hash_missing")) {
        setError("Admin password is not configured.");
        setMissingHash(true);
      } else if (msg.includes("already_initialized")) {
        setError("Admin password is already configured.");
        setMissingHash(false);
      } else {
        setError("Could not update password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const validateDelete = () => {
    const nextErrors = {};
    if (!deleteCurrent.trim()) nextErrors.current = "Current delete password is required.";
    if (!deletePassword.trim()) nextErrors.next = "New delete password is required.";
    if (deletePassword.trim() && deletePassword.length < 8) {
      nextErrors.next = "Delete password must be at least 8 characters.";
    }
    if (!deleteConfirm.trim()) nextErrors.confirm = "Confirm your delete password.";
    if (deletePassword.trim() && deleteConfirm.trim() && deletePassword !== deleteConfirm) {
      nextErrors.confirm = "Passwords do not match.";
    }
    setDeleteErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleDeleteSubmit = async () => {
    setDeleteSuccess("");
    setDeleteError("");
    if (!validateDelete()) return;
    if (!adminPass) {
      setDeleteError("Admin password missing. Please re-login.");
      return;
    }
    setDeleteLoading(true);
    try {
      await adminChangeDeletePassword(deleteCurrent, deletePassword, adminPass);
      setDeleteSuccess("Delete password updated successfully.");
      setDeleteCurrent("");
      setDeletePassword("");
      setDeleteConfirm("");
      setDeleteErrors({});
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.includes("delete_password_missing")) {
        setDeleteError("Delete password is not configured. Use the SQL initializer once.");
      } else if (msg.includes("incorrect_delete_password")) {
        setDeleteError("Incorrect current delete password.");
      } else if (msg.includes("unauthorized")) {
        setDeleteError("Incorrect admin password.");
      } else {
        setDeleteError("Could not update delete password. Please try again.");
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className={`manage-card${isMobile ? " is-collapsible" : ""}`} ref={innerRef}>
      <button
        type="button"
        className="manage-card-header"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div className="manage-card-title">
          <span className="manage-card-icon" aria-hidden="true"><ShieldUserIcon /></span>
          Admin Security
        </div>
        {isMobile && <ChevronDownIcon className={`manage-chevron${isOpen ? " open" : ""}`} />}
      </button>

      {(!isMobile || isOpen) && (
        <div className="manage-card-body">
          <div className="manage-card-desc">Manage admin and delete passwords to keep access secure.</div>
          <div className="manage-security-stack">
            <div className="manage-mini-card">
              <div className="manage-mini-card-title">Admin Password</div>
              <div className="manage-mini-card-body">
                <div className="manage-field">
                  <label className="manage-label">Current Password</label>
                  <input
                    type="password"
                    className="manage-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={missingHash}
                  />
                  {errors.current && <div className="manage-field-error">{errors.current}</div>}
                </div>

                <div className="manage-field">
                  <label className="manage-label">New Password</label>
                  <input
                    type="password"
                    className="manage-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  {errors.next && <div className="manage-field-error">{errors.next}</div>}
                </div>

                <div className="manage-field">
                  <label className="manage-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="manage-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  {errors.confirm && <div className="manage-field-error">{errors.confirm}</div>}
                </div>

                {(success || error) && (
                  <div className="manage-alerts">
                    {success && <span className="manage-alert success">{success}</span>}
                    {error && <span className="manage-alert error">{error}</span>}
                  </div>
                )}

                {missingHash && (
                  <div className="manage-hint">
                    Admin password is not configured. Set an initial password below.
                  </div>
                )}

                <div className="manage-card-actions">
                  <button
                    className="manage-btn primary"
                    type="button"
                    disabled={loading}
                    onClick={handleSubmit}
                  >
                    {loading
                      ? "Updating..."
                      : missingHash
                        ? "Set Initial Password"
                        : "Change Admin Password"}
                  </button>
                </div>
              </div>
            </div>

            <div className="manage-mini-card">
              <div className="manage-mini-card-title">Delete Password</div>
              <div className="manage-mini-card-body">
                <div className="manage-field">
                  <label className="manage-label">Current Delete Password</label>
                  <input
                    type="password"
                    className="manage-input"
                    value={deleteCurrent}
                    onChange={(e) => setDeleteCurrent(e.target.value)}
                    disabled={deleteLoading}
                  />
                  {deleteErrors.current && <div className="manage-field-error">{deleteErrors.current}</div>}
                </div>
                <div className="manage-field">
                  <label className="manage-label">New Delete Password</label>
                  <input
                    type="password"
                    className="manage-input"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    disabled={deleteLoading}
                  />
                  {deleteErrors.next && <div className="manage-field-error">{deleteErrors.next}</div>}
                </div>

                <div className="manage-field">
                  <label className="manage-label">Confirm Delete Password</label>
                  <input
                    type="password"
                    className="manage-input"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    disabled={deleteLoading}
                  />
                  {deleteErrors.confirm && <div className="manage-field-error">{deleteErrors.confirm}</div>}
                </div>

                {(deleteSuccess || deleteError) && (
                  <div className="manage-alerts">
                    {deleteSuccess && <span className="manage-alert success">{deleteSuccess}</span>}
                    {deleteError && <span className="manage-alert error">{deleteError}</span>}
                  </div>
                )}

                <div className="manage-card-actions">
                  <button
                    className="manage-btn primary"
                    type="button"
                    disabled={deleteLoading}
                    onClick={handleDeleteSubmit}
                  >
                    {deleteLoading ? "Updating..." : "Change Delete Password"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
