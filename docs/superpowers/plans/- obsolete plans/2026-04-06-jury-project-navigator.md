# Jury Project Navigator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the jury scoring screen's linear prev/next navigation with a segmented progress bar and a tappable project drawer so jurors can see per-project completion status at a glance and jump to any project directly.

**Architecture:** Add a `getProjectStatus` pure helper to `scoreState.js`, create two new components (`SegmentedBar`, `ProjectDrawer`) consumed by `EvalStep.jsx`, and update the group bar to replace prev/next arrows with a chevron-down dropdown trigger. All data already flows through `useJuryState` — no hook or state model changes needed.

**Tech Stack:** React, Lucide icons, existing CSS patterns in `jury.css`

**Reference mockup:** `docs/concepts/jury-project-navigator.html`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/jury/utils/scoreState.js` | Modify | Add `getProjectStatus` + `countFilledForProject` helpers |
| `src/jury/__tests__/scoreState.regression.test.js` | Modify | Add tests for new helpers |
| `src/test/qa-catalog.json` | Modify | Add new test IDs |
| `src/jury/components/SegmentedBar.jsx` | Create | Segmented progress bar component |
| `src/jury/components/ProjectDrawer.jsx` | Create | Bottom sheet drawer with project list |
| `src/jury/steps/EvalStep.jsx` | Modify | Wire new components, remove prev/next nav |
| `src/styles/jury.css` | Modify | Add segmented bar + drawer styles |

---

### Task 1: Add `getProjectStatus` helper to scoreState

**Files:**
- Modify: `src/jury/utils/scoreState.js`
- Modify: `src/jury/__tests__/scoreState.regression.test.js`
- Modify: `src/test/qa-catalog.json`

- [ ] **Step 1: Add test IDs to qa-catalog.json**

Append these two entries to the end of the array (before the closing `]`):

```json
  {
    "id": "scorestate.status.01",
    "module": "Jury / Scoring",
    "area": "scoreState helpers",
    "story": "Project status derivation",
    "scenario": "returns correct status for scored, partial, and empty projects",
    "whyItMatters": "Segmented bar and drawer both depend on accurate per-project status classification.",
    "risk": "Wrong status would mislead jurors about their progress.",
    "coverageStrength": "High",
    "severity": "critical"
  },
  {
    "id": "scorestate.status.02",
    "module": "Jury / Scoring",
    "area": "scoreState helpers",
    "story": "Filled count per project",
    "scenario": "counts filled criteria for a single project correctly",
    "whyItMatters": "Drawer status badge shows N/M filled — must be accurate.",
    "risk": "Wrong count would show incorrect progress in drawer items.",
    "coverageStrength": "High",
    "severity": "critical"
  }
```

- [ ] **Step 2: Write failing tests**

Add this describe block at the end of `src/jury/__tests__/scoreState.regression.test.js`:

```js
import {
  isAllFilled,
  isAllComplete,
  countFilled,
  makeEmptyScores,
  getProjectStatus,
  countFilledForProject,
} from "../utils/scoreState";

// ... (keep existing fixtures CUSTOM_CRITERIA and PROJECTS) ...

describe("scoreState — project status helpers", () => {
  qaTest("scorestate.status.01", () => {
    const scores = makeEmptyScores(PROJECTS, CUSTOM_CRITERIA);

    // Empty project → "empty"
    expect(getProjectStatus(scores, "p1", CUSTOM_CRITERIA)).toBe("empty");

    // Fill one criterion → "partial"
    scores.p1.design = 30;
    expect(getProjectStatus(scores, "p1", CUSTOM_CRITERIA)).toBe("partial");

    // Fill all criteria → "scored"
    scores.p1.innovation = 20;
    scores.p1.impact = 25;
    expect(getProjectStatus(scores, "p1", CUSTOM_CRITERIA)).toBe("scored");

    // Other project still empty
    expect(getProjectStatus(scores, "p2", CUSTOM_CRITERIA)).toBe("empty");
  });

  qaTest("scorestate.status.02", () => {
    const scores = makeEmptyScores(PROJECTS, CUSTOM_CRITERIA);

    expect(countFilledForProject(scores, "p1", CUSTOM_CRITERIA)).toBe(0);

    scores.p1.design = 30;
    expect(countFilledForProject(scores, "p1", CUSTOM_CRITERIA)).toBe(1);

    scores.p1.innovation = 20;
    scores.p1.impact = 25;
    expect(countFilledForProject(scores, "p1", CUSTOM_CRITERIA)).toBe(3);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- --run src/jury/__tests__/scoreState.regression.test.js`
Expected: FAIL — `getProjectStatus` and `countFilledForProject` are not exported.

- [ ] **Step 4: Implement the helpers**

Add to the end of `src/jury/utils/scoreState.js`, before the closing of the file, after `makeAllTouched`:

```js
// ── Per-project status helpers ───────────────────────────

export const countFilledForProject = (scores, pid, criteria) =>
  criteria.reduce(
    (n, c) => n + (isScoreFilled(scores[pid]?.[_id(c)]) ? 1 : 0),
    0
  );

export const getProjectStatus = (scores, pid, criteria) => {
  const filled = countFilledForProject(scores, pid, criteria);
  if (filled === 0) return "empty";
  if (filled === criteria.length) return "scored";
  return "partial";
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --run src/jury/__tests__/scoreState.regression.test.js`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/jury/utils/scoreState.js src/jury/__tests__/scoreState.regression.test.js src/test/qa-catalog.json
git commit -m "feat(jury): add getProjectStatus + countFilledForProject helpers"
```

---

### Task 2: Add CSS styles for segmented bar and project drawer

**Files:**
- Modify: `src/styles/jury.css`

- [ ] **Step 1: Add segmented bar styles**

Insert after the `.dj-fh-progress-pct` rule (around line 1911) in `src/styles/jury.css`:

```css
/* ── Segmented Progress Bar ── */
.dj-seg-bar{display:flex;gap:2px;margin-bottom:4px}
.dj-seg{flex:1;height:5px;border-radius:3px;transition:all .3s;cursor:pointer}
.dj-seg:hover{opacity:0.8;transform:scaleY(1.4)}
.dj-seg.scored{background:#22c55e}
.dj-seg.partial{background:#f59e0b}
.dj-seg.empty{background:rgba(148,163,184,0.12)}
.dj-seg.active{background:#3b82f6;height:7px;margin-top:-1px;border-radius:4px;box-shadow:0 0 8px rgba(59,130,246,0.3)}
.dj-seg-legend{display:flex;justify-content:space-between;padding:0 2px}
.dj-seg-legend-item{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;display:flex;align-items:center;gap:3px}
.dj-seg-legend-dot{width:6px;height:6px;border-radius:2px}
```

- [ ] **Step 2: Add drawer styles**

Insert after the segmented bar styles:

```css
/* ── Project Drawer ── */
.dj-drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);z-index:100;display:flex;flex-direction:column;justify-content:flex-end}
.dj-drawer-sheet{background:linear-gradient(180deg,#161a24,#111520);border-top:1px solid rgba(148,163,184,0.1);border-radius:20px 20px 0 0;max-height:80vh;display:flex;flex-direction:column;animation:dj-drawer-up .25s ease-out}
@keyframes dj-drawer-up{from{transform:translateY(100%)}to{transform:translateY(0)}}
.dj-drawer-handle{width:36px;height:4px;background:#334155;border-radius:99px;margin:10px auto 0}
.dj-drawer-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 10px;border-bottom:1px solid rgba(148,163,184,0.08)}
.dj-drawer-title{font-size:14px;font-weight:800;color:#e2e8f0}
.dj-drawer-close{width:28px;height:28px;border-radius:8px;border:1px solid rgba(148,163,184,0.1);background:rgba(30,41,59,0.4);color:#94a3b8;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;font-weight:600}
.dj-drawer-close:hover{background:rgba(239,68,68,0.1);color:#ef4444;border-color:rgba(239,68,68,0.2)}
.dj-drawer-summary{display:flex;gap:12px;padding:8px 16px 10px;border-bottom:1px solid rgba(148,163,184,0.06)}
.dj-drawer-stat{font-size:10px;font-weight:600;display:flex;align-items:center;gap:4px}
.dj-drawer-stat-dot{width:7px;height:7px;border-radius:3px}
.dj-drawer-list{flex:1;overflow-y:auto;padding:6px 10px 16px}
.dj-drawer-item{display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;cursor:pointer;transition:background .1s;margin-bottom:2px;border-left:3px solid transparent}
.dj-drawer-item:hover{background:rgba(148,163,184,0.04)}
.dj-drawer-item.active{background:rgba(59,130,246,0.08);border-left-color:#3b82f6}
.dj-drawer-p-badge{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:0.3px;color:#3b82f6;flex-shrink:0;min-width:28px}
.dj-drawer-item-info{flex:1;min-width:0}
.dj-drawer-item-name{font-size:11px;font-weight:600;color:#c8cdd6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px}
.dj-drawer-item-members{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.dj-drawer-item-members .team-member-avatar{width:16px;height:16px;font-size:7px}
.dj-drawer-item-members .team-member-name{font-size:9px;color:#64748b}
.dj-drawer-item-status{font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;flex-shrink:0;white-space:nowrap}
.dj-drawer-item-status.scored{background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.15)}
.dj-drawer-item-status.partial{background:rgba(245,158,11,0.1);color:#f59e0b;border:1px solid rgba(245,158,11,0.15)}
.dj-drawer-item-status.empty{background:rgba(148,163,184,0.06);color:#64748b;border:1px solid rgba(148,163,184,0.08)}
```

- [ ] **Step 3: Add group bar chevron style**

Add after the existing `.dj-group-bar-num` rule (line 1896):

```css
.dj-group-bar-chevron{color:#475569;display:flex;align-items:center;flex-shrink:0;transition:color .15s}
.dj-group-bar:hover .dj-group-bar-chevron{color:#94a3b8}
.dj-group-bar-right{display:flex;align-items:center;gap:6px;flex-shrink:0}
```

- [ ] **Step 4: Add light mode overrides**

Add near the existing light-mode group-bar overrides (around line 1348):

```css
body:not(.dark-mode) .dj-seg.empty{background:rgba(0,0,0,0.06) !important}
body:not(.dark-mode) .dj-seg.active{background:#3b82f6 !important}
body:not(.dark-mode) .dj-drawer-sheet{background:linear-gradient(180deg,#f8fafc,#f1f5f9) !important;border-top-color:rgba(0,0,0,0.08) !important}
body:not(.dark-mode) .dj-drawer-header{border-bottom-color:rgba(0,0,0,0.06) !important}
body:not(.dark-mode) .dj-drawer-title{color:#0f172a !important}
body:not(.dark-mode) .dj-drawer-close{background:rgba(248,250,252,0.9) !important;border-color:#e2e8f0 !important;color:#475569 !important}
body:not(.dark-mode) .dj-drawer-summary{border-bottom-color:rgba(0,0,0,0.04) !important}
body:not(.dark-mode) .dj-drawer-item:hover{background:rgba(0,0,0,0.02) !important}
body:not(.dark-mode) .dj-drawer-item.active{background:rgba(59,130,246,0.06) !important}
body:not(.dark-mode) .dj-drawer-p-badge{color:var(--accent) !important}
body:not(.dark-mode) .dj-drawer-item-name{color:#1e293b !important}
body:not(.dark-mode) .dj-drawer-item-members .team-member-name{color:#64748b !important}
body:not(.dark-mode) .dj-drawer-handle{background:#cbd5e1 !important}
```

- [ ] **Step 5: Add portrait media query overrides**

Add inside the existing `@media (max-width: 430px) and (orientation: portrait)` block (around line 2846 area):

```css
  /* Segmented bar — portrait */
  .dj-seg{height:4px;border-radius:2px}
  .dj-seg.active{height:6px}
  .dj-seg-legend-item{font-size:7.5px}

  /* Drawer — portrait */
  .dj-drawer-item{padding:8px}
  .dj-drawer-item-name{font-size:10.5px}
  .dj-drawer-p-badge{font-size:10px}
```

- [ ] **Step 6: Commit**

```bash
git add src/styles/jury.css
git commit -m "feat(css): add segmented bar + project drawer styles"
```

---

### Task 3: Create SegmentedBar component

**Files:**
- Create: `src/jury/components/SegmentedBar.jsx`

- [ ] **Step 1: Create the component**

Create `src/jury/components/SegmentedBar.jsx`:

```jsx
// src/jury/components/SegmentedBar.jsx
// Segmented progress bar — one segment per project, color-coded by status.
import { getProjectStatus } from "../utils/scoreState";

export default function SegmentedBar({ projects, scores, criteria, current, onNavigate }) {
  if (!projects.length) return null;

  let scoredCount = 0;
  let partialCount = 0;
  let emptyCount = 0;

  const statuses = projects.map((p, i) => {
    const status = i === current ? "active" : getProjectStatus(scores, p.project_id, criteria);
    if (status === "active") {
      // Count the underlying status for legend
      const realStatus = getProjectStatus(scores, p.project_id, criteria);
      if (realStatus === "scored") scoredCount++;
      else if (realStatus === "partial") partialCount++;
      else emptyCount++;
    } else if (status === "scored") scoredCount++;
    else if (status === "partial") partialCount++;
    else emptyCount++;
    return status;
  });

  return (
    <div className="dj-seg-progress-row" style={{ padding: "1px 0 4px", marginBottom: 4 }}>
      <div className="dj-seg-bar">
        {statuses.map((status, i) => (
          <div
            key={projects[i].project_id}
            className={`dj-seg ${status}`}
            title={`P${i + 1} — ${projects[i].title}`}
            onClick={() => onNavigate(i)}
          />
        ))}
      </div>
      <div className="dj-seg-legend">
        <span className="dj-seg-legend-item" style={{ color: "#22c55e" }}>
          <span className="dj-seg-legend-dot" style={{ background: "#22c55e" }} />
          {scoredCount} scored
        </span>
        <span className="dj-seg-legend-item" style={{ color: "#f59e0b" }}>
          <span className="dj-seg-legend-dot" style={{ background: "#f59e0b" }} />
          {partialCount} partial
        </span>
        <span className="dj-seg-legend-item" style={{ color: "#64748b" }}>
          <span className="dj-seg-legend-dot" style={{ background: "#475569" }} />
          {emptyCount} empty
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/jury/components/SegmentedBar.jsx
git commit -m "feat(jury): add SegmentedBar component"
```

---

### Task 4: Create ProjectDrawer component

**Files:**
- Create: `src/jury/components/ProjectDrawer.jsx`

- [ ] **Step 1: Create the component**

Create `src/jury/components/ProjectDrawer.jsx`:

```jsx
// src/jury/components/ProjectDrawer.jsx
// Bottom sheet listing all projects with status badges and avatar chips.
import { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { TeamMembersInline } from "@/shared/ui/EntityMeta";
import { getProjectStatus, countFilledForProject } from "../utils/scoreState";

export default function ProjectDrawer({ open, onClose, projects, scores, criteria, current, onNavigate }) {
  const listRef = useRef(null);

  // Scroll active item into view on open
  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector(".dj-drawer-item.active");
    if (active) {
      requestAnimationFrame(() => active.scrollIntoView({ block: "center", behavior: "smooth" }));
    }
  }, [open, current]);

  // Close on Escape
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  let scoredCount = 0;
  let partialCount = 0;
  let emptyCount = 0;
  projects.forEach((p) => {
    const s = getProjectStatus(scores, p.project_id, criteria);
    if (s === "scored") scoredCount++;
    else if (s === "partial") partialCount++;
    else emptyCount++;
  });

  const handleSelect = (idx) => {
    onNavigate(idx);
    onClose();
  };

  return (
    <div className="dj-drawer-overlay" onClick={onClose}>
      <div className="dj-drawer-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="dj-drawer-handle" />
        <div className="dj-drawer-header">
          <div className="dj-drawer-title">Select Group</div>
          <button className="dj-drawer-close" onClick={onClose}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="dj-drawer-summary">
          <span className="dj-drawer-stat">
            <span className="dj-drawer-stat-dot" style={{ background: "#22c55e" }} />
            <span style={{ color: "#22c55e" }}>{scoredCount} scored</span>
          </span>
          <span className="dj-drawer-stat">
            <span className="dj-drawer-stat-dot" style={{ background: "#f59e0b" }} />
            <span style={{ color: "#f59e0b" }}>{partialCount} partial</span>
          </span>
          <span className="dj-drawer-stat">
            <span className="dj-drawer-stat-dot" style={{ background: "#475569" }} />
            <span style={{ color: "#64748b" }}>{emptyCount} empty</span>
          </span>
        </div>
        <div className="dj-drawer-list" ref={listRef}>
          {projects.map((p, i) => {
            const status = getProjectStatus(scores, p.project_id, criteria);
            const filled = countFilledForProject(scores, p.project_id, criteria);
            const total = criteria.length;

            let statusLabel, statusClass;
            if (status === "scored") { statusLabel = `✓ ${total}/${total}`; statusClass = "scored"; }
            else if (status === "partial") { statusLabel = `⚠ ${filled}/${total}`; statusClass = "partial"; }
            else { statusLabel = `${filled}/${total}`; statusClass = "empty"; }

            return (
              <div
                key={p.project_id}
                className={`dj-drawer-item${i === current ? " active" : ""}`}
                onClick={() => handleSelect(i)}
              >
                <span className="dj-drawer-p-badge">P{i + 1}</span>
                <div className="dj-drawer-item-info">
                  <div className="dj-drawer-item-name">{p.title}</div>
                  <div className="dj-drawer-item-members">
                    <TeamMembersInline names={p.members} />
                  </div>
                </div>
                <span className={`dj-drawer-item-status ${statusClass}`}>{statusLabel}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/jury/components/ProjectDrawer.jsx
git commit -m "feat(jury): add ProjectDrawer bottom sheet component"
```

---

### Task 5: Wire components into EvalStep and remove old navigation

**Files:**
- Modify: `src/jury/steps/EvalStep.jsx`

- [ ] **Step 1: Update imports**

In `src/jury/steps/EvalStep.jsx`, replace the import block (lines 3–17):

```jsx
import { useState } from "react";
import {
  Check,
  ChevronDown,
  Home,
  Info,
  ListChecks,
  Moon,
  Pencil,
  Send,
  Sun,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import "../../styles/jury.css";
import RubricSheet from "../components/RubricSheet";
import SpotlightTour from "../components/SpotlightTour";
import SegmentedBar from "../components/SegmentedBar";
import ProjectDrawer from "../components/ProjectDrawer";
import { useTheme } from "../../shared/theme/ThemeProvider";
import { StudentNames } from "@/shared/ui/EntityMeta";
```

Note: `ChevronLeft` and `ChevronRight` are removed (no longer needed). `ChevronDown` is added.

- [ ] **Step 2: Add drawer state**

After the existing `const [rubricCritIndex, setRubricCritIndex] = useState(null);` (line 39), add:

```jsx
  const [drawerOpen, setDrawerOpen] = useState(false);
```

- [ ] **Step 3: Replace the Group Bar section**

Replace lines 113–128 (the Group Bar section including the nav buttons):

```jsx
        {/* ── Group Bar (tappable → opens drawer) ── */}
        <div className="dj-group-bar" onClick={() => setDrawerOpen(true)}>
          <div className="dj-group-bar-info">
            <div className="dj-group-bar-title">{state.project.title}</div>
            <div className="dj-group-bar-sub"><StudentNames names={state.project.members} /></div>
          </div>
          <div className="dj-group-bar-right">
            <span className="dj-group-bar-num">{projIdx + 1}/{total}</span>
            <span className="dj-group-bar-chevron">
              <ChevronDown size={14} strokeWidth={2.5} />
            </span>
          </div>
        </div>
```

- [ ] **Step 4: Replace the Progress Bar section**

Replace lines 130–136 (the solid progress bar):

```jsx
        {/* ── Segmented Progress Bar ── */}
        <SegmentedBar
          projects={state.projects}
          scores={state.scores}
          criteria={state.effectiveCriteria}
          current={projIdx}
          onNavigate={state.handleNavigate}
        />
        <hr style={{ border: "none", borderBottom: "1px solid rgba(148,163,184,0.08)", margin: "6px 0 8px" }} />
```

- [ ] **Step 5: Add ProjectDrawer before the closing div**

Insert just before the `{/* ── Rubric bottom sheet ── */}` comment (around line 229):

```jsx
      {/* ── Project selection drawer ── */}
      <ProjectDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        projects={state.projects}
        scores={state.scores}
        criteria={state.effectiveCriteria}
        current={projIdx}
        onNavigate={state.handleNavigate}
      />
```

- [ ] **Step 6: Verify unused imports are removed**

Ensure `ChevronLeft` and `ChevronRight` are not imported (removed in step 1).

- [ ] **Step 7: Run build to verify no errors**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add src/jury/steps/EvalStep.jsx
git commit -m "feat(jury): wire SegmentedBar + ProjectDrawer, remove prev/next nav"
```

---

### Task 6: Manual verification and cleanup

- [ ] **Step 1: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass.

- [ ] **Step 2: Run native select check**

Run: `npm run check:no-native-select`
Expected: OK

- [ ] **Step 3: Visual verification in dev server**

Run: `npm run dev`

Verify in browser (mobile viewport, ~390px):
1. Segmented bar appears below group bar with colored segments
2. Tapping group bar opens the drawer with all projects listed
3. Each drawer item shows P-badge, project title, avatared members, status badge
4. Tapping a drawer item navigates to that project and closes drawer
5. Tapping a segment navigates to that project
6. Legend counts update when scores are entered
7. Segment colors update when project status changes
8. Light mode toggle works — drawer and bar render correctly
9. Drawer closes on overlay click and Escape key

- [ ] **Step 4: Final commit if any adjustments were made**

```bash
git add -A
git commit -m "fix(jury): project navigator visual adjustments"
```
