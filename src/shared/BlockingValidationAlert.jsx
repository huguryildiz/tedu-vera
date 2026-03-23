// src/shared/BlockingValidationAlert.jsx
import AlertCard from "./AlertCard";

export default function BlockingValidationAlert({
  children,
  message,
  className = "",
  role = "alert",
}) {
  const content = children ?? message;
  if (!content) return null;

  return (
    <AlertCard variant="error" role={role} className={className}>
      {content}
    </AlertCard>
  );
}
