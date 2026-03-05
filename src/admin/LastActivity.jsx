// src/admin/LastActivity.jsx

import { HistoryIcon } from "../shared/Icons";
import { formatTs } from "./utils";

export default function LastActivity({ value, className = "" }) {
  if (!value) return null;
  const label = formatTs(value);
  if (!label || label === "—") return null;
  const classes = ["manage-last-activity", className].filter(Boolean).join(" ");
  return (
    <div className={classes} title={label} aria-label={`Last activity ${label}`}>
      <span className="manage-last-activity-icon" aria-hidden="true">
        <HistoryIcon />
      </span>
      <span className="manage-last-activity-text">{label}</span>
    </div>
  );
}
