# Evaluation Periods Premium Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade PeriodsPage from flat table to premium card-wrapped table with lifecycle bar, enriched columns (date range, progress, projects, jurors, criteria, criteria set, framework), and compact mobile cards.

**Architecture:** Modify `PeriodsPage.jsx` to add new columns and lifecycle bar component. Enrich period data with aggregate counts via a new lightweight API function. All new styles go into `periods.css`. Mobile layout uses flexbox card with ordered sections.

**Tech Stack:** React, CSS (existing design system variables), lucide-react icons, existing `useManagePeriods` hook

**Spec:** `docs/superpowers/specs/2026-04-14-periods-premium-redesign.md`
**Mockup:** `docs/mockups/periods-premium-mockup.html`

---

## File Structure

| File | Role |
|------|------|
| `src/styles/pages/periods.css` | All new styles: lifecycle bar, table card, progress bar, badges, mobile cards |
| `src/admin/pages/PeriodsPage.jsx` | Page component: new columns, lifecycle bar, table card wrapper, icon cleanup |
| `src/shared/api/admin/periods.js` | New `listPeriodStats()` function for aggregate counts |
| `src/shared/api/admin/index.js` | Re-export `listPeriodStats` |
| `src/shared/api/index.js` | Re-export `listPeriodStats` |

---

### Task 1: Add `listPeriodStats` API function

Fetch aggregate counts (projects, jurors, criteria, score sheets) per period in a single query.

**Files:**
- Modify: `src/shared/api/admin/periods.js`
- Modify: `src/shared/api/admin/index.js`
- Modify: `src/shared/api/index.js`

- [ ] **Step 1: Add `listPeriodStats` to `src/shared/api/admin/periods.js`**

Add at the end of the file:

```js
/**
 * Fetch aggregate stats for all periods in an organization.
 * Returns: [{ period_id, project_count, juror_count, criteria_count, submitted_sheets, total_sheets }]
 */
export async function listPeriodStats(organizationId) {
  // Projects per period
  const { data: projects, error: pErr } = await supabase
    .from("projects")
    .select("period_id")
    .in(
      "period_id",
      supabase.from("periods").select("id").eq("organization_id", organizationId)
    );

  // Use a simpler approach: fetch raw counts via individual queries
  // that Supabase PostgREST supports well
  const { data: periods } = await supabase
    .from("periods")
    .select("id")
    .eq("organization_id", organizationId);

  if (!periods?.length) return {};

  const periodIds = periods.map((p) => p.id);

  const [projectRes, jurorRes, criteriaRes, sheetsRes] = await Promise.all([
    supabase
      .from("projects")
      .select("period_id", { count: "exact", head: false })
      .in("period_id", periodIds),
    supabase
      .from("juror_period_auth")
      .select("period_id", { count: "exact", head: false })
      .in("period_id", periodIds),
    supabase
      .from("period_criteria")
      .select("period_id", { count: "exact", head: false })
      .in("period_id", periodIds),
    supabase
      .from("score_sheets")
      .select("period_id, status", { count: "exact", head: false })
      .in("period_id", periodIds),
  ]);

  // Aggregate into a map: { [periodId]: { projectCount, jurorCount, criteriaCount, progress } }
  const stats = {};
  for (const id of periodIds) {
    stats[id] = { projectCount: 0, jurorCount: 0, criteriaCount: 0, progress: null };
  }

  for (const row of projectRes.data || []) {
    if (stats[row.period_id]) stats[row.period_id].projectCount++;
  }
  for (const row of jurorRes.data || []) {
    if (stats[row.period_id]) stats[row.period_id].jurorCount++;
  }
  for (const row of criteriaRes.data || []) {
    if (stats[row.period_id]) stats[row.period_id].criteriaCount++;
  }

  // Progress = submitted / total sheets
  const sheetsByPeriod = {};
  for (const row of sheetsRes.data || []) {
    if (!sheetsByPeriod[row.period_id]) sheetsByPeriod[row.period_id] = { total: 0, submitted: 0 };
    sheetsByPeriod[row.period_id].total++;
    if (row.status === "submitted") sheetsByPeriod[row.period_id].submitted++;
  }
  for (const id of periodIds) {
    const s = sheetsByPeriod[id];
    if (s && s.total > 0) {
      stats[id].progress = Math.round((s.submitted / s.total) * 100);
    }
  }

  return stats;
}
```

- [ ] **Step 2: Re-export from `src/shared/api/admin/index.js`**

Add `listPeriodStats` to the semesters/periods export block:

```js
export {
  listPeriods,
  listPeriodStats,
  setCurrentPeriod,
  // ... rest unchanged
} from "./periods";
```

- [ ] **Step 3: Re-export from `src/shared/api/index.js`**

Add `listPeriodStats` to the admin re-exports:

```js
  listPeriodStats,
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/admin/periods.js src/shared/api/admin/index.js src/shared/api/index.js
git commit -m "feat(api): add listPeriodStats for period aggregate counts"
```

---

### Task 2: Add lifecycle bar and table card CSS

Write all new CSS for the premium redesign into `periods.css`.

**Files:**
- Modify: `src/styles/pages/periods.css`

- [ ] **Step 1: Add lifecycle bar styles**

Add after the `.sem-header-actions` block (after line 6):

```css
/* ─── Lifecycle progress bar ─────────────────────────────── */
.periods-lifecycle-bar {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 20px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-sm);
}

.periods-lifecycle-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.periods-lifecycle-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.periods-lifecycle-summary {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.periods-lifecycle-track {
  height: 8px;
  border-radius: 99px;
  background: rgba(15, 23, 42, 0.05);
  display: flex;
  overflow: hidden;
  gap: 1px;
}

.dark-mode .periods-lifecycle-track {
  background: rgba(255, 255, 255, 0.06);
}

.periods-lifecycle-segment {
  height: 100%;
  border-radius: 99px;
  transition: width 0.4s ease;
}

.periods-lifecycle-segment.draft    { background: linear-gradient(90deg, #818cf8, #6366f1); }
.periods-lifecycle-segment.active   { background: linear-gradient(90deg, #34d399, #10b981); }
.periods-lifecycle-segment.completed { background: linear-gradient(90deg, #fbbf24, #d97706); }
.periods-lifecycle-segment.locked   { background: linear-gradient(90deg, #94a3b8, #64748b); }

.periods-lifecycle-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 10px;
}

.periods-lifecycle-legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 500;
}

.periods-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.periods-legend-dot.draft    { background: #6366f1; }
.periods-legend-dot.active   { background: #10b981; }
.periods-legend-dot.completed { background: #d97706; }
.periods-legend-dot.locked   { background: #64748b; }
```

- [ ] **Step 2: Add table card styles**

```css
/* ─── Table card wrapper ─────────────────────────────────── */
.periods-table-card {
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  margin-bottom: 16px;
}

.periods-table-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--surface-1);
}

.periods-table-card-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.2px;
}

.periods-summary-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(22, 163, 74, 0.06);
  color: var(--success);
  border: 1px solid rgba(22, 163, 74, 0.12);
  letter-spacing: 0.15px;
}

.periods-summary-badge svg {
  width: 13px;
  height: 13px;
  opacity: 0.8;
}

.dark-mode .periods-summary-badge {
  background: rgba(74, 222, 128, 0.08);
  color: #86efac;
  border-color: rgba(74, 222, 128, 0.18);
}

.periods-table-scroll {
  overflow-x: auto;
}

.periods-table-card .sem-table {
  min-width: 900px;
}

.periods-table-card .sem-table-wrap {
  border: none;
  border-radius: 0;
  overflow: visible;
}
```

- [ ] **Step 3: Add progress column styles**

```css
/* ─── Progress column ────────────────────────────────────── */
.periods-progress-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 50px;
}

.periods-progress-bar {
  width: 100%;
  max-width: 48px;
  height: 5px;
  border-radius: 99px;
  background: rgba(15, 23, 42, 0.06);
  overflow: hidden;
}

.dark-mode .periods-progress-bar {
  background: rgba(255, 255, 255, 0.08);
}

.periods-progress-fill {
  height: 100%;
  border-radius: 99px;
  background: var(--success);
  transition: width 0.3s;
}

.periods-progress-val {
  font-size: 11px;
  font-weight: 700;
  font-family: var(--mono);
  color: var(--text-primary);
  letter-spacing: -0.3px;
}

.periods-progress-val.muted {
  color: var(--text-quaternary);
  font-weight: 500;
}

.periods-progress-val.done {
  color: var(--success);
}
```

- [ ] **Step 4: Add badge styles (framework, criteria set, date range)**

```css
/* ─── Framework badge ────────────────────────────────────── */
.periods-fw-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 99px;
  font-size: 10.5px;
  font-weight: 600;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.07), rgba(139, 92, 246, 0.07));
  border: 1px solid rgba(59, 130, 246, 0.14);
  color: var(--accent);
  white-space: nowrap;
}

.periods-fw-badge svg {
  width: 11px;
  height: 11px;
}

.periods-fw-badge.none {
  color: var(--text-quaternary);
  background: rgba(15, 23, 42, 0.03);
  border-color: var(--border);
}

.dark-mode .periods-fw-badge {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.08), rgba(167, 139, 250, 0.08));
  border-color: rgba(96, 165, 250, 0.18);
  color: var(--accent);
}

.dark-mode .periods-fw-badge.none {
  color: var(--text-quaternary);
  background: rgba(255, 255, 255, 0.03);
  border-color: var(--border);
}

/* ─── Criteria set badge ─────────────────────────────────── */
.periods-cset-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 99px;
  font-size: 10.5px;
  font-weight: 600;
  background: rgba(139, 92, 246, 0.07);
  border: 1px solid rgba(139, 92, 246, 0.14);
  color: #7c3aed;
  white-space: nowrap;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.periods-cset-badge.muted {
  color: var(--text-tertiary);
  background: rgba(15, 23, 42, 0.03);
  border-color: var(--border);
}

.dark-mode .periods-cset-badge {
  background: rgba(167, 139, 250, 0.08);
  border-color: rgba(167, 139, 250, 0.18);
  color: #c4b5fd;
}

.dark-mode .periods-cset-badge.muted {
  color: var(--text-quaternary);
  background: rgba(255, 255, 255, 0.03);
  border-color: var(--border);
}

/* ─── Date range ─────────────────────────────────────────── */
.periods-date-range {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
  white-space: nowrap;
}

.periods-date-sep {
  color: var(--text-quaternary);
  margin: 0 3px;
}

/* ─── Stat columns ───────────────────────────────────────── */
.periods-stat-val {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.periods-stat-val.zero {
  color: var(--text-quaternary);
}
```

- [ ] **Step 5: Rewrite mobile card layout**

Replace the existing `@media (max-width: 768px) and (orientation: portrait)` block with:

```css
/* ─── Mobile card layout (portrait ≤ 768px) ──────────────── */
@media (max-width: 768px) and (orientation: portrait) {
  .periods-lifecycle-bar { padding: 12px 14px; }
  .periods-lifecycle-legend { flex-wrap: wrap; gap: 8px 14px; }

  .periods-table-card { border-radius: var(--radius); overflow: hidden; }
  .periods-table-scroll { overflow: visible; }
  .periods-table-card .sem-table { min-width: 0; }

  .sem-table, .sem-table thead, .sem-table tbody { display: block; width: 100%; }
  .sem-table thead { display: none !important; }

  .sem-table tbody tr {
    display: flex; flex-direction: column; gap: 0;
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius); margin-bottom: 10px; padding: 0;
    box-shadow: var(--shadow-sm); overflow: hidden; position: relative;
  }
  .sem-table tbody tr:hover {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.10);
  }
  .sem-table tbody td { display: block; padding: 0; border-bottom: none; }

  /* Period name — top */
  .sem-table td[data-label="Evaluation Period"] { padding: 14px 16px 6px; order: 1; }

  /* Status — below name */
  .sem-table td[data-label="Status"] { padding: 0 16px 10px; order: 2; }

  /* Date range */
  .sem-table td[data-label="Date Range"] {
    order: 3; padding: 10px 16px 0; border-top: 1px solid var(--border);
  }
  .sem-table td[data-label="Date Range"]::before {
    content: "Date Range"; display: block; font-size: 8.5px;
    text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--text-quaternary); font-weight: 600; margin-bottom: 2px;
  }

  /* Progress */
  .sem-table td[data-label="Progress"] { order: 4; padding: 8px 16px 0; }
  .sem-table td[data-label="Progress"]::before {
    content: "Progress"; display: block; font-size: 8.5px;
    text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--text-quaternary); font-weight: 600; margin-bottom: 2px;
  }
  .sem-table td[data-label="Progress"] .periods-progress-cell { align-items: flex-start; }
  .sem-table td[data-label="Progress"] .periods-progress-bar { max-width: 100%; }

  /* Stats strip (Projects · Jurors · Criteria) */
  .sem-table td.periods-mobile-stats { order: 5; padding: 8px 16px 0; }
  .periods-mobile-stats-row {
    display: flex; align-items: center; gap: 14px;
  }
  .periods-m-stat {
    display: flex; align-items: center; gap: 4px;
    font-size: 11px; color: var(--text-tertiary); font-weight: 500;
  }
  .periods-m-stat .val {
    font-weight: 700; color: var(--text-secondary);
    font-family: var(--mono); font-size: 11.5px;
  }
  .periods-m-stat .val.zero { color: var(--text-quaternary); }

  /* Criteria Set */
  .sem-table td[data-label="Criteria Set"] { order: 6; padding: 8px 16px 0; }
  .sem-table td[data-label="Criteria Set"]::before {
    content: "Criteria Set"; display: block; font-size: 8.5px;
    text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--text-quaternary); font-weight: 600; margin-bottom: 2px;
  }

  /* Framework */
  .sem-table td[data-label="Framework"] { order: 7; padding: 8px 16px 0; }
  .sem-table td[data-label="Framework"]::before {
    content: "Framework"; display: block; font-size: 8.5px;
    text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--text-quaternary); font-weight: 600; margin-bottom: 2px;
  }

  /* Updated — bottom */
  .sem-table td[data-label="Last Updated"] {
    order: 8; padding: 10px 16px 14px; margin-top: 6px;
    border-top: 1px solid var(--border);
  }
  .sem-table td[data-label="Last Updated"]::before {
    content: "Updated"; display: inline; font-size: 8.5px;
    text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--text-quaternary); font-weight: 600; margin-right: 8px;
  }

  /* Actions — absolute top right */
  .sem-table td.col-actions { position: absolute; top: 10px; right: 10px; order: 10; }

  /* Desktop-only individual stat cells hidden */
  .sem-table td[data-label="Projects"],
  .sem-table td[data-label="Jurors"],
  .sem-table td[data-label="Criteria"] { display: none !important; }

  /* Row accents */
  .periods-page .sem-row-current { border-left: 3px solid #10b981; }
  .sem-row-draft { border-left: 3px solid rgba(79, 70, 229, 0.3); }

  .period-name { font-size: 14px; }
  .sem-badge-current { font-size: 9px; padding: 2px 7px; }

  /* Mobile stats strip visible */
  .periods-mobile-stats { display: block !important; }
}

/* Mobile stats strip hidden on desktop */
.periods-mobile-stats { display: none; }
```

- [ ] **Step 6: Verify build passes**

Run: `npm run build`
Expected: No errors (CSS-only changes)

- [ ] **Step 7: Commit**

```bash
git add src/styles/pages/periods.css
git commit -m "feat(styles): add premium periods page CSS — lifecycle bar, table card, progress, mobile cards"
```

---

### Task 3: Rewrite PeriodsPage.jsx

Update the page component with all new elements.

**Files:**
- Modify: `src/admin/pages/PeriodsPage.jsx`

- [ ] **Step 1: Update imports**

Replace the lucide-react import block (lines 14–27) with:

```jsx
import {
  Lock,
  LockOpen,
  Trash2,
  FileEdit,
  Play,
  CheckCircle,
  MoreVertical,
  Pencil,
  Eye,
  CalendarRange,
  Filter,
  Download,
  Plus,
  Layers,
} from "lucide-react";
```

Add the new API import:

```jsx
import { setEvalLock, deletePeriod, listPeriodCriteria, savePeriodCriteria, listPeriodStats } from "@/shared/api";
```

- [ ] **Step 2: Add `LifecycleBar` component**

Add after the `SortIcon` component (after line 101):

```jsx
function LifecycleBar({ draft, active, completed, locked }) {
  const total = draft + active + completed + locked;
  if (total === 0) return null;
  const pct = (n) => `${(n / total) * 100}%`;

  const parts = [];
  if (active > 0) parts.push(`${active} active`);
  if (locked > 0) parts.push(`${locked} locked`);
  if (draft > 0) parts.push(`${draft} draft`);
  if (completed > 0) parts.push(`${completed} completed`);

  return (
    <div className="periods-lifecycle-bar">
      <div className="periods-lifecycle-top">
        <span className="periods-lifecycle-label">Period Lifecycle</span>
        <span className="periods-lifecycle-summary">{parts.join(" · ")}</span>
      </div>
      <div className="periods-lifecycle-track">
        {draft > 0 && <div className="periods-lifecycle-segment draft" style={{ width: pct(draft) }} />}
        {active > 0 && <div className="periods-lifecycle-segment active" style={{ width: pct(active) }} />}
        {completed > 0 && <div className="periods-lifecycle-segment completed" style={{ width: pct(completed) }} />}
        {locked > 0 && <div className="periods-lifecycle-segment locked" style={{ width: pct(locked) }} />}
      </div>
      <div className="periods-lifecycle-legend">
        <span className="periods-lifecycle-legend-item"><span className="periods-legend-dot draft" /> Draft ({draft})</span>
        <span className="periods-lifecycle-legend-item"><span className="periods-legend-dot active" /> Active ({active})</span>
        <span className="periods-lifecycle-legend-item"><span className="periods-legend-dot completed" /> Completed ({completed})</span>
        <span className="periods-lifecycle-legend-item"><span className="periods-legend-dot locked" /> Locked ({locked})</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add `ProgressCell` component**

Add after `LifecycleBar`:

```jsx
function ProgressCell({ period, stats }) {
  const status = getPeriodStatus(period);
  const progress = stats?.[period.id]?.progress;

  if (status === "draft") {
    return (
      <div className="periods-progress-cell">
        <span className="periods-progress-val muted">—</span>
        <div className="periods-progress-bar"><div className="periods-progress-fill" style={{ width: "0%" }} /></div>
      </div>
    );
  }

  const pct = progress ?? (status === "locked" || status === "completed" ? 100 : null);
  if (pct === null) {
    return (
      <div className="periods-progress-cell">
        <span className="periods-progress-val muted">—</span>
        <div className="periods-progress-bar"><div className="periods-progress-fill" style={{ width: "0%" }} /></div>
      </div>
    );
  }

  return (
    <div className="periods-progress-cell">
      <span className={`periods-progress-val${pct >= 100 ? " done" : ""}`}>{pct}%</span>
      <div className="periods-progress-bar"><div className="periods-progress-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
```

- [ ] **Step 4: Add `periodStats` state and fetch**

Inside `PeriodsPage()`, after the `periods` hook call (around line 132), add:

```jsx
const [periodStats, setPeriodStats] = useState({});

useEffect(() => {
  if (!organizationId) return;
  listPeriodStats(organizationId)
    .then(setPeriodStats)
    .catch(() => {}); // Non-fatal — columns show "—" on failure
}, [organizationId, periodList]);
```

Also destructure `frameworks` from context (already exists on line 107).

- [ ] **Step 5: Replace page header buttons — remove raw `<Icon>` SVGs**

Replace the Export button (lines 333–349) with:

```jsx
<button className="btn btn-outline btn-sm mobile-toolbar-export" onClick={() => { setExportOpen((v) => !v); setFilterOpen(false); }}>
  <Download size={14} strokeWidth={2} style={{ verticalAlign: "-1px" }} />
  {" "}Export
</button>
```

Replace the Add Period button (lines 351–358) with:

```jsx
<button className="btn btn-primary btn-sm mobile-toolbar-secondary" onClick={openAddDrawer}>
  <Plus size={13} strokeWidth={2.2} />
  Add Period
</button>
```

- [ ] **Step 6: Replace filter panel `<Icon>` SVGs**

In the filter panel header (lines 366–379), replace the `<Icon iconNode>` with:

```jsx
<Filter size={14} strokeWidth={2} style={{ verticalAlign: "-1px", marginRight: "4px", opacity: 0.5 }} />
```

Replace the clear button icon (lines 402–415) with:

```jsx
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
```

(Or import `X` from lucide-react and use `<X size={12} strokeWidth={2} style={{ opacity: 0.5 }} />`)

- [ ] **Step 7: Add lifecycle bar after KPI strip**

After the KPI strip closing `</div>` (line 484), add:

```jsx
<LifecycleBar
  draft={draftPeriods}
  active={activePeriods}
  completed={completedPeriods}
  locked={lockedPeriods}
/>
```

- [ ] **Step 8: Wrap table in card and add new columns**

Replace the table section (lines 492–704) with the card-wrapped structure. The key changes:

1. Wrap `sem-table-wrap` in `periods-table-card` with header
2. Add `periods-table-scroll` wrapper inside
3. Add new `<th>` columns: Date Range, Progress, Projects, Jurors, Criteria, Criteria Set, Framework
4. Add corresponding `<td>` cells in each row
5. Add `periods-mobile-stats` td in each row
6. Remove sub-text from locked/completed rows
7. Keep sub-text for active ("Evaluation in progress") and draft ("Setup in progress") only

New table header:

```jsx
<tr>
  <th className={`sortable${sortKey === "name" ? " sorted" : ""}`} style={{ minWidth: "160px" }} onClick={() => handleSort("name")}>
    Period <SortIcon colKey="name" sortKey={sortKey} sortDir={sortDir} />
  </th>
  <th className={`sortable${sortKey === "status" ? " sorted" : ""}`} style={{ width: "90px" }} onClick={() => handleSort("status")}>
    Status <SortIcon colKey="status" sortKey={sortKey} sortDir={sortDir} />
  </th>
  <th style={{ width: "130px" }}>Date Range</th>
  <th style={{ width: "64px", textAlign: "center" }}>Progress</th>
  <th style={{ width: "56px", textAlign: "center" }}>Projects</th>
  <th style={{ width: "50px", textAlign: "center" }}>Jurors</th>
  <th style={{ width: "54px", textAlign: "center" }}>Criteria</th>
  <th style={{ width: "110px" }}>Criteria Set</th>
  <th style={{ width: "90px" }}>Framework</th>
  <th className={`sortable${sortKey === "updated_at" ? " sorted" : ""}`} style={{ width: "80px" }} onClick={() => handleSort("updated_at")}>
    Updated <SortIcon colKey="updated_at" sortKey={sortKey} sortDir={sortDir} />
  </th>
  <th style={{ width: "36px" }}>Actions</th>
</tr>
```

New row body (for each period in `pagedList.map`):

```jsx
{/* Period name */}
<td data-label="Evaluation Period">
  <div className="sem-name" style={period.is_locked ? { color: "var(--text-secondary)" } : undefined}>
    {period.name}
    {isCurrent && (
      <span className="sem-badge-current"><span className="dot" /> Current</span>
    )}
  </div>
  {(status === "active" || status === "draft") && (
    <div className="sem-name-sub">
      {status === "active" ? "Evaluation in progress" : "Setup in progress"}
    </div>
  )}
</td>

{/* Status */}
<td data-label="Status"><StatusPill status={status} /></td>

{/* Date Range */}
<td data-label="Date Range">
  {period.start_date || period.end_date ? (
    <span className="periods-date-range">
      {period.start_date ? new Date(period.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
      <span className="periods-date-sep">→</span>
      {period.end_date ? new Date(period.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
    </span>
  ) : (
    <span style={{ color: "var(--text-quaternary)", fontSize: 11 }}>—</span>
  )}
</td>

{/* Progress */}
<td data-label="Progress" style={{ textAlign: "center" }}>
  <ProgressCell period={period} stats={periodStats} />
</td>

{/* Projects */}
<td data-label="Projects" style={{ textAlign: "center" }}>
  <span className={`periods-stat-val${(periodStats[period.id]?.projectCount || 0) === 0 ? " zero" : ""}`}>
    {periodStats[period.id]?.projectCount ?? "—"}
  </span>
</td>

{/* Jurors */}
<td data-label="Jurors" style={{ textAlign: "center" }}>
  <span className={`periods-stat-val${(periodStats[period.id]?.jurorCount || 0) === 0 ? " zero" : ""}`}>
    {periodStats[period.id]?.jurorCount ?? "—"}
  </span>
</td>

{/* Criteria */}
<td data-label="Criteria" style={{ textAlign: "center" }}>
  <span className={`periods-stat-val${(periodStats[period.id]?.criteriaCount || 0) === 0 ? " zero" : ""}`}>
    {periodStats[period.id]?.criteriaCount ?? "—"}
  </span>
</td>

{/* Mobile stats strip */}
<td className="periods-mobile-stats">
  <div className="periods-mobile-stats-row">
    <span className="periods-m-stat"><span className={`val${(periodStats[period.id]?.projectCount || 0) === 0 ? " zero" : ""}`}>{periodStats[period.id]?.projectCount ?? "—"}</span> projects</span>
    <span className="periods-m-stat"><span className={`val${(periodStats[period.id]?.jurorCount || 0) === 0 ? " zero" : ""}`}>{periodStats[period.id]?.jurorCount ?? "—"}</span> jurors</span>
    <span className="periods-m-stat"><span className={`val${(periodStats[period.id]?.criteriaCount || 0) === 0 ? " zero" : ""}`}>{periodStats[period.id]?.criteriaCount ?? "—"}</span> criteria</span>
  </div>
</td>

{/* Criteria Set */}
<td data-label="Criteria Set">
  <span className="periods-cset-badge muted">—</span>
</td>

{/* Framework */}
<td data-label="Framework">
  {(() => {
    const fw = frameworks.find((f) => f.id === period.framework_id);
    return fw ? (
      <span className="periods-fw-badge"><Layers size={11} strokeWidth={2} /> {fw.name}</span>
    ) : (
      <span className="periods-fw-badge none">—</span>
    );
  })()}
</td>

{/* Updated */}
<td data-label="Last Updated">
  <PremiumTooltip text={formatFull(period.updated_at)}>
    <span className="vera-datetime-text">{formatRelative(period.updated_at)}</span>
  </PremiumTooltip>
</td>

{/* Actions */}
<td className="col-actions">
  {/* ... existing FloatingMenu unchanged ... */}
</td>
```

- [ ] **Step 9: Update export column mappings**

Update the export `header` and `rows` arrays in both `generateFile` and `onExport` to include new columns:

```jsx
const header = ["Name", "Season", "Status", "Start Date", "End Date", "Projects", "Jurors", "Criteria", "Framework", "Current", "Locked", "Created"];
const rows = sortedFilteredList.map((p) => {
  const st = periodStats[p.id] || {};
  const fw = frameworks.find((f) => f.id === p.framework_id);
  return [
    p.name ?? "", p.season ?? "", getPeriodStatus(p),
    p.start_date ?? "", p.end_date ?? "",
    st.projectCount ?? "", st.jurorCount ?? "", st.criteriaCount ?? "",
    fw?.name ?? "",
    p.is_current ? "Yes" : "No", p.is_locked ? "Yes" : "No",
    formatFull(p.created_at),
  ];
});
```

- [ ] **Step 10: Verify build passes and test in browser**

Run: `npm run build`
Then: `npm run dev` — open the Periods page in browser, verify:
- Lifecycle bar renders with correct segment widths
- Table card wrapper with header and summary badge
- All new columns display (Date Range, Progress, Projects, Jurors, Criteria, Criteria Set, Framework)
- Progress shows % for active, `—` for draft, `100%` for locked
- Framework badge shows name or `—`
- Mobile: resize to portrait < 768px, verify card layout with all sections

- [ ] **Step 11: Commit**

```bash
git add src/admin/pages/PeriodsPage.jsx
git commit -m "feat(periods): premium redesign — lifecycle bar, enriched columns, mobile cards"
```

---

### Task 4: Visual polish and dark mode verification

**Files:**
- Modify: `src/styles/pages/periods.css` (if needed)

- [ ] **Step 1: Run dev server and verify light mode**

Run: `npm run dev`

Check in browser:
- KPI strip colors match mockup
- Lifecycle bar segments have correct gradient colors
- Active row has green left border + gradient
- Draft row has indigo left border
- Locked rows have no sub-text, muted name color
- Framework and criteria set badges render correctly
- Progress bars fill correctly

- [ ] **Step 2: Toggle dark mode and verify**

Switch to dark mode in the app. Verify:
- Lifecycle bar background and segment colors work with dark variables
- Table card uses `var(--bg-card)` correctly
- Badge borders/backgrounds adapt to dark mode tokens
- Progress bar track color adapts
- No hardcoded light-mode colors leaking through

- [ ] **Step 3: Test mobile layout**

Resize browser to portrait ≤ 768px. Verify:
- Cards don't overflow
- All sections visible in correct order
- Stats strip shows inline (projects · jurors · criteria)
- Actions button positioned top-right
- Active/draft left-border accents work

- [ ] **Step 4: Run no-native-select check**

Run: `npm run check:no-native-select`
Expected: PASS

- [ ] **Step 5: Final commit (if CSS tweaks needed)**

```bash
git add src/styles/pages/periods.css
git commit -m "fix(periods): dark mode and mobile polish adjustments"
```

---

## Self-Review Notes

- **Spec coverage:** All spec sections covered — lifecycle bar (Task 2+3), new columns (Task 3), mobile cards (Task 2+3), visual polish (Task 4), icon cleanup (Task 3 step 5-6).
- **Placeholder scan:** Criteria Set column shows `—` as placeholder — this is intentional per spec ("show `—` if not in schema"). No TBDs in the plan.
- **Type consistency:** `periodStats` shape is `{ [periodId]: { projectCount, jurorCount, criteriaCount, progress } }` — used consistently in `listPeriodStats` (Task 1) and all template references (Task 3).
- **Spec gap:** Export columns updated in Task 3 step 9 — not in original spec but necessary for consistency.
