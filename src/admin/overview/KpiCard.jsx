// src/admin/overview/KpiCard.jsx
// KPI stat card — premium elevated style with colored icon backgrounds.

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

function ringColor(pct) {
  if (pct === 0) return "var(--color-muted-foreground)";
  if (pct <= 33) return "#f97316";
  if (pct <= 66) return "#eab308";
  if (pct < 100) return "#84cc16";
  return "#22c55e";
}

function ProgressRing({ pct, size = 44, strokeWidth = 4 }) {
  const color = ringColor(pct);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-primary/10" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-[stroke-dashoffset] duration-500 ease-out" />
    </svg>
  );
}

export default function KpiCard({
  value,
  label,
  sub,
  metaLines,
  ring,
  icon,
  iconClassName,
  tooltip,
  className,
}) {
  return (
    <Card
      className={cn(
        "stat-card relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        className
      )}
    >
      <CardContent className="flex flex-col gap-3 p-5">
        {/* Icon or ring */}
        {ring ? (
          <div className="stat-ring relative flex size-10 shrink-0 items-center justify-center">
            <ProgressRing pct={ring.pct} />
            <span className="absolute text-[11px] font-semibold tabular-nums">
              {ring.pct}%
            </span>
          </div>
        ) : icon ? (
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              iconClassName || "bg-primary/10 text-primary"
            )}
          >
            {icon}
          </div>
        ) : null}

        {/* Label */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground/40 hover:text-muted-foreground"
                  aria-label="More information"
                >
                  <Info className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Value */}
        <span className="text-3xl font-extrabold tracking-tight">
          {value}
        </span>

        {/* Sub text */}
        {sub && (
          <p className="text-sm text-muted-foreground">{sub}</p>
        )}

        {/* Meta lines */}
        {Array.isArray(metaLines) && metaLines.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {metaLines.map((line, i) => (
              <span key={line}>
                <span>{line}</span>
                {i < metaLines.length - 1 && " · "}
              </span>
            ))}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
