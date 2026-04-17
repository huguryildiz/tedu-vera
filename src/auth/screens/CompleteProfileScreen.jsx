// src/auth/CompleteProfileScreen.jsx — Phase 12
// First-time Google OAuth profile completion, using vera.css design tokens.
// Replaces src/components/auth/CompleteProfileForm.jsx.

import { useEffect, useState } from "react";
import FbAlert from "@/shared/ui/FbAlert";
import useShakeOnError from "@/shared/hooks/useShakeOnError";
import { listOrganizationsPublic } from "@/shared/api";
import GroupedCombobox from "@/shared/ui/GroupedCombobox";

import { Icon, Plus, Building2 } from "lucide-react";

export default function CompleteProfileScreen({ user, onComplete, onSignOut }) {
  const [fullName, setFullName] = useState(user?.name || "");
  const [university, setUniversity] = useState("");
  const [department, setDepartment] = useState("");
  const [orgName, setOrgName] = useState(user?.orgName || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submitBtnRef = useShakeOnError(error);

  // Org discovery state
  const [orgMode, setOrgMode] = useState("create");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [orgOptions, setOrgOptions] = useState([]);

  useEffect(() => {
    let active = true;
    listOrganizationsPublic()
      .then((orgs) => {
        if (!active) return;
        setOrgOptions(
          orgs.map((o) => ({
            value: o.id,
            label: o.name,
            group: o.institution || "Other",
          }))
        );
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) { setError("Full name is required."); return; }
    if (orgMode === "join") {
      if (!selectedOrgId) { setError("Please select an organization to join."); return; }
    } else {
      if (!orgName.trim()) { setError("Organization name is required."); return; }
    }
    setLoading(true);
    try {
      if (orgMode === "join") {
        await onComplete({ name: fullName.trim(), joinOrgId: selectedOrgId });
      } else {
        await onComplete({ name: fullName.trim(), orgName: orgName.trim(), institution: university.trim(), department: department.trim() });
      }
    } catch (err) {
      setError(String(err?.message || "Failed to complete profile. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div style={{ width: "420px", maxWidth: "92vw" }}>
        <div className="login-card">
          <div className="login-header">
            <div className="login-icon-wrap">
              <Icon
                iconNode={[]}
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </Icon>
            </div>
            <div className="login-title">Complete Your Profile</div>
            <div className="login-sub">Create your organization to start managing evaluation periods.</div>
          </div>

          {error && (
            <FbAlert variant="danger" style={{ marginBottom: "16px" }}>
              {error}
            </FbAlert>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                value={user?.email || ""}
                disabled
                style={{ opacity: 0.6, cursor: "not-allowed" }}
                readOnly
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-name">Full Name</label>
              <input
                id="profile-name"
                className="form-input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                autoFocus
                disabled={loading}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="profile-uni">University</label>
                <input
                  id="profile-uni"
                  className="form-input"
                  type="text"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="Your university"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="profile-dept">Department</label>
                <input
                  id="profile-dept"
                  className="form-input"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Your department"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Organization</label>
              <div className="reg-org-toggle">
                <button
                  type="button"
                  className={`reg-org-toggle-btn${orgMode === "create" ? " reg-org-toggle-btn--active" : ""}`}
                  onClick={() => { setOrgMode("create"); setSelectedOrgId(""); }}
                  disabled={loading}
                >
                  <Plus size={14} strokeWidth={2} />
                  Create New
                </button>
                <button
                  type="button"
                  className={`reg-org-toggle-btn${orgMode === "join" ? " reg-org-toggle-btn--active" : ""}`}
                  onClick={() => { setOrgMode("join"); setOrgName(""); }}
                  disabled={loading || orgOptions.length === 0}
                >
                  <Building2 size={14} strokeWidth={2} />
                  Join Existing
                </button>
              </div>

              {orgMode === "create" ? (
                <input
                  id="profile-org"
                  className="form-input"
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g., TED University — Electrical Engineering"
                  autoComplete="organization"
                  disabled={loading}
                />
              ) : (
                <GroupedCombobox
                  id="profile-org-join"
                  value={selectedOrgId}
                  onChange={setSelectedOrgId}
                  options={orgOptions}
                  placeholder="Search organizations…"
                  emptyMessage="No organizations found."
                  disabled={loading}
                  ariaLabel="Select organization to join"
                />
              )}
            </div>

            <button ref={submitBtnRef} type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%" }}>
              {loading
                ? (orgMode === "join" ? "Submitting…" : "Creating…")
                : (orgMode === "join" ? "Request to Join" : "Create Organization")}
            </button>
          </form>
        </div>

        <div className="login-footer" style={{ display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            onClick={onSignOut}
            className="form-link"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "12px", color: "var(--text-tertiary)" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
