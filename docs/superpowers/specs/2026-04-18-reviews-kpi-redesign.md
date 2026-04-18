# Reviews KPI Strip Redesign

**Date:** 2026-04-18
**Scope:** `src/admin/pages/ReviewsPage.jsx` — KPI strip only

---

## Problem

The current 5 KPI cards (Reviews, Jurors, Projects, Partial, Avg Score) are count-heavy and low-signal. "Jurors" and "Projects" duplicate information already visible in filter dropdowns; "Partial" is a subset of status that belongs in the table, not the strip; "Avg Score" mirrors what Overview and Rankings already show. None of the cards surface actionable state unique to the Reviews page.

---

## Solution

Replace the 5 cards with a new set that emphasizes completion status, pending actions, and inter-juror agreement — signals unique to the row-level granularity of this page.

---

## New KPI Cards

| # | Value | Label | Color rule |
|---|-------|-------|------------|
| 1 | Total review row count | Reviews | — |
| 2 | `X / Y` (completed / assigned jurors) | Completed | Green when X === Y && Y > 0; orange when X/Y < 0.5; default otherwise |
| 3 | Count of `ready_to_submit` jurors | Pending Submit | Orange text when count > 0 |
| 4 | `Δ X.X` (avg inter-juror σ across projects) | Juror Agreement | — (show `—` when insufficient data) |
| 5 | Avg total score (completed jurors only) | Avg Score | — (show `—` when no data) |

---

## Calculation Details

### Card 1 — Reviews
`kpiBase.length` — unchanged.

### Card 2 — Completed (Coverage)
- Numerator: unique juror IDs in `kpiBase` where `jurorStatus === 'completed'`
- Denominator: total assigned jurors from `assignedJurors || jurors` array
- Display: `"X / Y"` string in the value slot; `"—"` if Y === 0

### Card 3 — Pending Submit
- Count of unique juror IDs in `kpiBase` where `jurorStatus === 'ready_to_submit'`
- Color: `var(--warning)` when count > 0

### Card 4 — Juror Agreement (Δ Spread)
- Group `kpiBase` rows by `projectId` (or `title` as fallback)
- For each project: collect total scores of rows where `jurorStatus === 'completed'` and `total != null`
- If a project has ≥ 2 scores: compute population σ = `sqrt(mean of squared deviations from mean)`
- Average σ across all qualifying projects
- Display: `"Δ " + avg.toFixed(1)` — e.g. `Δ 4.2`
- Display `"—"` if no project has ≥ 2 completed jurors

### Card 5 — Avg Score
- Same as current: mean of `total` for rows where `jurorStatus === 'completed'` and total is finite
- Unchanged logic, just moved from card 5 position

---

## Markup

Existing `scores-kpi-item / scores-kpi-item-value / scores-kpi-item-label` CSS classes are reused unchanged. The value slot accepts strings like `"X / Y"` or `"Δ 4.2"` without any new CSS.

Color overrides are inline `style={{ color: ... }}` conditionals on the value element, matching the existing Partial card pattern.

---

## File Changes

- **`src/admin/pages/ReviewsPage.jsx`**
  - Lines ~313–325: replace `partialCount`, `uniqueJurors`, `uniqueProjects` derivations with `completedJurors`, `assignedTotal`, `pendingCount`, `avgSpread`
  - Lines ~492–516: replace JSX for 5 KPI cards with new cards

No other files change.

---

## Out of Scope

- KPI strip CSS changes
- Mobile card layout
- Filter panel
- Export logic
