import { cn } from "@/shared/lib/utils";
import { TrashIcon } from "@/shared/ui/Icons";
import Tooltip from "@/shared/ui/Tooltip";

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
  const button = (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md p-1.5 text-sm transition-colors",
        danger
          ? "text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        showLabel && "px-2"
      )}
      aria-label={ariaLabel || title}
      onClick={onClick}
      disabled={disabled}
      >
      <Icon />
      {showLabel && <span className={labelClassName ? `text-xs ${labelClassName}` : "text-xs"}>{label}</span>}
    </button>
  );

  if (title && !showLabel) {
    return <Tooltip text={title}>{button}</Tooltip>;
  }

  return button;
}
