import { Archive, Icon } from "lucide-react";

export default function OrgStatusBadge({ status }) {
  if (status === "active") {
    return (
      <span className="badge badge-success">
        <Icon
          iconNode={[]}
          className="badge-ico"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </Icon>Active
      </span>
    );
  }
  if (status === "archived") {
    return (
      <span className="badge badge-neutral">
        <Archive size={11} strokeWidth={2.2} />Archived
      </span>
    );
  }
  return (
    <span className="badge badge-warning">
      {status ? String(status).charAt(0).toUpperCase() + String(status).slice(1) : "—"}
    </span>
  );
}
