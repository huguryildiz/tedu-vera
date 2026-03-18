// src/components/admin/DangerIconButton.jsx

import { TrashIcon } from "../../shared/Icons";

export default function DangerIconButton({
  ariaLabel,
  onClick,
  disabled = false,
  title,
  showLabel = false,
  danger = true,
  Icon = TrashIcon,
  label = "Delete",
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
      <Icon />
      {showLabel && <span className="manage-icon-btn-label">{label}</span>}
    </button>
  );
}
