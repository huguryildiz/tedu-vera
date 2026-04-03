// src/admin/LastActivity.jsx

import { cn } from "@/shared/lib/utils";
import { HistoryIcon } from "@/shared/ui/Icons";
import { formatTs } from "./utils";

export default function LastActivity({ value, className = "" }) {
  if (!value) return null;
  const label = formatTs(value);
  if (!label || label === "—") return null;
  return (
    <div className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground", className)} title={label} aria-label={`Last activity ${label}`}>
      <span className="inline-flex items-center justify-center [&>svg]:size-3.5" aria-hidden="true">
        <HistoryIcon />
      </span>
      <span className="leading-tight">{label}</span>
    </div>
  );
}
