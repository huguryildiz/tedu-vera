# Heatmap Mobile Portrait — Mini Matrix (C2) Design

**Date:** 2026-04-28
**Status:** Approved

---

## Goal

Replace the current portrait heatmap (collapsible per-juror cards with sparkline dots) with a compact matrix table that mirrors the desktop layout: jurors as rows, projects as columns, each cell showing a colored background with the score number overlaid in white. This gives admins the same pattern-recognition capability they have on desktop — without requiring portrait-landscape rotation.

---

## Non-Goals

- Landscape mode is already handled (desktop layout via existing `orientation: landscape` media query). No landscape changes.
- No changes to the desktop (≥901px) heatmap.
- No changes to the score color palette, sort logic, or export flow.
- No new backend RPCs — all data already flows through `HeatmapMobileList` props.

---

## Design — C2: Color Cell + Score Number

### Cell anatomy

Each score cell is a fixed-size block:
- **Size:** 34px wide × 28px tall
- **Background:** existing score color band (green 90+, yellow-green 80–89, olive 70–79, amber 60–69, red <60)
- **Content:** bold white score number, 9px, font-weight 800, centered
- **Empty:** transparent background, `—` in muted color (`var(--text-muted)`)
- **Partial:** same color band as scored + `!` superscript in top-right corner of cell

Colors reuse `scoreCellClass` / `scoreCellStyle` from `src/admin/utils/scoreHelpers.js` — identical to desktop.

### Table structure

```
┌─────────────────┬──────────────────────────────────────────────┬───────┐
│ Juror           │  P1   P2   P3   P4   P5   P6  …              │  Avg  │
├─────────────────┼──────────────────────────────────────────────┼───────┤
│ Ali Yılmaz      │  82   74   —    91   68   85  …              │ 80.0  │
│ Serra Kaya      │  79   88   62   —    73   90  …              │ 78.4  │
│  …              │  …                                            │  …    │
├─────────────────┼──────────────────────────────────────────────┼───────┤
│ Avg             │  80   81   62   91   71   88  …              │ 78.8  │
└─────────────────┴──────────────────────────────────────────────┴───────┘
```

- **Juror column (sticky-left):** 120px, shows name (12px 600) + affiliation truncated (10px muted). Frozen so scrolling projects keeps juror context.
- **Project columns:** 34px each, header shows `P1`, `P2` etc. (group_no) in 8px. Full title accessible via `title` attribute.
- **Avg column:** 44px (last column, not sticky), shows juror row average, same color banding as cells.
- **Footer row (tfoot):** project column averages — same color cells, "Avg" label in juror column.
- **Horizontal scroll:** `overflow-x: auto` wrapper; no min-width floor so it naturally fits available width.

### Sort control

Keep the existing `CustomSelect` sort dropdown (from `HeatmapMobileList`) above the table. Options and logic unchanged (`sortMobileJurors` / `MOBILE_SORT_KEYS`).

### Legend

Keep the existing color-band legend (currently rendered by `HeatmapPage` below the matrix) — no changes needed. On portrait it already renders via `HeatmapPage.responsive.css`.

---

## Architecture

### New file: `src/admin/features/heatmap/HeatmapMiniMatrix.jsx`

Pure presentational table component. Props:

```js
{
  sortedJurors,      // array of juror objects (already sorted)
  groups,            // array of project/group objects
  lookup,            // juror.key → group.id → score entry
  activeTab,
  activeCriteria,
  tabMax,
  jurorRowAvgs,      // parallel array to visibleJurors (pre-sorted index map needed)
  visibleAverages,   // per-group averages for tfoot row
  overallAvg,
  getCellDisplay,    // function(entry, activeTab, activeCriteria) → {score, max, partial} | null
}
```

Renders a single `<table>` with `thead`, `tbody`, `tfoot`. No state. No selection model (matrix has no per-row selection UX).

### Modified file: `src/admin/features/heatmap/HeatmapMobileList.jsx`

Replace the `JurorHeatmapCard` list + `useCardSelection` with `HeatmapMiniMatrix`. Keep:
- Import and render `HeatmapMiniMatrix` in place of the card list.
- Keep `CustomSelect` sort dropdown above the matrix.
- Keep `ProjectAveragesCard` removed — tfoot in the matrix replaces it.
- Remove `useCardSelection` (no longer needed).
- Remove `JurorHeatmapCard` import.

### New file: `src/admin/features/heatmap/HeatmapMiniMatrix.css`

Scoped to `.hm-mini-matrix` wrapper. Contains:
- Table base styles (border-collapse, font-size)
- `.hm-mm-juror-col` — sticky-left cell styles
- `.hm-mm-avg-col` — avg column cell styles (last column, not sticky)
- `.hm-mm-cell` — score cell (fixed size, flex center, color via class)
- `.hm-mm-cell-empty` — muted dash
- `.hm-mm-cell-partial` — partial indicator superscript
- `.hm-mm-th-proj` — project header (8px, truncated)
- Dark mode overrides for sticky column backgrounds

No changes to `HeatmapPage.responsive.css` — the existing rule that hides `.matrix-table` and shows `.heatmap-mobile` on portrait already handles visibility.

### Files NOT touched

- `HeatmapPage.jsx` — no changes (props passed to `HeatmapMobileList` are unchanged)
- `HeatmapPage.css` — no changes
- `HeatmapPage.responsive.css` — no changes (portrait show/hide rule still correct)
- `src/styles/layout/portrait-heatmap.css` — no changes
- `scoreHelpers.js` — no changes (reuse `scoreCellClass`, `scoreCellStyle`)
- `useHeatmapData.js`, `useGridSort.js` — no changes

---

## Data Flow

```
HeatmapPage.jsx
  └─ <HeatmapMobileList ... />          (existing props, no changes)
       ├─ CustomSelect (sort)
       └─ <HeatmapMiniMatrix ... />     (new — replaces card list)
            ├─ thead: project columns
            ├─ tbody: juror rows × score cells
            └─ tfoot: project averages
```

`getCellDisplay` already handles the `activeTab` (all vs. specific criterion) logic — the matrix cells call it identically to the desktop table.

---

## Error Handling

- **No jurors:** render the existing empty-state block (already in `HeatmapMobileList`, keep it).
- **No projects:** render table with no data columns — empty thead row, empty tbody.
- **Missing score entry (`getCellDisplay` returns null):** render `hm-mm-cell-empty` (`—`).
- **Partial score:** render with color band + `!` superscript. No tooltip needed (same convention as desktop).

---

## Testing

No new unit tests required — `HeatmapMiniMatrix` is purely presentational with no business logic. The existing tests for `scoreHelpers` cover the color/score calculation. Existing `HeatmapMobileList` tests (if any) must be updated to reflect removal of `JurorHeatmapCard`.

After implementation, manually verify:
1. Portrait 390×844: matrix renders, cells colored, score numbers visible, juror col sticky.
2. Scroll right: projects scroll, juror column stays frozen.
3. Sort dropdown changes row order.
4. Criteria tab switch (All / criterion): cell values update.
5. Empty-score cells show `—`.
6. Dark mode: sticky column backgrounds don't bleed through.
7. Landscape (rotate): desktop table appears (existing behavior unchanged).

---

## Success Criteria

- Portrait heatmap shows a matrix table, not a card list.
- Juror column is sticky-left; projects scroll horizontally.
- Each cell has a colored background matching desktop score bands + bold white score number.
- All existing data (sort, criteria tab, averages) works correctly.
- No regressions in landscape or desktop views.
- `npm run build` clean, `npm test -- --run` passes.
