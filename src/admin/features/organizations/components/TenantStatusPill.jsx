import { CheckCircle2, Clock, XCircle } from "lucide-react";

// Tenant (unlock request) status pill — distinct from `OrgStatusBadge` which
// is for organization lifecycle (active / archived). This one renders the
// approval state of a single unlock request: pending / approved / rejected.
export default function TenantStatusPill({ status }) {
  if (status === "approved") {
    return (
      <span className="sem-status sem-status-active" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <CheckCircle2 size={12} />
        Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="sem-status sem-status-locked" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <XCircle size={12} />
        Rejected
      </span>
    );
  }
  return (
    <span className="sem-status sem-status-draft" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Clock size={12} />
      Pending
    </span>
  );
}
