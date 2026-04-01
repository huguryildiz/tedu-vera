// src/jury/DoneStep.jsx
// ============================================================
// Step 4 — Confirmation / thank-you screen.
// Shows the submitted scores per group.
// Receives `projects` as a prop (dynamic from DB).
// ============================================================

import { useMemo, useState } from "react";
import { CRITERIA } from "../config";
import { HomeIcon, ChevronDownIcon, PencilIcon, HistoryIcon, InfoIcon } from "../shared/Icons";
import { Pencil, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";

const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
import { normalizeCriterion } from "../shared/criteriaHelpers";
import { getCellState, getPartialTotal, jurorStatusMeta } from "../admin/scoreHelpers";
import { GroupLabel, ProjectTitle, StudentNames } from "../components/EntityMeta";
import { formatTs as formatShortTs } from "../admin/utils";

function groupTimestamp(project) {
  const ts = project?.updated_at || "";
  if (!ts) return "—";
  return formatShortTs(ts);
}

export default function DoneStep({
  juryName,
  doneScores,
  scores,
  projects,
  onBack,
  onEditScores,
  criteria: criteriaProp,
}) {
  const criteria = (criteriaProp || CRITERIA).map(normalizeCriterion);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const isEditMode = Boolean(onEditScores);
  const prefersReducedMotion = useMemo(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
  const displayScores = isEditMode ? (scores || {}) : (doneScores || scores || {});
  const titleText = isEditMode
    ? "Edit mode is enabled"
    : `Thank You${juryName ? `, ${juryName}` : ""}!`;
  const subtitleText = isEditMode
    ? "You can update scores and re-submit when you're done."
    : "Your evaluations have been submitted. Contact the administrator if you need changes.";
  const headerIcon = isEditMode ? (
    <Pencil strokeWidth={2} />
  ) : (
    <PartyPopper strokeWidth={2} />
  );

  function toggleGroup(pid) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  }

  return (
    <div className="flex min-h-dvh items-start justify-center p-4 pt-6 sm:items-center sm:pt-4">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-3.5 rounded-2xl bg-card p-5 shadow-lg sm:p-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-2.5 text-center">
          <div className={cn("flex size-12 items-center justify-center rounded-xl [&_svg]:size-[60%]", isEditMode ? "bg-amber-100 text-amber-600" : "confetti-icon relative bg-indigo-50 text-indigo-600")} aria-hidden="true">
            {!isEditMode && !prefersReducedMotion && <span className="confetti-burst confetti-a" />}
            {!isEditMode && !prefersReducedMotion && <span className="confetti-burst confetti-b" />}
            {!isEditMode && !prefersReducedMotion && <span className="confetti-burst confetti-c" />}
            {!isEditMode && !prefersReducedMotion && <span className="confetti-burst confetti-d" />}
            {headerIcon}
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{titleText}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground text-balance">
            <span>{subtitleText}</span>
          </p>
        </div>

        {isDemoMode && (
          <div className="flex items-center gap-2.5 rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 px-3.5 py-2.5 text-sm font-medium text-white/90 shadow-md [&_svg]:size-3.5">
            <span className="inline-flex shrink-0 items-center" aria-hidden="true"><InfoIcon /></span>
            <span>This was a demo evaluation. In production, scores are final and visible to admins.</span>
          </div>
        )}

        {/* Score summary list */}
        <div className="done-summary flex-1 overflow-y-auto rounded-lg bg-muted/50 p-2">
          {(projects || []).map((p) => {
            const pid        = p.project_id;
            const isExpanded = expandedGroups.has(pid);
            const panelId    = `done-group-panel-${pid}`;
            const criteriaValues = displayScores[pid] || {};
            const allFilled = criteria.every((c) => {
              const v = criteriaValues[c.id ?? c.key];
              return v !== null && v !== undefined && String(v).trim() !== "";
            });
            const totalScore = getPartialTotal(displayScores[pid] || {}, criteria);
            const rowEntry = {
              ...criteriaValues,
              total: allFilled ? totalScore : null,
            };
            const scoreState = getCellState(rowEntry);
            const stateMeta = jurorStatusMeta[scoreState] ?? jurorStatusMeta.empty;
            const StatusIcon = stateMeta.icon;
            const shownScore =
              scoreState === "scored"
                ? totalScore
                : scoreState === "partial"
                  ? getPartialTotal(rowEntry)
                  : "—";
            const timestamp = groupTimestamp(p);
            const studentList = p.members
              ? p.members.split(",").map((s) => s.trim()).filter(Boolean)
              : [];
            const hasDetails = Boolean(p.title) || studentList.length > 0;

            return (
              <div key={pid} className="flex flex-col border-b border-border/40 last:border-b-0">
                <div className="grid min-h-[44px] items-center gap-x-2 px-2 py-1.5">
                  <button
                    className="flex min-w-0 items-center"
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    onClick={() => { if (hasDetails) toggleGroup(pid); }}
                    style={{ cursor: hasDetails ? "pointer" : "default" }}
                  >
                    <div className="inline-flex min-w-0 items-center gap-1.5">
                      <span className="inline-flex min-w-0 items-center gap-1 font-semibold text-foreground">
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <GroupLabel text={`Group ${p.group_no}`} shortText={`Group ${p.group_no}`} />
                        </span>
                        {hasDetails && (
                          <span className={cn("inline-flex shrink-0 items-center text-muted-foreground transition-transform duration-200", isExpanded && "rotate-180 text-foreground")}>
                            <ChevronDownIcon />
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                  <span className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground tabular-nums" title={timestamp}>
                    <span className="[&_svg]:size-3" aria-hidden="true"><HistoryIcon /></span>
                    <span className="whitespace-nowrap text-right">{timestamp}</span>
                  </span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap justify-self-end", stateMeta.colorClass)}>
                    <StatusIcon />
                    {stateMeta.label}
                  </span>
                  <span className={cn("text-right font-mono text-sm font-bold tabular-nums min-w-[2ch] justify-self-end", scoreState === "scored" && "text-emerald-600", scoreState === "partial" && "text-amber-600", scoreState === "empty" && "text-muted-foreground")}>{String(shownScore)}</span>
                </div>

                {hasDetails && (
                  <div id={panelId} className={cn("grid transition-[grid-template-rows,opacity] duration-200", isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                    <div className="overflow-hidden mt-0.5 grid gap-1">
                      {p.title && (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <ProjectTitle text={p.title} />
                        </div>
                      )}
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <StudentNames names={studentList} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
          {onEditScores && (
            <button className="done-edit-glow inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 sm:h-11" onClick={onEditScores} type="button">
              <PencilIcon />
              Edit My Scores
            </button>
          )}
          <button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:h-11" onClick={onBack} type="button">
            <HomeIcon /> Return Home
          </button>
        </div>
      </div>
    </div>
  );
}
