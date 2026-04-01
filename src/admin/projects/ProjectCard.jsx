// src/admin/projects/ProjectCard.jsx
// ============================================================
// Single project card used inside ManageProjectsPanel's list.
// ============================================================

import { CalendarClockIcon, FileTextIcon, PencilIcon, UsersLucideIcon } from "../../shared/Icons";
import DangerIconButton from "../../components/admin/DangerIconButton";
import Tooltip from "../../shared/Tooltip";
import LastActivity from "../LastActivity";
import { splitStudents, parseStudentInputList } from "./projectHelpers";

export default function ProjectCard({
  project: p,
  index: idx,
  periodName,
  isDemoMode = false,
  onMetaScroll,
  onEdit,
  onDelete,
}) {
  const students = splitStudents(p.members);
  const groupLabel = Number.isFinite(Number(p.group_no)) && Number(p.group_no) > 0
    ? Number(p.group_no)
    : idx + 1;
  const lastActivity = p.updated_at || p.updatedAt || null;

  return (
    <div key={p.id || `${p.group_no}-${p.title}`} className="flex flex-col items-stretch gap-1 rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="font-semibold text-foreground whitespace-nowrap overflow-x-auto scrollbar-none pr-4 relative">Group {groupLabel}</div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-full min-w-0">
          <span className="inline-flex items-center text-muted-foreground" aria-hidden="true"><FileTextIcon /></span>
          <span className="block max-w-full whitespace-nowrap overflow-x-auto scrollbar-none pr-4 relative touch-pan-x" onScroll={onMetaScroll}>{p.title || "\u2014"}</span>
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-full min-w-0">
          <span className="inline-flex items-center text-muted-foreground" aria-hidden="true"><UsersLucideIcon /></span>
          <span className="block max-w-full whitespace-nowrap overflow-x-auto scrollbar-none pr-4 relative touch-pan-x" onScroll={onMetaScroll}>
            {students.length
              ? students.map((name, sidx) => (
                <span key={`${p.id}-student-${sidx}`}>
                  <em className="italic">{name}</em>{sidx < students.length - 1 ? " \u00B7 " : ""}
                </span>
              ))
              : "\u2014"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center text-muted-foreground [&>svg]:size-3.5" aria-hidden="true">
            <CalendarClockIcon />
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{periodName || "\u2014"}</span>
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <LastActivity value={lastActivity} />
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 pt-2.5 border-t border-border/50">
          <Tooltip text="Edit group">
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 h-[34px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              type="button"
              aria-label={`Edit Group ${groupLabel}`}
              onClick={() => onEdit(p, groupLabel)}
            >
              <PencilIcon />
              <span className="text-xs font-semibold">Edit</span>
            </button>
          </Tooltip>
          <DangerIconButton
            ariaLabel={`Delete Group ${groupLabel}`}
            title="Delete group"
            showLabel={false}
            onClick={() => onDelete(p, groupLabel)}
          />
        </div>
      </div>
    </div>
  );
}
