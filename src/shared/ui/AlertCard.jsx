import { TriangleAlert, CircleAlert, Info, CircleCheck } from "lucide-react";

const VARIANT_CONFIG = {
  warning: {
    icon: TriangleAlert,
    className: "alert-card--warning",
  },
  error: {
    icon: CircleAlert,
    className: "alert-card--error",
  },
  info: {
    icon: Info,
    className: "alert-card--info",
  },
  success: {
    icon: CircleCheck,
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
        <IconComponent size={16} strokeWidth={2} />
      </span>
      <div className="alert-card-content">
        {title && <div className="alert-card-title">{title}</div>}
        <div className="alert-card-text">{content}</div>
      </div>
    </div>
  );
}
