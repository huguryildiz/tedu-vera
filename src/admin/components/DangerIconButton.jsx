import { TrashIcon } from "@/shared/ui/Icons";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";

export default function DangerIconButton({
  ariaLabel,
  onClick,
  disabled = false,
  title,
  showLabel = false,
  danger = true,
  Icon = TrashIcon,
  label = "Delete",
  labelClassName = "",
}) {
  const cls = [
    "vera-icon-btn",
    danger ? "vera-icon-btn--danger" : "vera-icon-btn--muted",
    showLabel && "vera-icon-btn--label",
  ].filter(Boolean).join(" ");

  const button = (
    <button
      type="button"
      className={cls}
      aria-label={ariaLabel || title}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon />
      {showLabel && <span className={labelClassName ? `text-xs ${labelClassName}` : "text-xs"}>{label}</span>}
    </button>
  );

  if (title && !showLabel) {
    return <PremiumTooltip text={title}>{button}</PremiumTooltip>;
  }

  return button;
}
