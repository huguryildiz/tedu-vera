// src/jury/EvalStep.jsx
// ============================================================
// Step 3 — Scoring form orchestrator.
//
// Owns UI state (showBackMenu, headerCollapsed, scrollRef).
// All score state and handlers come from useJuryState via props.
// Sub-components:
//   EvalHeader       — sticky 4-row header
//   GroupStatusPanel — status banners (synced / edit / lock / error)
//   ScoringGrid      — criterion inputs + comments + submit buttons
//
// Write strategy:
//   - Score onChange  → state only, no write
//   - Score onBlur    → clamp + writeGroup(pid)
//   - Comment onChange → state only, no write
//   - Comment onBlur  → writeGroup(pid)
//   - Navigation      → writeGroup(currentPid) then navigate
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { CRITERIA } from "../config";
import { isScoreFilled } from "./useJuryState";
import { HomeIcon, PencilIcon, InfoIcon } from "../shared/Icons";
import EvalHeader from "./EvalHeader";
import GroupStatusPanel from "./GroupStatusPanel";
import ScoringGrid from "./ScoringGrid";
import { cn } from "../lib/utils";

const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

export default function EvalStep({
  juryName, affiliation,
  projects,
  current, onNavigate,
  scores, comments, touched,
  groupSynced, editMode, lockActive,
  progressPct, allComplete,
  saveStatus,
  handleScore, handleScoreBlur,
  handleCommentChange, handleCommentBlur,
  handleFinalSubmit,
  onGoHome,
  criteria = CRITERIA,
  mudekLookup,
}) {
  const [showBackMenu,    setShowBackMenu]    = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const scrollRef = useRef(null);

  const project = projects[current];

  // Sticky header collapse on mobile scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (window.innerWidth > 1024) { setHeaderCollapsed(false); return; }
      const y = el.scrollTop;
      setHeaderCollapsed((prev) => {
        if (!prev && y > 80) return true;
        if (prev && y < 30) return false;
        return prev;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const onShowBackMenu = useCallback(() => setShowBackMenu(true), []);

  if (!project) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-[var(--screen-pad,16px)]">
        <div className="mx-auto max-w-3xl rounded-2xl bg-card shadow-lg overflow-hidden flex items-center justify-center min-h-[200px] text-sm text-muted-foreground">
          {projects.length === 0 ? "No projects found for this evaluation period." : "Loading\u2026"}
        </div>
      </div>
    );
  }

  const pid = project.project_id;

  const completedGroups = (projects || []).filter((p) =>
    criteria.every((c) => isScoreFilled(scores[p.project_id]?.[c.id ?? c.key]))
  ).length;
  const totalGroups = projects?.length || 0;

  const totalScore = criteria.reduce(
    (s, c) => s + (parseInt(scores[pid]?.[c.id ?? c.key], 10) || 0),
    0
  );

  return (
    <div
      className="flex min-h-dvh items-center justify-center p-[var(--screen-pad,16px)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) document.activeElement.blur();
      }}
    >
      <div className="mx-auto max-w-3xl w-full rounded-2xl bg-card shadow-lg overflow-hidden flex flex-col max-h-[calc(100dvh-var(--screen-pad,16px)*2-env(safe-area-inset-top)-env(safe-area-inset-bottom))]">
        <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth [&::-webkit-scrollbar]:w-[10px] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-[var(--scrollbar-track)] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb:hover]:bg-slate-400" ref={scrollRef}>

          <EvalHeader
            juryName={juryName}
            affiliation={affiliation}
            saveStatus={saveStatus}
            lockActive={lockActive}
            onGoHome={onGoHome}
            onShowBackMenu={onShowBackMenu}
            project={project}
            current={current}
            projects={projects}
            scores={scores}
            onNavigate={onNavigate}
            progressPct={progressPct}
            headerCollapsed={headerCollapsed}
            criteria={criteria}
          />

          <div className="flex flex-col gap-3 p-3 sm:p-4 lg:p-[18px_18px_24px]">
            {isDemoMode && (
              <div className="grid grid-cols-[auto_1fr] items-center gap-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500 p-3 text-sm font-medium text-white/90 shadow-[0_2px_8px_rgba(99,102,241,0.25),0_0_16px_rgba(139,92,246,0.2)]" style={{ margin: "0 0 12px" }}>
                <span className="inline-flex items-center justify-center [&_svg]:size-3.5 [&_svg]:stroke-white/70" aria-hidden="true"><InfoIcon /></span>
                <span>Demo mode — scores are saved to a sandbox database that resets daily.</span>
              </div>
            )}

            <GroupStatusPanel
              pid={pid}
              groupSynced={groupSynced}
              editMode={editMode}
              lockActive={lockActive}
              saveStatus={saveStatus}
              onRetry={handleCommentBlur}
            />
            <ScoringGrid
              pid={pid}
              scoresPid={scores[pid]}
              commentsPid={comments[pid]}
              touchedPid={touched[pid]}
              lockActive={lockActive}
              handleScore={handleScore}
              handleScoreBlur={handleScoreBlur}
              handleCommentChange={handleCommentChange}
              handleCommentBlur={handleCommentBlur}
              totalScore={totalScore}
              allComplete={allComplete}
              editMode={editMode}
              completedGroups={completedGroups}
              totalGroups={totalGroups}
              handleFinalSubmit={handleFinalSubmit}
              criteria={criteria}
              mudekLookup={mudekLookup}
            />
          </div>

        </div>
      </div>

      {/* -- Home confirmation overlay -- */}
      {showBackMenu && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-6"
          onClick={() => setShowBackMenu(false)}
        >
          <div
            className="flex w-[min(420px,96vw)] flex-col gap-2.5 rounded-[20px] bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="back-menu-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="m-0 mb-0.5 text-[17px] font-bold text-slate-900" id="back-menu-title">Leave this evaluation?</p>
            <p className="m-0 mb-1.5 text-[13px] text-slate-500">Your progress is saved. You can continue later.</p>
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3.5 text-[15px] font-semibold text-white hover:bg-blue-800 [&_svg]:size-4"
              onClick={() => setShowBackMenu(false)}
            >
              <PencilIcon />
              Continue Editing
            </button>
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-indigo-50 px-4 py-3.5 text-[15px] font-semibold text-[var(--brand-600)] hover:bg-indigo-100 hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700/30 [&_svg]:size-4"
              onClick={() => { setShowBackMenu(false); onGoHome(); }}
            >
              <HomeIcon />
              Return Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
