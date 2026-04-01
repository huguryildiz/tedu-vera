// src/jury/EvalHeader.jsx
// ============================================================
// Sticky header for EvalStep (4 rows):
//   Row 1: Juror identity + save status + Home button
//   Row 2: Group info card (collapsible)
//   Row 3: Prev · Dropdown · Next navigation
//   Row 4: Progress bar
// ============================================================

import { memo, useState, useEffect } from "react";
import { CRITERIA, APP_CONFIG } from "../config";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  HomeIcon,
  UserCheckIcon,
  LoaderIcon,
} from "../shared/Icons";
import { GroupLabel, ProjectTitle, StudentNames } from "../components/EntityMeta";
import { cn } from "../lib/utils";

// -- Save indicator -------------------------------------------
// The outer span is a stable live region so screen readers announce state changes.
// Without a stable container, replacing the entire element prevents aria-live from firing.
export function SaveIndicator({ saveStatus }) {
  return (
    <span role="status" aria-live="polite" aria-atomic="true">
      {saveStatus === "saving" && (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 [&_svg]:size-3.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
            <g className="animate-bounce">
              <path d="M12 13v8"/>
              <path d="m8 17 4-4 4 4"/>
            </g>
          </svg>
          Saving…
        </span>
      )}
      {saveStatus === "saved" && (
        <span className="inline-flex items-center gap-1 rounded-full border border-green-500/35 bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold text-green-700 [&_svg]:size-3.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m17 15-5.5 5.5L9 18"/>
            <path d="M5.516 16.07A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 3.501 7.327"/>
          </svg>
          Saved
        </span>
      )}
      {saveStatus !== "saving" && saveStatus !== "saved" && (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground [&_svg]:size-3.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
          </svg>
        </span>
      )}
    </span>
  );
}

// -- Progress gradient ----------------------------------------
function progressGradient(pct) {
  if (pct === 0)   return "#e2e8f0";
  if (pct <= 33)   return "#f97316";
  if (pct <= 66)   return "#eab308";
  if (pct < 100)   return "#84cc16";
  return "#22c55e";
}

// -- Group label for dropdown ---------------------------------
function groupLabel(p, scores, criteria) {
  const ppid   = p.project_id;
  const filled = criteria.reduce((acc, c) => {
    const v = scores[ppid]?.[c.id ?? c.key];
    return v === "" || v == null ? acc : acc + 1;
  }, 0);
  const total = criteria.length;
  const ratio = `(${filled}/${total})`;
  const name  = `Group ${p.group_no}`;
  if (filled === total && total > 0) return `\u2705 ${name} ${ratio}`;
  if (filled > 0)                    return `\u26a0\ufe0f ${name} ${ratio}`;
  return `${name} ${ratio}`;
}

// -- EvalHeader -----------------------------------------------
const EvalHeader = memo(function EvalHeader({
  juryName, affiliation,
  saveStatus,
  lockActive,
  onGoHome,
  onShowBackMenu,
  project,
  current,
  projects,
  scores,
  onNavigate,
  progressPct,
  headerCollapsed,
  criteria = CRITERIA,
}) {
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);

  // Reset group info panel when navigating to a new group
  useEffect(() => { setGroupInfoOpen(false); }, [current]);

  const studentList = project.members
    ? project.members.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const goPrev = () => { if (current > 0) onNavigate(current - 1); };
  const goNext = () => { if (current < projects.length - 1) onNavigate(current + 1); };

  return (
    <div className={cn(
      "sticky top-0 z-30 flex flex-col gap-2 rounded-t-2xl bg-card/95 backdrop-blur-sm border-b px-3 py-2 sm:px-4",
      headerCollapsed && "shadow-sm"
    )}>

      {/* Row 1: Juror identity + save status + Home button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex shrink-0 items-center text-primary [&_svg]:size-[18px]" aria-hidden="true"><UserCheckIcon /></span>
            <span className="truncate text-sm font-semibold text-foreground">{juryName}</span>
          </div>
          {affiliation && (
            <span className="truncate text-xs text-muted-foreground pl-[26px]">
              {affiliation}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="shrink-0">
            <SaveIndicator saveStatus={saveStatus} />
          </span>
          <span className="text-sm font-bold text-blue-200" aria-hidden="true">&middot;</span>
          <button
            className="flex size-[34px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 active:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700/15 [&_svg]:size-4"
            onClick={() => { lockActive ? onGoHome() : onShowBackMenu(); }}
            aria-label="Home"
          >
            <HomeIcon />
          </button>
        </div>
      </div>

      {/* Row 2: Group info card (collapsible) */}
      <div className={cn(
        "overflow-hidden transition-all duration-200",
        headerCollapsed && "max-h-0 opacity-0 pointer-events-none"
      )}>
        <div className={cn(
          "rounded-lg border bg-muted/50 p-2 sm:p-2.5"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="shrink-0">
                <GroupLabel text={`Group ${project.group_no}`} size={18} />
              </div>
              <button
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&_svg]:size-4"
                type="button"
                aria-expanded={groupInfoOpen}
                aria-label={groupInfoOpen ? "Collapse group details" : "Expand group details"}
                onClick={() => setGroupInfoOpen((v) => !v)}
              >
                <span className={cn("inline-flex transition-transform duration-200", groupInfoOpen && "rotate-180")}>
                  <ChevronDownIcon />
                </span>
              </button>
            </div>
          </div>
          <div className={cn(
            "grid transition-all duration-200",
            groupInfoOpen ? "grid-rows-[1fr] mt-2" : "grid-rows-[0fr] overflow-hidden"
          )}>
            <div className="min-h-0 overflow-hidden">
              {project.title && (
                <div className="flex items-start gap-1.5 text-sm text-muted-foreground py-0.5">
                  <ProjectTitle text={project.title} size={16} />
                </div>
              )}
              {APP_CONFIG.showStudents && studentList.length > 0 && (
                <div className="flex items-start gap-1.5 text-sm text-muted-foreground py-0.5">
                  <StudentNames names={studentList} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Prev · Dropdown · Next */}
      <div className="flex items-center gap-1.5">
        <button
          className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4"
          onClick={goPrev}
          disabled={current === 0}
          aria-label="Previous group"
        >
          <ChevronLeftIcon />
        </button>
        <div className="flex flex-1 items-center justify-center min-w-0">
          <select
            className="h-9 w-full min-w-0 cursor-pointer truncate rounded-md border border-input bg-background px-2 text-center text-sm font-medium text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring"
            value={current}
            onChange={(e) => onNavigate(Number(e.target.value))}
          >
            {projects.map((p, i) => (
              <option key={p.project_id} value={i}>{groupLabel(p, scores, criteria)}</option>
            ))}
          </select>
        </div>
        <button
          className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4"
          onClick={goNext}
          disabled={current === projects.length - 1}
          aria-label="Next group"
        >
          <ChevronRightIcon />
        </button>
      </div>

      {/* Row 4: Progress bar */}
      <div className="flex w-full items-center gap-2.5 pt-px">
        <span className="inline-flex shrink-0 items-center text-gray-500" aria-hidden="true">
          <LoaderIcon />
        </span>
        <div className="flex-1 min-w-0 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full transition-all duration-400"
            style={{ width: `${progressPct}%`, background: progressGradient(progressPct) }}
          />
        </div>
        <span className="min-w-[34px] shrink-0 text-right text-xs font-bold text-slate-600">{Math.round(progressPct)}%</span>
      </div>

    </div>
  );
});

export default EvalHeader;
