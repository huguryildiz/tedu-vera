// src/auth/screens/CompleteProfileScreen.jsx
// Google OAuth finishing step: name + org only. No institution/department.

import { useState } from "react";
import FbAlert from "@/shared/ui/FbAlert";
import useShakeOnError from "@/shared/hooks/useShakeOnError";
import { UserPlus } from "lucide-react";

export default function CompleteProfileScreen({ user, onComplete, onSignOut }) {
  const [fullName, setFullName] = useState(user?.name || "");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submitBtnRef = useShakeOnError(error);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) return setError("Full name is required.");
    if (!orgName.trim()) return setError("Organization name is required.");
    setLoading(true);
    try {
      await onComplete({ name: fullName.trim(), orgName: orgName.trim() });
    } catch (err) {
      setError("Failed to complete profile. Please try again.");
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
              <UserPlus size={26} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div className="login-title">Create your workspace</div>
            <div className="login-sub">One last step: name your organization.</div>
          </div>

          {error && (<FbAlert variant="danger" style={{ marginBottom: 16 }}>{error}</FbAlert>)}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={user?.email || ""} disabled readOnly
                     style={{ opacity: 0.6, cursor: "not-allowed" }} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-name">Full Name</label>
              <input id="profile-name" className="form-input" type="text"
                     value={fullName} onChange={(e) => setFullName(e.target.value)}
                     placeholder="Your full name" autoFocus disabled={loading} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-org">Organization</label>
              <input id="profile-org" className="form-input" type="text"
                     value={orgName} onChange={(e) => setOrgName(e.target.value)}
                     placeholder="e.g., TED University — Electrical Engineering"
                     autoComplete="organization" disabled={loading} />
            </div>

            <button ref={submitBtnRef} type="submit" className="btn btn-primary"
                    disabled={loading} style={{ width: "100%" }}>
              {loading ? "Creating…" : "Create workspace"}
            </button>
          </form>
        </div>

        <div className="login-footer" style={{ display: "flex", justifyContent: "center" }}>
          <button type="button" onClick={onSignOut} className="form-link"
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "var(--text-tertiary)" }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
