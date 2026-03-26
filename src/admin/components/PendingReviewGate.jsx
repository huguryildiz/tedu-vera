// src/admin/components/PendingReviewGate.jsx
// ============================================================
// Phase C.4: Full-screen "pending approval" message shown to
// authenticated users who have no approved tenant membership.
// ============================================================

import { useEffect, useState } from "react";
import { AlertCircleIcon, HomeIcon } from "../../shared/Icons";
import { getMyApplications } from "../../shared/api";

export default function PendingReviewGate({ user, onSignOut, onBack }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getMyApplications()
      .then((data) => { if (active) setApplications(data || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const pending = applications.filter((a) => a.status === "pending");
  const rejected = applications.filter((a) => a.status === "rejected");

  return (
    <div className="pending-gate">
      <div className="pending-gate-card">
        <AlertCircleIcon size={48} />
        <h2>Application Pending</h2>
        <p>
          Your account <strong>{user?.email}</strong> is not yet approved
          for admin access.
        </p>

        {!loading && pending.length > 0 && (
          <div className="pending-gate-apps">
            <h3>Pending Applications</h3>
            {pending.map((app) => (
              <div key={app.id} className="pending-gate-app">
                <span className="pending-gate-tenant">{app.tenant_name}</span>
                <span className="pending-gate-status pending">Pending review</span>
              </div>
            ))}
          </div>
        )}

        {!loading && rejected.length > 0 && (
          <div className="pending-gate-apps">
            <h3>Rejected Applications</h3>
            {rejected.map((app) => (
              <div key={app.id} className="pending-gate-app">
                <span className="pending-gate-tenant">{app.tenant_name}</span>
                <span className="pending-gate-status rejected">Not approved</span>
              </div>
            ))}
          </div>
        )}

        <div className="pending-gate-actions">
          <button onClick={onBack} className="admin-auth-submit" style={{ maxWidth: 200 }}>
            <span aria-hidden="true"><HomeIcon /></span>
            Return Home
          </button>
          <button onClick={onSignOut} className="admin-auth-home-link pending-gate-signout">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
