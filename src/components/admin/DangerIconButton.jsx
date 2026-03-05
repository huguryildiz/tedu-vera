// src/components/admin/DangerIconButton.jsx

import { TrashIcon } from "../../shared/Icons";

export default function DangerIconButton({
  ariaLabel,
  onClick,
  disabled = false,
  title,
  showLabel = false,
  danger = true,
}) {
  return (
    <button
      type="button"
      className={`manage-icon-btn${danger ? " danger" : ""}${showLabel ? " with-label" : ""}`}
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      <TrashIcon />
      {showLabel && <span className="manage-icon-btn-label">Delete</span>}
    </button>
  );
}
