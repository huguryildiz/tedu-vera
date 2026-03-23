import {
  TriangleAlertLucideIcon,
  AlertCircleIcon,
  InfoIcon,
  CheckCircle2Icon
} from "./Icons";

const VARIANT_CONFIG = {
  warning: {
    icon: TriangleAlertLucideIcon,
    className: "alert-card--warning",
  },
  error: {
    icon: AlertCircleIcon,
    className: "alert-card--error",
  },
  info: {
    icon: InfoIcon,
    className: "alert-card--info",
  },
  success: {
    icon: CheckCircle2Icon,
    className: "alert-card--success",
  },
};

export default function AlertCard({
  variant = "info",
  title,
  message,
  children,
  icon: CustomIcon,
  className = "",
  role,
}) {
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.info;
  const IconComponent = CustomIcon || config.icon;
  const content = children ?? message;

  if (!content && !title) return null;

  // Determine an appropriate default ARIA role if not strictly provided
  const outputRole = role ?? (variant === "error" || variant === "warning" ? "alert" : "status");

  return (
    <div
      className={`alert-card ${config.className} ${className}`.trim()}
      role={outputRole}
    >
      <span className="alert-card-icon" aria-hidden="true">
        <IconComponent />
      </span>
      <div className="alert-card-content">
        {title && <div className="alert-card-title">{title}</div>}
        <div className="alert-card-text">{content}</div>
      </div>
    </div>
  );
}
