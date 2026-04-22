# Admin Panel Mobile Responsive Pattern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement portrait-card / landscape-table responsive pattern across all 9 remaining admin data tables.

**Architecture:** Each table gets a CSS-only portrait card layout: `data-label` attr on `<td>` elements + `::before` pseudo-element label + `flex`/`grid` on `<tr>`. Landscape uses compact padding with optional column hiding. Portrait breakpoint: `(max-width: 768px) and (orientation: portrait)`. Landscape compact: `(max-width: 768px) and (orientation: landscape)`.

**Tech Stack:** Plain CSS media queries, `data-label` HTML attribute, CSS grid/flexbox, React JSX attribute additions. All page CSS files already imported via `src/styles/main.css`. No JS changes required.

**Already complete (reference implementations):**
- `src/admin/pages/JurorsPage.jsx` + `src/styles/pages/jurors.css` — `col-mobile-card` approach
- `src/admin/pages/OrganizationsPage.jsx` — `data-label` CSS approach (use this as reference)

---

## File Map

| File | Tasks |
|------|-------|
| `src/styles/pages/reviews.css:429` | Task 1 — fix media query line |
| `src/admin/pages/ProjectsPage.jsx:528-567` | Task 2 — add data-label attrs |
| `src/styles/pages/projects.css` | Task 2 — portrait card CSS |
| `src/admin/pages/PeriodsPage.jsx:535-561` | Task 3 — add data-label attrs |
| `src/styles/pages/periods.css` | Task 3 — portrait card CSS |
| `src/admin/pages/RankingsPage.jsx:813-897` | Task 4 — add col-criteria-th + data-label |
| `src/styles/pages/rankings.css` | Task 4 — portrait card + landscape CSS |
| `src/admin/pages/AuditLogPage.jsx:642-673` | Task 5 — add data-label attrs |
| `src/styles/pages/audit-log.css` | Task 5 — portrait card + landscape CSS |
| `src/admin/pages/PinBlockingPage.jsx:131,158-187` | Task 6 — add table class + data-label |
| `src/styles/pages/pin-lock.css` | Task 6 — portrait card + landscape CSS |
| `src/admin/pages/EntryControlPage.jsx:1028,1053-1108` | Task 7 — add table class + data-label |
| `src/styles/pages/entry-control.css` | Task 7 — portrait card + landscape CSS |
| `src/admin/pages/CriteriaPage.jsx:276-320` | Task 8 — add data-label attrs |
| `src/styles/pages/criteria.css` | Task 8 — portrait card + landscape CSS |
| `src/admin/pages/OutcomesPage.jsx:121-215` | Task 9 — add data-label attrs |
| `src/styles/pages/outcomes.css` | Task 9 — portrait card + landscape CSS |

---

## Shared CSS Pattern Reference

Every portrait card block follows this template (adapt grid-template-areas per page):

```css
@media (max-width: 768px) and (orientation: portrait) {
  /* Strip table-wrap border */
  .PAGE-wrap { border: none; background: none; box-shadow: none; border-radius: 0; overflow: visible; }

  /* Unwrap table into block elements */
  .PAGE-table { display: block; }
  .PAGE-table thead { display: none; }
  .PAGE-table tbody { display: block; }

  /* Each row becomes a card */
  .PAGE-table tbody tr {
    display: flex;            /* or grid */
    flex-wrap: wrap;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-bottom: 10px;
    padding: 12px 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .PAGE-table tbody tr:hover {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59,130,246,0.10);
  }

  .PAGE-table td { display: block; border-bottom: none; padding: 0; }

  /* data-label micro-label above each value */
  .PAGE-table td[data-label]::before {
    content: attr(data-label);
    display: block;
    font-size: 8.5px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--text-tertiary);
    font-weight: 600;
    margin-bottom: 2px;
  }
}
```

---

## Task 1: ReviewsPage — fix portrait media query scoping

**Problem:** `src/styles/pages/reviews.css:429` uses `@media (max-width: 768px)` with no orientation. On iPhone SE in landscape (667px wide), the card layout incorrectly activates instead of showing the table.

**Files:**
- Modify: `src/styles/pages/reviews.css:429`

- [ ] **Step 1: Add orientation filter to the existing media query**

In `src/styles/pages/reviews.css`, change line 429 from:
```css
@media (max-width: 768px) {
```
to:
```css
@media (max-width: 768px) and (orientation: portrait) {
```
This is a one-line change. The entire block from line 429 to the closing `}` on line 605 is now portrait-only.

- [ ] **Step 2: Add landscape compact rules**

Append at the very end of `src/styles/pages/reviews.css` (after line 605):
```css
/* ── Landscape compact (≤768px landscape) ── */
@media (max-width: 768px) and (orientation: landscape) {
  .reviews-header { flex-direction: column; align-items: stretch; gap: 10px; }
  .reviews-table thead th { padding: 6px 10px; font-size: 10px; }
  .reviews-table tbody td { padding: 5px 10px; font-size: 12px; }
  .reviews-table .col-progress,
  .reviews-table .col-members,
  .reviews-table .col-comment,
  .reviews-table .col-submitted { display: none; }
}
```

- [ ] **Step 3: Verify**

Run: `npm run dev`
- Open Reviews page, DevTools device sim: iPhone SE landscape (667×375) → table layout visible, no cards.
- iPhone SE portrait (375×667) → card layout visible.

---

## Task 2: ProjectsPage — portrait card layout

Landscape compact for `#projects-main-table` already exists in `src/styles/mobile.css`. This task adds the missing portrait cards.

**Files:**
- Modify: `src/admin/pages/ProjectsPage.jsx:528-567`
- Modify: `src/styles/pages/projects.css`

- [ ] **Step 1: Add data-label attributes to row <td> elements**

In `src/admin/pages/ProjectsPage.jsx`, find the row starting at line 528. Update each `<td>`:

```jsx
<tr key={project.id} onClick={() => openDrawer(project)}>
  <td className="text-center" data-label="No">
    {project.group_no != null
      ? <span className="project-no-badge">P{project.group_no}</span>
      : <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>—</span>}
  </td>
  <td data-label="Project Title">
    <div style={{ fontWeight: 600, lineHeight: 1.35 }}>{project.title}</div>
    {project.advisor && (() => {
      const advisors = project.advisor.split(",").map((s) => s.trim()).filter(Boolean);
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
          <UserRound size={11} style={{ color: "var(--text-quaternary)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "var(--text-quaternary)" }}>
            {advisors.length === 1
              ? <><span>Advisor:</span> {advisors[0]}</>
              : <><span>Advisors:</span> {advisors.join(", ")}</>
            }
          </span>
        </div>
      );
    })()}
  </td>
  <td className="col-members" data-label="Team Members">
    <StudentNames names={project.members} />
  </td>
  <td className="text-center avg-score-cell" data-label="Avg Score">
    {projectAvgMap.has(project.id)
      ? <>
          <span className="avg-score-value">{projectAvgMap.get(project.id)}</span>
          {periodMaxScore != null && <span className="avg-score-max"> /{periodMaxScore}</span>}
        </>
      : <span className="avg-score-empty">—</span>}
  </td>
  <td className="col-updated" data-label="Last Updated">
    <PremiumTooltip text={formatFull(project.updated_at)}>
      <span className="vera-datetime-text">{formatRelative(project.updated_at)}</span>
    </PremiumTooltip>
  </td>
  <td style={{ textAlign: "right" }}>
    {/* existing actions JSX unchanged */}
  </td>
</tr>
```

- [ ] **Step 2: Add portrait card CSS to projects.css**

Append at the end of `src/styles/pages/projects.css`:
```css
/* ═══════════════════════════════════════════════
   Portrait card layout — ≤768px portrait
   ═══════════════════════════════════════════════ */
@media (max-width: 768px) and (orientation: portrait) {

  /* Strip the table-wrap frame — cards style themselves */
  .projects-page .table-wrap {
    border: none;
    background: none;
    box-shadow: none;
    border-radius: 0;
    overflow: visible;
  }

  #projects-main-table { display: block; }
  #projects-main-table thead { display: none; }
  #projects-main-table tbody { display: block; }

  #projects-main-table tbody tr {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-bottom: 10px;
    padding: 12px 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: box-shadow 0.15s, border-color 0.15s;
    cursor: pointer;
    gap: 0;
  }
  #projects-main-table tbody tr:hover {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59,130,246,0.10);
  }

  #projects-main-table td {
    display: block;
    border-bottom: none;
    padding: 0;
    text-align: left;
    box-sizing: border-box;
  }

  #projects-main-table td[data-label]::before {
    content: attr(data-label);
    display: block;
    font-size: 8.5px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--text-tertiary);
    font-weight: 600;
    margin-bottom: 2px;
  }

  /* Row 1: No badge (left) + Project Title (right, flex:1) */
  #projects-main-table td[data-label="No"] {
    flex: 0 0 auto;
    margin-right: 12px;
    align-self: center;
  }
  #projects-main-table td[data-label="No"]::before { display: none; }
  #projects-main-table td[data-label="Project Title"] {
    flex: 1 1 0;
    min-width: 0;
    padding-bottom: 6px;
  }
  #projects-main-table td[data-label="Project Title"]::before { display: none; }

  /* Row 2: Team Members (full width) */
  #projects-main-table .col-members {
    flex: 0 0 100%;
    padding-bottom: 8px;
    border-top: 1px solid var(--border);
    padding-top: 8px;
  }
  #projects-main-table .col-members::before { content: "Team Members"; }

  /* Row 3: Avg Score (left) + Last Updated (right) */
  #projects-main-table .avg-score-cell {
    flex: 1 1 0;
    text-align: left;
  }
  #projects-main-table .avg-score-cell::before { content: "Score"; }
  #projects-main-table .col-updated {
    flex: 0 0 auto;
    text-align: right;
  }

  /* Actions row */
  #projects-main-table td:last-child {
    flex: 0 0 100%;
    text-align: right;
    padding-top: 8px;
    border-top: 1px solid var(--border);
    margin-top: 6px;
  }

  /* Override mobile.css landscape hiders — make sure they're visible in portrait */
  #projects-main-table .col-members,
  #projects-main-table .col-updated { display: block; }
}
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
- Projects page, portrait 375px → rows show as cards: badge left, title right, members row, score + last-updated, actions.
- Landscape → compact table from mobile.css.

---

## Task 3: PeriodsPage — portrait card layout

Landscape compact for `.sem-table` already exists in `src/styles/mobile.css`. This task adds portrait cards.

**Files:**
- Modify: `src/admin/pages/PeriodsPage.jsx:535-565`
- Modify: `src/styles/pages/periods.css`

- [ ] **Step 1: Add data-label attributes to period row <td> elements**

In `src/admin/pages/PeriodsPage.jsx`, the row body starts around line 534. Update each `<td>` inside the `sortedFilteredList.map((period) => { ... })` callback:

```jsx
<td data-label="Evaluation Period">
  <div className="sem-name" style={period.is_locked ? { color: "var(--text-secondary)" } : undefined}>
    {period.name}
    {isCurrent && (
      <span className="sem-badge-current">
        <span className="dot" />
        Current
      </span>
    )}
  </div>
  <div className="sem-name-sub">
    {status === "locked"
      ? "Locked · scores finalized · read-only"
      : status === "active"
      ? "Evaluation in progress"
      : status === "completed"
      ? "Completed · all evaluations submitted"
      : "Setup in progress"}
  </div>
</td>
<td data-label="Status"><StatusPill status={status} /></td>
<td data-label="Last Updated">
  <PremiumTooltip text={formatFull(period.updated_at)}>
    <span className="vera-datetime-text">{formatRelative(period.updated_at)}</span>
  </PremiumTooltip>
</td>
<td>
  {/* existing actions JSX unchanged */}
</td>
```

- [ ] **Step 2: Add portrait card CSS to periods.css**

Append at the end of `src/styles/pages/periods.css`:
```css
/* ═══════════════════════════════════════════════
   Portrait card layout — ≤768px portrait
   ═══════════════════════════════════════════════ */
@media (max-width: 768px) and (orientation: portrait) {

  .sem-table-wrap {
    border: none;
    background: none;
    box-shadow: none;
    border-radius: 0;
    overflow: visible;
  }

  .sem-table { display: block; }
  .sem-table thead { display: none; }
  .sem-table tbody { display: block; }

  .sem-table tbody tr {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "period  status"
      "period  updated"
      "period  actions";
    gap: 4px 12px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-bottom: 10px;
    padding: 14px 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .sem-table tbody tr:hover {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59,130,246,0.10);
  }
  .sem-table tbody tr.sem-row-current {
    border-left: 3px solid var(--accent);
  }
  .sem-table tbody tr.sem-row-draft { opacity: 0.78; }

  .sem-table td { display: block; border-bottom: none; padding: 0; }

  .sem-table td[data-label="Evaluation Period"] {
    grid-area: period;
    align-self: center;
  }
  .sem-table td[data-label="Status"] {
    grid-area: status;
    text-align: right;
    align-self: flex-start;
    padding-top: 2px;
  }
  .sem-table td[data-label="Last Updated"] {
    grid-area: updated;
    text-align: right;
    font-size: 11px;
    color: var(--text-tertiary);
  }
  .sem-table td:last-child {
    grid-area: actions;
    text-align: right;
    align-self: flex-end;
  }
}
```

- [ ] **Step 3: Verify**

- Portrait 375px → each period is a card: period name + subtitle left, status pill top-right, timestamp middle-right, actions bottom-right.
- Current period shows left accent border.
- Landscape → compact table.

---

## Task 4: RankingsPage — portrait card + landscape

Dynamic criteria columns (`HeatCell`) are hidden in portrait; static columns (rank, project, members, avg, consensus) form the card.

**Files:**
- Modify: `src/admin/pages/RankingsPage.jsx:813-897`
- Modify: `src/styles/pages/rankings.css`

- [ ] **Step 1: Add col-criteria-th class to dynamic <th> elements**

In `src/admin/pages/RankingsPage.jsx`, find the `criteriaConfig.map()` in `<thead>` around line 813:

```jsx
{criteriaConfig.map((c) => (
  <th
    key={c.id}
    className={`col-criteria-th sortable text-right${sortField === c.id ? " sorted" : ""}`}
    onClick={() => handleSort(c.id)}
  >
    {c.shortLabel || c.label} ({c.max})
    <SortIcon field={c.id} sortField={sortField} sortDir={sortDir} />
  </th>
))}
```

- [ ] **Step 2: Add data-label to static <td> elements in rows**

In `src/admin/pages/RankingsPage.jsx`, find the row rendering around line 873 and update the static cells:

```jsx
<tr key={proj.id} className={rank <= 3 ? "ranking-highlight" : ""}>
  <td className="col-rank" data-label="Rank">
    <MedalCell rank={rank} />
  </td>
  <td className="col-project" data-label="Project">
    {title}
  </td>
  <td className="col-students" data-label="Members">
    <StudentNames names={members} />
  </td>
  {criteriaConfig.map((c) => (
    <HeatCell
      key={c.id}
      value={proj.avg?.[c.id]}
      max={c.max}
      color={c.color}
      label={c.shortLabel || c.label}
    />
  ))}
  <td
    className="col-avg"
    data-label="Average"
    style={rank === 1 ? { color: "var(--accent)" } : undefined}
  >
    {proj.totalAvg.toFixed(1)}
  </td>
  <td className="text-center consensus-cell" data-label="Consensus">
    <ConsensusBadge consensus={consensus} />
  </td>
  <td className="col-jurors" data-label="Jurors">
    {proj.count ?? "—"}
  </td>
</tr>
```

- [ ] **Step 3: Add portrait card + landscape CSS to rankings.css**

Append at the end of `src/styles/pages/rankings.css`:
```css
/* ═══════════════════════════════════════════════
   Portrait card layout — ≤768px portrait
   Dynamic criteria columns (.heat-cell) hidden.
   ═══════════════════════════════════════════════ */
@media (max-width: 768px) and (orientation: portrait) {

  .rankings-page .table-wrap {
    border: none;
    background: none;
    box-shadow: none;
    border-radius: 0;
    overflow: visible;
  }

  .ranking-table { display: block; }
  .ranking-table thead { display: none; }
  .ranking-table tbody { display: block; }

  .ranking-table tbody tr {
    display: grid;
    grid-template-columns: 44px 1fr auto;
    grid-template-areas:
      "rank  project    avg"
      "rank  members    consensus"
      ".     .          jurors";
    gap: 2px 10px;
    align-items: start;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-bottom: 10px;
    padding: 12px 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .ranking-table tbody tr.ranking-highlight {
    border-left: 3px solid var(--accent);
  }
  .ranking-table tbody tr:hover {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59,130,246,0.10);
  }

  .ranking-table td { display: block; border-bottom: none; padding: 0; }

  /* Hide dynamic criteria columns */
  .ranking-table .heat-cell { display: none; }

  /* Static column placement */
  .ranking-table .col-rank { grid-area: rank; align-self: center; }
  .ranking-table .col-project {
    grid-area: project;
    font-weight: 600;
    font-size: 14px;
    line-height: 1.35;
  }
  .ranking-table .col-students {
    grid-area: members;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .ranking-table .col-avg {
    grid-area: avg;
    text-align: right;
    font-size: 20px;
    font-weight: 700;
    align-self: center;
  }
  .ranking-table .consensus-cell {
    grid-area: consensus;
    text-align: right;
    align-self: center;
  }
  .ranking-table .col-jurors {
    grid-area: jurors;
    text-align: right;
    font-size: 10px;
    color: var(--text-tertiary);
  }
  .ranking-table .col-jurors::before {
    content: "Jurors: ";
  }

  /* Suppress default data-label micro-labels where layout makes them redundant */
  .ranking-table .col-rank::before,
  .ranking-table .col-project::before,
  .ranking-table .col-students::before,
  .ranking-table .col-avg::before,
  .ranking-table .consensus-cell::before { display: none; }
}

/* ── Landscape compact ── */
@media (max-width: 768px) and (orientation: landscape) {
  .ranking-table thead th { padding: 6px 10px; font-size: 10px; }
  .ranking-table tbody td { padding: 5px 10px; font-size: 12px; }
  /* Hide team members and jurors in landscape to reclaim horizontal space */
  .ranking-table .col-students,
  .ranking-table .col-jurors { display: none; }
}
```

- [ ] **Step 4: Verify**

- Portrait: each ranked project is a card with medal/rank badge left, project title + members center, avg score right, consensus badge.
- Top-3 rows have accent left border.
- Landscape: compact table, criteria columns visible, team members/jurors hidden.

---

## Task 5: AuditLogPage — portrait card + landscape

**Files:**
- Modify: `src/admin/pages/AuditLogPage.jsx:642-673`
- Modify: `src/styles/pages/audit-log.css`

- [ ] **Step 1: Add data-label attributes**

In `src/admin/pages/AuditLogPage.jsx`, around line 642, update the `pagedLogs.map()` row:

```jsx
<tr key={log.id} className={actor.type === "system" ? "audit-row-system" : ""}>
  <td className="audit-ts" data-label="Timestamp">
    <div className="audit-ts-main">{ts}</div>
  </td>
  <td data-label="Type">
    <span className={`audit-chip audit-chip-${chip.type}`}>{chip.label}</span>
  </td>
  <td className="audit-actor" data-label="Actor">
    {actor.type === "system" ? (
      <div className="audit-actor-avatar audit-actor-system">
        <Clock size={13} />
      </div>
    ) : (
      <div className={`audit-actor-avatar${actor.type === "juror" ? " audit-actor-juror" : ""}`}>
        {actor.initials}
      </div>
    )}
    <div className="audit-actor-info">
      <div className="audit-actor-name" style={actor.type === "system" ? { color: "var(--text-tertiary)" } : {}}>
        {actor.name}
      </div>
      <div className="audit-actor-role">{actor.role}</div>
    </div>
  </td>
  <td data-label="Action">
    <div className={`audit-action-main${isAuditStaleRefresh ? " opacity-40" : ""}`}>
      {formatActionLabel(log.action)}
    </div>
    {detail && (
      <div className="audit-action-detail">{detail}</div>
    )}
  </td>
</tr>
```

- [ ] **Step 2: Add portrait card + landscape CSS to audit-log.css**

Append at the end of `src/styles/pages/audit-log.css`:
```css
/* ═══════════════════════════════════════════════
   Portrait card layout — ≤768px portrait
   ═══════════════════════════════════════════════ */
@media (max-width: 768px) and (orientation: portrait) {

  .audit-table { display: block; }
  .audit-table thead { display: none; }
  .audit-table tbody { display: block; }

  .audit-table tbody tr {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas:
      "chip    actor"
      "ts      actor"
      "action  action";
    gap: 4px 12px;
    align-items: start;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-bottom: 10px;
    padding: 12px 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .audit-table tbody tr.audit-row-system {
    border-left: 3px solid var(--border-strong, var(--border));
  }
  .audit-table tbody tr:hover {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59,130,246,0.10);
  }

  .audit-table td { display: block; border-bottom: none; padding: 0; }

  .audit-table td[data-label="Type"] { grid-area: chip; align-self: start; }
  .audit-table .audit-ts {
    grid-area: ts;
    font-size: 10px;
    color: var(--text-tertiary);
    align-self: end;
  }
  .audit-table .audit-actor { grid-area: actor; align-self: center; }
  .audit-table td[data-label="Action"] {
    grid-area: action;
    padding-top: 8px;
    border-top: 1px solid var(--border);
    margin-top: 2px;
  }

  /* Suppress data-label ::before (grid placement is self-evident) */
  .audit-table td[data-label]::before { display: none; }
}

/* ── Landscape compact ── */
@media (max-width: 768px) and (orientation: landscape) {
  .audit-table thead th { padding: 6px 10px; font-size: 10px; }
  .audit-table tbody td { padding: 5px 10px; font-size: 12px; }
  /* Hide actor column in landscape — type chip + action carry enough context */
  .audit-table .audit-actor { display: none; }
}
```

- [ ] **Step 3: Verify**

- Portrait: each log entry is a card — type chip top-left, actor top-right, timestamp bottom-left, action full-width at bottom.
- Landscape: compact table with actor column hidden.

---

## Task 6: PinBlockingPage — add table class + portrait card + landscape

**Files:**
- Modify: `src/admin/pages/PinBlockingPage.jsx:131,158-188`
- Modify: `src/styles/pages/pin-lock.css`

- [ ] **Step 1: Add className to the anonymous <table>**

In `src/admin/pages/PinBlockingPage.jsx` at line 131, change:
```jsx
<table>
```
to:
```jsx
<table className="pin-lock-table">
```

- [ ] **Step 2: Add data-label attributes to row <td> elements**

In the `lockedJurors.map((j) => (...))` callback around line 158, replace the `<tr>` and its `<td>` elements:

```jsx
<tr key={j.jurorId}>
  <td data-label="Juror">{j.jurorName || "—"}</td>
  <td data-label="Affiliation">{j.affiliation || "—"}</td>
  <td data-label="Failed Attempts">{j.failedAttempts ?? "—"}</td>
  <td data-label="Lock Started">{formatTime(j.lockedAt)}</td>
  <td data-label="Unlock ETA">{j.isBlocked ? "Permanent" : formatEta(j.lockedUntil)}</td>
  <td data-label="Status">
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "var(--radius-sm)",
        fontSize: 12,
        fontWeight: 600,
        background: j.isBlocked ? "var(--danger-muted, #fee2e2)" : "var(--warning-muted, #fef9c3)",
        color: j.isBlocked ? "var(--danger)" : "var(--warning-fg, #854d0e)",
      }}
    >
      {j.isBlocked ? "Blocked" : "Locked"}
    </span>
  </td>
  <td className="text-right">
    <button
      className="btn btn-outline btn-sm"
      onClick={() => handleUnlock(j.jurorId)}
    >
      Unlock
    </button>
  </td>
</tr>
```

- [ ] **Step 3: Add portrait card + landscape CSS to pin-lock.css**

Append at the end of `src/styles/pages/pin-lock.css`:
```css
/* ═══════════════════════════════════════════════
   Portrait card layout — ≤768px portrait
   ═══════════════════════════════════════════════ */
@media (max-width: 768px) and (orientation: portrait) {

  .pin-lock-table { display: block; }
  .pin-lock-table thead { display: none; }
  .pin-lock-table tbody { display: block; }

  .pin-lock-table tbody tr {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-left: 3px solid var(--warning);
    border-radius: 12px;
    margin-bottom: 10px;
    padding: 12px 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: box-shadow 0.15s;
  }
  .pin-lock-table tbody tr:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }

  .pin-lock-table td { display: block; border-bottom: none; padding: 0; }

  .pin-lock-table td[data-label]::before {
    content: attr(data-label);
    display: block;
    font-size: 8.5px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--text-tertiary);
    font-weight: 600;
    margin-bottom: 2px;
  }

  /* Row 1: Juror name (flex:1) + Status (auto) */
  .pin-lock-table td[data-label="Juror"] {
    flex: 1 1 0;
    min-width: 0;
    font-weight: 600;
    font-size: 14px;
    padding-bottom: 4px;
  }
  .pin-lock-table td[data-label="Juror"]::before { display: none; }

  .pin-lock-table td[data-label="Status"] {
    flex: 0 0 auto;
    text-align: right;
    padding-bottom: 4px;
  }
  .pin-lock-table td[data-label="Status"]::before { display: none; }

  /* Row 2: Affiliation (full width) */
  .pin-lock-table td[data-label="Affiliation"] {
    flex: 0 0 100%;
    font-size: 12px;
    color: var(--text-secondary);
    padding-bottom: 8px;
  }

  /* Row 3: Failed Attempts (left) + Unlock ETA (right) */
  .pin-lock-table td[data-label="Failed Attempts"] {
    flex: 1 1 0;
    font-size: 13px;
    padding-bottom: 4px;
  }
  .pin-lock-table td[data-label="Unlock ETA"] {
    flex: 0 0 auto;
    text-align: right;
    font-size: 13px;
    padding-bottom: 4px;
  }

  /* Row 4: Lock Started (left) + Unlock button (right) */
  .pin-lock-table td[data-label="Lock Started"] {
    flex: 1 1 0;
    font-size: 12px;
    color: var(--text-tertiary);
    padding-top: 4px;
    border-top: 1px solid var(--border);
  }
  .pin-lock-table td.text-right {
    flex: 0 0 auto;
    text-align: right;
    padding-top: 4px;
    border-top: 1px solid var(--border);
  }
}

/* ── Landscape compact ── */
@media (max-width: 768px) and (orientation: landscape) {
  .pin-lock-table thead th { padding: 6px 10px; font-size: 10px; }
  .pin-lock-table tbody td { padding: 5px 10px; font-size: 12px; }
  /* Hide Lock Started in landscape */
  .pin-lock-table td[data-label="Lock Started"],
  .pin-lock-table thead th:nth-child(4) { display: none; }
}
```

- [ ] **Step 4: Verify**

- Portrait: each locked juror is a card with name + status (Blocked/Locked) on row 1, affiliation below, attempt count + ETA, lock timestamp + unlock button.
- Card has warning left border.
- Landscape: compact table without Lock Started column.

---

## Task 7: EntryControlPage — add table class + portrait card + landscape

**Files:**
- Modify: `src/admin/pages/EntryControlPage.jsx:1028,1052-1088`
- Modify: `src/styles/pages/entry-control.css`

- [ ] **Step 1: Add className to anonymous <table> at line 1028**

```jsx
<table className="entry-history-table">
```

- [ ] **Step 2: Add data-label attributes to row <td> elements**

In the `sortedTokenHistory.map((token) => (...))` callback around line 1052, update the `<td>` elements:

```jsx
<tr key={token.id} style={token.is_active ? { background: "var(--accent-soft)" } : undefined}>
  <td className="mono" data-label="Reference ID" style={token.is_active ? { fontWeight: 700, color: "var(--accent)" } : {}}>
    {token.access_id}
  </td>
  <td className="text-sm" data-label="Created" style={{ fontWeight: 500 }}>
    {fmtDate(token.created_at)}
  </td>
  <td className="text-sm" data-label="Expires">
    {fmtDate(token.expires_at)}
  </td>
  <td className="mono" data-label="Sessions" style={{ fontWeight: 600 }}>
    {typeof token.session_count === "number" ? token.session_count : "—"}
  </td>
  <td data-label="Status">
    {/* existing badge JSX unchanged */}
  </td>
  <td className="text-right">
    {/* existing actions JSX unchanged */}
  </td>
</tr>
```

- [ ] **Step 3: Add portrait card + landscape CSS to entry-control.css**

Append at the end of `src/styles/pages/entry-control.css`:
```css
/* ═══════════════════════════════════════════════
   Portrait card layout — ≤768px portrait
   ═══════════════════════════════════════════════ */
@media (max-width: 768px) and (orientation: portrait) {

  .entry-history-table { display: block; }
  .entry-history-table thead { display: none; }
  .entry-history-table tbody { display: block; }

  .entry-history-table tbody tr {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-bottom: 10px;
    padding: 12px 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .entry-history-table tbody tr:hover {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59,130,246,0.10);
  }

  .entry-history-table td { display: block; border-bottom: none; padding: 0; }

  .entry-history-table td[data-label]::before {
    content: attr(data-label);
    display: block;
    font-size: 8.5px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--text-tertiary);
    font-weight: 600;
    margin-bottom: 2px;
  }

  /* Row 1: Reference ID (flex:1) + Status badge (auto) */
  .entry-history-table td[data-label="Reference ID"] {
    flex: 1 1 0;
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
    padding-bottom: 6px;
  }
  .entry-history-table td[data-label="Reference ID"]::before { display: none; }

  .entry-history-table td[data-label="Status"] {
    flex: 0 0 auto;
    text-align: right;
    padding-bottom: 6px;
  }
  .entry-history-table td[data-label="Status"]::before { display: none; }

  /* Row 2: Created (left) + Expires (right) */
  .entry-history-table td[data-label="Created"] {
    flex: 1 1 0;
    font-size: 12px;
    color: var(--text-secondary);
    padding-bottom: 4px;
  }
  .entry-history-table td[data-label="Expires"] {
    flex: 0 0 auto;
    text-align: right;
    font-size: 12px;
    color: var(--text-secondary);
    padding-bottom: 4px;
  }

  /* Row 3: Sessions (left) + Action (right) */
  .entry-history-table td[data-label="Sessions"] {
    flex: 1 1 0;
    font-size: 12px;
    padding-top: 6px;
    border-top: 1px solid var(--border);
  }
  .entry-history-table td.text-right {
    flex: 0 0 auto;
    text-align: right;
    padding-top: 6px;
    border-top: 1px solid var(--border);
  }
}

/* ── Landscape compact ── */
@media (max-width: 768px) and (orientation: landscape) {
  .entry-history-table thead th { padding: 6px 10px; font-size: 10px; }
  .entry-history-table tbody td { padding: 5px 10px; font-size: 12px; }
  /* Hide Expires in landscape */
  .entry-history-table td[data-label="Expires"],
  .entry-history-table thead th:nth-child(3) { display: none; }
}
```

- [ ] **Step 4: Verify**

- Portrait: each token is a card — ref ID + status on row 1, created/expires on row 2, sessions + action button on row 3.
- Active token row retains accent-soft background.
- Landscape: compact table without Expires column.

---

## Task 8: CriteriaPage — portrait card for .crt-table

**Files:**
- Modify: `src/admin/pages/CriteriaPage.jsx:276-320`
- Modify: `src/styles/pages/criteria.css`

- [ ] **Step 1: Add data-label attributes to .crt-table row <td> elements**

In `src/admin/pages/CriteriaPage.jsx`, around line 276 in the `criteriaConfig.map()` callback:

```jsx
<tr key={criterion.key || i}>
  <td data-label="#">
    <span className="crt-row-num">{i + 1}</span>
  </td>
  <td data-label="Criterion">
    <div className="crt-name">{criterion.label || criterion.shortLabel || `Criterion ${i + 1}`}</div>
    {criterion.blurb && (
      <div className="crt-desc">{criterion.blurb}</div>
    )}
  </td>
  <td className="text-center" data-label="Weight">
    <span className="crt-weight-cell">{weight}%</span>
  </td>
  <td className="text-center" data-label="Max Score">
    <span className="crt-max">{criterion.max}</span>
  </td>
  <td data-label="Rubric Bands">
    {rubric.length > 0 ? (
      <div className="crt-rubric-bands">
        {rubric.map((band, bi) => (
          <span key={bi} className={`crt-band-pill ${rubricBandClass(band.level || band.label)}`}>
            {bandRangeText(band) && (
              <span className="crt-band-range">{bandRangeText(band)}</span>
            )}
            {band.level || band.label}
          </span>
        ))}
      </div>
    ) : (
      <span style={{ fontSize: 11.5, color: "var(--text-quaternary)" }}>No rubric defined</span>
    )}
  </td>
  <td>
    {/* existing actions JSX unchanged */}
  </td>
</tr>
```

- [ ] **Step 2: Add portrait card CSS to criteria.css**

Append NEW blocks at the end of `src/styles/pages/criteria.css` (after all existing rules):
```css
/* ═══════════════════════════════════════════════
   Portrait card layout — ≤768px portrait
   ═══════════════════════════════════════════════ */
@media (max-width: 768px) and (orientation: portrait) {

  .crt-table { display: block; }
  .crt-table thead { display: none; }
  .crt-table tbody { display: block; }

  .crt-table tbody tr {
    display: grid;
    grid-template-columns: 28px 1fr 1fr;
    grid-template-areas:
      "num  criterion  criterion"
      "num  weight     max"
      "num  rubric     rubric"
      ".    actions    actions";
    gap: 4px 10px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-bottom: 10px;
    padding: 12px 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .crt-table tbody tr:hover {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59,130,246,0.10);
  }

  .crt-table td { display: block; border-bottom: none; padding: 0; text-align: left; }

  .crt-table td[data-label]::before {
    content: attr(data-label);
    display: block;
    font-size: 8.5px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--text-tertiary);
    font-weight: 600;
    margin-bottom: 2px;
  }

  .crt-table td[data-label="#"] { grid-area: num; align-self: center; text-align: center; }
  .crt-table td[data-label="#"]::before { display: none; }

  .crt-table td[data-label="Criterion"] { grid-area: criterion; }
  .crt-table td[data-label="Criterion"]::before { display: none; }

  .crt-table td[data-label="Weight"] { grid-area: weight; }
  .crt-table td[data-label="Max Score"] { grid-area: max; text-align: right; }

  .crt-table td[data-label="Rubric Bands"] { grid-area: rubric; }
  .crt-table .crt-rubric-bands { flex-wrap: wrap; }

  .crt-table td:last-child {
    grid-area: actions;
    text-align: right;
    padding-top: 8px;
    border-top: 1px solid var(--border);
    margin-top: 4px;
  }
}

/* ── Landscape compact ── */
@media (max-width: 768px) and (orientation: landscape) {
  .crt-table thead th { padding: 6px 10px; font-size: 10px; }
  .crt-table tbody td { padding: 5px 10px; font-size: 12px; }
  /* Collapse rubric bands display in landscape */
  .crt-table .crt-rubric-bands { flex-wrap: nowrap; overflow: hidden; max-width: 140px; }
}
```

- [ ] **Step 3: Verify**

- Portrait: each criterion is a card — row number badge left, criterion name top-right, weight + max below name, rubric band pills, actions row.
- Landscape: compact table.

---

## Task 9: OutcomesPage — portrait card for .acc-table

The outcomes table has an accordion expand pattern — clicking a row expands an inline detail row. Portrait card handles the summary `.acc-row`; the expanded `.acc-detail-row` is a separate `<tr>` that naturally spans full width.

**Files:**
- Modify: `src/admin/pages/OutcomesPage.jsx:127-215` (inside `OutcomeRow` component)
- Modify: `src/styles/pages/outcomes.css`

- [ ] **Step 1: Add data-label attributes to OutcomeRow <td> elements**

In `src/admin/pages/OutcomesPage.jsx`, in the `OutcomeRow` component's `<tr className="acc-row">` around line 121, add data-label to each `<td>`:

```jsx
<tr
  className={`acc-row${isExpanded ? " acc-row-expanded" : ""}`}
  onClick={onToggleExpand}
  style={{ cursor: "pointer" }}
>
  {/* Expand toggle */}
  <td style={{ width: 28, textAlign: "center" }} data-label="expand">
    <button
      className="acc-expand-btn"
      onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
      aria-expanded={isExpanded}
      title={isExpanded ? "Collapse" : "Expand"}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        style={{ width: 12, height: 12, transition: "transform .15s", transform: isExpanded ? "rotate(90deg)" : "none" }}
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  </td>

  {/* Code */}
  <td data-label="Code">
    <span className={`acc-code ${hasMappings ? "mapped" : "unmapped"}`}>{outcome.code}</span>
  </td>

  {/* Outcome label */}
  <td data-label="Outcome">
    <span className="acc-outcome-label">{outcome.label}</span>
  </td>

  {/* Mapped criteria chips */}
  <td data-label="Criteria">
    <div className="acc-chip-wrap">
      {mappedCriteria.map((c) => (
        <span key={c.id} className="acc-chip" data-criterion={c.id} data-outcome={outcome.id}>
          <span className="acc-crit-dot" style={{ background: c.color || "var(--accent)" }} />
          {c.short_label || c.label}
          <span
            className="acc-chip-x"
            onClick={(e) => { e.stopPropagation(); onRemoveChip(c.id, outcome.id); }}
            title="Remove mapping"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </span>
        </span>
      ))}
      {coverage === "indirect" && !hasMappings && (
        <span style={{ fontSize: 10.5, color: "var(--text-quaternary)", fontWeight: 500 }}>Indirect coverage</span>
      )}
      <button
        className="acc-chip-add"
        onClick={(e) => { e.stopPropagation(); onAddMapping(outcome); }}
        title="Map a criterion"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 11, height: 11 }}>
          <path d="M12 5v14M5 12h14" />
        </svg>
        {!hasMappings && coverage !== "indirect" ? "Map criterion" : ""}
      </button>
    </div>
  </td>

  {/* Coverage */}
  <td className="text-center" data-label="Coverage">
    <span
      className={coverageBadgeClass(coverage)}
      onClick={(e) => {
        e.stopPropagation();
        if (coverage !== "direct") onCycleCoverage(outcome.id);
      }}
      title={coverage === "direct" ? "Explicitly assessed by mapped criteria" : "Click to change coverage level"}
    >
      <span className="acc-cov-dot" />
      {coverageLabel(coverage)}
    </span>
  </td>

  {/* Actions */}
  <td style={{ textAlign: "right" }} data-label="Actions">
    <div
      className="row-act-wrap"
      ref={isMenuOpen ? menuRef : null}
      style={{ justifyContent: "center" }}
    >
      {/* existing action menu JSX unchanged */}
    </div>
  </td>
</tr>
```

- [ ] **Step 2: Add portrait card + landscape CSS to outcomes.css**

Append at the end of `src/styles/pages/outcomes.css`:
```css
/* ═══════════════════════════════════════════════
   Portrait card layout — ≤768px portrait
   ═══════════════════════════════════════════════ */
@media (max-width: 768px) and (orientation: portrait) {

  .acc-table { display: block; }
  .acc-table thead { display: none; }
  .acc-table tbody { display: block; }

  /* Summary row as card */
  .acc-table .acc-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-areas:
      "expand  code      coverage"
      "expand  outcome   coverage"
      ".       criteria  actions";
    gap: 4px 10px;
    align-items: start;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-bottom: 4px;
    padding: 12px 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .acc-table .acc-row:hover {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59,130,246,0.10);
  }
  .acc-table .acc-row.acc-row-expanded {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    margin-bottom: 0;
    border-bottom: none;
    box-shadow: none;
  }

  /* Expanded detail row attaches to card bottom */
  .acc-table .acc-detail-row {
    display: block;
    border: 1px solid var(--accent);
    border-top: none;
    border-radius: 0 0 12px 12px;
    margin-bottom: 10px;
    overflow: hidden;
  }
  .acc-table .acc-detail-row > td {
    display: block;
    padding: 0;
    border: none;
  }

  .acc-table td { display: block; border-bottom: none; padding: 0; }

  .acc-table td[data-label="expand"] { grid-area: expand; align-self: center; }
  .acc-table td[data-label="Code"] { grid-area: code; align-self: center; }
  .acc-table td[data-label="Outcome"] {
    grid-area: outcome;
    font-size: 13px;
    line-height: 1.4;
  }
  .acc-table td[data-label="Criteria"] { grid-area: criteria; }
  .acc-table .acc-chip-wrap { flex-wrap: wrap; }
  .acc-table td[data-label="Coverage"] {
    grid-area: coverage;
    align-self: center;
    text-align: right;
  }
  .acc-table td[data-label="Actions"] {
    grid-area: actions;
    text-align: right;
    align-self: end;
  }

  /* Suppress data-label ::before (grid areas self-describe) */
  .acc-table td[data-label]::before { display: none; }
}

/* ── Landscape compact ── */
@media (max-width: 768px) and (orientation: landscape) {
  .acc-table thead th { padding: 6px 10px; font-size: 10px; }
  .acc-table .acc-row td { padding: 5px 10px; font-size: 12px; }
  /* Tighten chip wrapping in landscape */
  .acc-table .acc-chip-wrap { flex-wrap: nowrap; overflow-x: auto; }
}
```

- [ ] **Step 3: Verify**

- Portrait: each outcome row is a card — expand toggle left, code top-center, outcome label center, criteria chips bottom-center, coverage badge top-right, actions bottom-right.
- Expanding a row shows the detail panel attached seamlessly below its card.
- Landscape: compact table with chips scrollable.

---

## Self-Review

**Spec coverage:**

| Page | Portrait cards | Landscape compact | Done in |
|------|---------------|-------------------|---------|
| ReviewsPage | Fix media query scope | Add landscape block | Task 1 |
| ProjectsPage | ✓ | Already in mobile.css | Task 2 |
| PeriodsPage | ✓ | Already in mobile.css | Task 3 |
| RankingsPage | ✓ (criteria hidden) | ✓ | Task 4 |
| AuditLogPage | ✓ | ✓ | Task 5 |
| PinBlockingPage | ✓ | ✓ | Task 6 |
| EntryControlPage | ✓ | ✓ | Task 7 |
| CriteriaPage | ✓ | ✓ | Task 8 |
| OutcomesPage | ✓ (accordion-aware) | ✓ | Task 9 |
| JurorsPage | Already done | Already done | — |
| OrganizationsPage | Already done | Already done | — |

**Placeholder scan:** All code blocks are complete. No TBD, TODO, or "similar to above" references.

**Type consistency:**
- `data-label` strings in JSX match CSS attribute selectors exactly (e.g., `data-label="Reference ID"` → `td[data-label="Reference ID"]`).
- Table class names consistent: `pin-lock-table` used in both JSX and CSS; `entry-history-table` same.
- `col-criteria-th` class added to `<th>` elements in RankingsPage `<thead>` — not referenced in CSS (portrait hides `.heat-cell` td rows directly; landscape hides `.col-students`, `.col-jurors`; the `col-criteria-th` is only needed if future CSS targets those headers, which it doesn't in this plan — safe to omit from CSS).
