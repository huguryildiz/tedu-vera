// src/shared/AutoGrow.jsx
import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * A multiline textarea that automatically grows in height as content is added.
 * Also supports manual vertical resizing by the user.
 */
export default function AutoGrow({
  value,
  onChange,
  onBlur,
  disabled,
  placeholder,
  ariaLabel,
  hasError,
  className = "",
  rows = 3
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    // Reset height to auto to correctly calculate scrollHeight
    ref.current.style.height = "auto";
    // Set height to scrollHeight to wrap content
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm leading-relaxed text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15 disabled:bg-muted disabled:text-muted-foreground",
        hasError && "border-destructive",
        className
      )}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      style={{ resize: "vertical", minHeight: "72px" }}
    />
  );
}
