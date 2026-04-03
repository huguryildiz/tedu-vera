// src/shared/CollapsibleEditorItem.jsx
// ============================================================
// Shared collapsible shell for dense admin editor rows/cards.
// Keeps the toggle separate from any drag or delete actions.
// ============================================================

import { useId } from "react";
import { cn } from "@/shared/lib/utils";
import { ChevronDownIcon, ChevronUpIcon } from "./Icons";

export default function CollapsibleEditorItem({
  open,
  onToggle,
  summaryLabel,
  summary,
  children,
  className = "",
  toolbar = null,
  toolbarClassName = "",
  summaryClassName = "",
  bodyClassName = "",
}) {
  const bodyId = useId();

  return (
    <div className={cn(
      "rounded-lg border bg-card",
      open ? "is-open" : "is-collapsed",
      className
    )}>
      {toolbar && (
        <div className={cn("flex items-center gap-2 px-3 py-2", toolbarClassName)}>
          {toolbar}
        </div>
      )}
      <button
        type="button"
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-muted-foreground",
          summaryClassName
        )}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        aria-label={summaryLabel}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {summary}
        </div>
        <span className="flex-shrink-0" aria-hidden="true">
          {open ? (
            <ChevronUpIcon className="size-3.5 text-muted-foreground transition-transform" />
          ) : (
            <ChevronDownIcon className="size-3.5 text-muted-foreground transition-transform" />
          )}
        </span>
      </button>
      {open && (
        <div
          id={bodyId}
          className={cn("flex flex-col gap-1.5 px-3 pb-3", bodyClassName)}
        >
          {children}
        </div>
      )}
    </div>
  );
}
