// src/admin/layout/AdminHeader.jsx
// ============================================================
// Content-area header bar for the admin panel.
// Sits at the top of SidebarInset — provides page title,
// semester selector, refresh control, and demo banner.
// ============================================================

import { useCallback, useMemo } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, FlaskConical, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────────

/**
 * Formats a Date into a locale time string for the "last refreshed" label.
 * Returns null when no date is provided.
 */
function formatRefreshTime(date) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

// ── Demo Banner ──────────────────────────────────────────────

function DemoBanner() {
  return (
    <div
      className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      role="status"
    >
      <FlaskConical className="size-3.5 shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-semibold">Demo Mode</strong>
        <span className="mx-1.5">&middot;</span>
        Sample data, resets daily
      </span>
    </div>
  );
}

// ── Semester Selector ────────────────────────────────────────

function SemesterSelector({
  semesterList,
  sortedSemesters,
  selectedSemesterId,
  selectedSemesterName,
  onSemesterChange,
  onFetchData,
}) {
  const semesters = sortedSemesters || semesterList || [];

  const handleChange = useCallback(
    (e) => {
      const id = e.target.value;
      onSemesterChange?.(id);
      onFetchData?.(id);
    },
    [onSemesterChange, onFetchData],
  );

  if (semesters.length === 0) return null;

  return (
    <div className="relative inline-flex items-center">
      <select
        value={selectedSemesterId || ""}
        onChange={handleChange}
        aria-label="Select semester"
        className={cn(
          "h-8 cursor-pointer appearance-none rounded-md border border-border bg-background py-1 pl-3 pr-8 text-sm font-medium text-foreground shadow-sm transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
      >
        {semesters.map((s) => (
          <option key={s.id} value={s.id}>
            {s.semester_name || s.name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

/**
 * @param {object}   props
 * @param {string}   props.title                  — Page title (e.g. "Overview")
 * @param {string}   [props.subtitle]             — Optional subtitle (e.g. "Spring 2026 · EE 491/492")
 * @param {boolean}  [props.loading=false]         — Whether data is currently loading
 * @param {Date}     [props.lastRefresh]           — Timestamp of the last data refresh
 * @param {function} [props.onRefresh]             — Callback to trigger a data refresh
 * @param {boolean}  [props.isDemoMode=false]      — Show demo banner
 * @param {Array}    [props.semesterList]           — Full semester list
 * @param {Array}    [props.sortedSemesters]        — Sorted semester list (preferred for display)
 * @param {string}   [props.selectedSemesterId]     — Currently selected semester ID
 * @param {string}   [props.selectedSemesterName]   — Currently selected semester display name
 * @param {function} [props.onSemesterChange]       — Callback when semester selection changes
 * @param {function} [props.onFetchData]            — Callback to fetch data for a semester
 */
export function AdminHeader({
  title,
  subtitle,
  loading = false,
  lastRefresh,
  onRefresh,
  isDemoMode = false,
  semesterList,
  sortedSemesters,
  selectedSemesterId,
  selectedSemesterName,
  onSemesterChange,
  onFetchData,
}) {
  const refreshLabel = useMemo(
    () => formatRefreshTime(lastRefresh),
    [lastRefresh],
  );

  const hasSemesters =
    (sortedSemesters && sortedSemesters.length > 0) ||
    (semesterList && semesterList.length > 0);

  return (
    <>
      {/* Demo banner — rendered above the header bar */}
      {isDemoMode && <DemoBanner />}

      {/* Header bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6 py-3">
        {/* Left side — sidebar trigger + title */}
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1.5" />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-baseline gap-2">
            <h1 className="text-base font-semibold leading-tight text-foreground">
              {title}
            </h1>
            {subtitle && (
              <span className="text-sm text-muted-foreground">{subtitle}</span>
            )}
          </div>
        </div>

        {/* Right side — semester selector + refresh */}
        <div className="ml-auto flex items-center gap-2">
          {hasSemesters && (
            <SemesterSelector
              semesterList={semesterList}
              sortedSemesters={sortedSemesters}
              selectedSemesterId={selectedSemesterId}
              selectedSemesterName={selectedSemesterName}
              onSemesterChange={onSemesterChange}
              onFetchData={onFetchData}
            />
          )}

          {onRefresh && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onRefresh}
                disabled={loading}
                aria-label="Refresh data"
                title="Refresh"
              >
                <RefreshCw
                  className={cn("size-4", loading && "animate-spin")}
                />
              </Button>

              {refreshLabel && (
                <span
                  className="hidden text-xs text-muted-foreground sm:inline"
                  title={lastRefresh?.toLocaleString()}
                >
                  {refreshLabel}
                </span>
              )}
            </>
          )}
        </div>
      </header>
    </>
  );
}
