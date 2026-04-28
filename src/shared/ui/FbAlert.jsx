// src/shared/ui/FbAlert.jsx
// Reusable alert banner with automatic variant icon.
// Usage: <FbAlert variant="danger">Error message</FbAlert>
//        <FbAlert variant="info" title="Note">Detail text</FbAlert>

import "./FbAlert.css";
import { AlertCircle, AlertTriangle, Info, CheckCircle } from "lucide-react";

const ICONS = {
  danger:  AlertCircle,
  warning: AlertTriangle,
  info:    Info,
  success: CheckCircle,
};

export default function FbAlert({ variant = "danger", title, children, action, style, className, iconSize = 15, iconStyle, icon: IconOverride, "data-testid": dataTestId }) {
  const Icon = IconOverride || ICONS[variant] || AlertCircle;
  return (
    <div className={`fb-alert fba-${variant}${className ? ` ${className}` : ""}`} style={style} data-testid={dataTestId}>
      <div className="fb-alert-icon" style={iconStyle}>
        <Icon size={iconSize} strokeWidth={2} />
      </div>
      <div className="fb-alert-body">
        {title && <div className="fb-alert-title">{title}</div>}
        <div className="fb-alert-desc">{children}</div>
        {action && <div className="fb-alert-action">{action}</div>}
      </div>
    </div>
  );
}
