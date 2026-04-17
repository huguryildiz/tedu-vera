# Criteria & Outcomes Page Filters — Design

**Date:** 2026-04-17
**Scope:** Add the canonical VERA filter theme (toolbar `FilterButton` + `filter-panel` slide-in) to Evaluation Criteria and Outcomes & Mapping admin pages.

---

## Goal

Both pages currently have no filtering. Admins configuring a period before an evaluation need to quickly answer:

- **Criteria:** Which criteria are still missing outcome mappings or rubric bands?
- **Outcomes:** Which outcomes are Direct / Indirect / Unmapped? Which outcomes does criterion X contribute to?

Reuse the existing filter theme (`FilterButton`, `filter-panel show`, `filter-row`, `filter-group` + `CustomSelect`) from `JurorsPage`/`ProjectsPage` so both pages feel consistent with the rest of the admin panel.

## Out of Scope

- No search input. Both pages have small datasets (typical 3–8 criteria, 8–15 outcomes); a filter panel is sufficient.
- No new shared components. Reuse `FilterButton`, `CustomSelect`, and existing CSS in `src/styles/pages/analytics.css` (`.filter-panel`, `.filter-row`, `.filter-group`).
- No changes to data hooks or RPCs — filtering is purely client-side over the already-loaded list.

---

## Criteria Page

### Toolbar placement

Inside the existing `.crt-table-card-header .crt-header-actions` group (where `Export` and `Add Criterion` live), add `FilterButton` **to the left of** the Export button:

```
[ Export ]  →  [ Filter ] [ Export ] [ Add Criterion ]
```

`activeCount` prop = number of non-`"all"` filter values.

### Panel placement

When `filterOpen` is true, render `<div className="filter-panel show">` **between the card header and the table** (same pattern JurorsPage uses: panel sits directly below the toolbar). When the export panel opens, the filter panel closes, and vice versa — single-open invariant.

### Filter fields

Two `CustomSelect` dropdowns:

| Field | Options | Semantics |
|---|---|---|
| **Mapping** | All mappings / Mapped to outcomes / Unmapped | `criterion.outcomes?.length > 0` → mapped |
| **Rubric** | All / Rubric defined / No rubric | `Array.isArray(criterion.rubric) && criterion.rubric.length > 0` |

Plus the standard `Clear all` button (resets both to `all`).

### Filtered derivation

```
filteredCriteria = draftCriteria.filter(c => {
  if (mappingFilter === "mapped" && !(c.outcomes?.length > 0)) return false;
  if (mappingFilter === "unmapped" && c.outcomes?.length > 0) return false;
  if (rubricFilter === "defined" && !(c.rubric?.length > 0)) return false;
  if (rubricFilter === "none" && c.rubric?.length > 0) return false;
  return true;
})
```

`filteredCriteria` replaces `draftCriteria` as the input for:
- Pagination (`totalPages`, `pageRows`)
- The mobile card list
- The empty row fallback (show a filtered-empty message when filters active but list empty)

`draftCriteria` stays the source of truth for:
- Weight budget bar (totals always reflect the whole set)
- `SaveBar` dirty state, draft total
- Kebab row-action index math

`handleDeleteConfirm`, `handleDuplicate`, `handleMove`, and `handleWeightChange` must resolve their index against the unfiltered `draftCriteria`, not the filtered view — use `criterion.key` or a direct reference lookup when iterating filtered rows.

### Interaction with lock

When `isLocked`, the filter button remains visible and functional. Filtering is read-only and safe while locked.

### Empty-state interaction

If filters produce zero rows but `draftCriteria.length > 0`, replace the "No criteria yet" placeholder in the table body with `"No criteria match the current filter."` plus a small `Clear filters` link. The empty-state card (shown when `draftCriteria.length === 0`) is unaffected — filters render only when the table card is visible.

---

## Outcomes Page

### Toolbar placement

Inside `.card .card-header` actions (where `Export` and `Add Outcome` live), insert `FilterButton` **to the left of** Export. Same single-open invariant vs. Export panel.

### Panel placement

`filter-panel show` slides in **below the card header and above the outcomes table**. Appears inside the card (between the card header and `.table-wrap`) so it sits below the KPI strip and advisory banner — those belong to the page, not the table.

### Filter fields

Two `CustomSelect` dropdowns:

| Field | Options | Semantics |
|---|---|---|
| **Coverage** | All / Direct / Indirect / Unmapped | `fw.getCoverage(outcome.id)` returns one of `"direct" \| "indirect" \| "none"` (map `Unmapped` → `"none"`) |
| **Mapped Criterion** | All criteria / *[each criterion from `fw.criteria`]* | Outcome passes if any of `fw.getMappedCriteria(outcome.id)` has `id === criterionFilter` |

Plus `Clear all`.

### KPI strip interaction (premium touch)

Make the four KPI cards in `.scores-kpi-strip` clickable:

- Click `Total Outcomes` → clear coverage filter (set to `all`).
- Click `Direct` / `Indirect` / `Unmapped` → set coverage filter to that value, and open the filter panel if closed.
- The currently active KPI gets an `.scores-kpi-item--active` class that draws an accent top-border + subtle accent background-tint. When coverage is `all`, no KPI is highlighted (or `Total Outcomes` is).
- `cursor: pointer` on KPI items; `title`/tooltip not needed — label is self-explanatory.
- Keyboard: KPI items become `role="button" tabIndex={0}` and respond to Enter/Space.

This gives admins a one-click drilldown from the overview to the filtered row set — no UI element is wasted and the filter button's `activeCount` badge mirrors the same state.

### Filtered derivation

```
filteredOutcomes = sortedOutcomes.filter(o => {
  const cov = fw.getCoverage(o.id);
  if (coverageFilter !== "all" && cov !== coverageFilter) return false;
  if (criterionFilter !== "all") {
    const mapped = fw.getMappedCriteria(o.id);
    if (!mapped.some(c => c.id === criterionFilter)) return false;
  }
  return true;
})
```

`filteredOutcomes` feeds pagination and row render. The **KPI counts keep reflecting the full set** (they are the chooser itself — if they shrank when clicked, the UI would eat its own tail).

The advisory `FbAlert` about "Incomplete outcome coverage" is period-wide guidance and also stays based on the full set.

### Empty-state interaction

If filters produce zero rows but `fw.outcomes.length > 0`, replace the `No outcomes defined` block with a filtered-empty message plus `Clear filters`.

---

## Shared behavior

1. **Single-open invariant.** Opening Filter closes Export, and vice versa. Match the existing `onClick={() => { setFilterOpen(v => !v); setExportOpen(false); }}` pattern.
2. **Active count badge.** `FilterButton activeCount` = number of non-`all` filter fields. Matches JurorsPage semantics.
3. **Pagination reset.** `useEffect(() => { setCurrentPage(1); }, [<filter state>])` on each page to avoid landing on an empty page after filter change.
4. **Clear all.** Resets every dropdown to `all` — does not close the panel.
5. **Persistence.** Filter state is local `useState`. No localStorage persistence, same as JurorsPage/ProjectsPage filters.
6. **Locked period.** Filtering is read-only and stays enabled when `isLocked`.

---

## Files touched

- `src/admin/pages/CriteriaPage.jsx` — add filter state, derive `filteredCriteria`, render `FilterButton` + `filter-panel`, rewire pagination/empty-row to use filtered list, keep row-action index math on unfiltered list.
- `src/admin/pages/OutcomesPage.jsx` — add filter state, derive `filteredOutcomes`, render `FilterButton` + `filter-panel`, make KPI strip items clickable with active class, rewire pagination/empty-row to use filtered list.
- `src/styles/pages/outcomes.css` — add `.scores-kpi-item` clickable affordance (cursor, hover, focus ring) and `.scores-kpi-item--active` accent state.
- `src/styles/pages/criteria.css` — add nothing new if the stock `.filter-panel` inside a card already renders well; add a small padding/spacing override only if layout inspection reveals a gap problem.

No new CSS selectors for the filter panel itself — `.filter-panel`, `.filter-row`, `.filter-group`, `.filter-clear-btn`, `.filter-badge` already exist in `src/styles/pages/analytics.css` and `src/styles/components.css`.

## Verification

- Open each page; confirm `FilterButton` appears next to Export with the same visual weight.
- Select each filter value and confirm the table, mobile card list (Criteria), and pagination react correctly.
- Confirm the "active count" badge updates and Clear all resets to zero.
- On OutcomesPage, click each KPI card → Coverage filter updates, panel opens, badge updates, active KPI is highlighted.
- Lock a period and confirm filters still work (rows just aren't editable).
- With zero matching rows, confirm the filtered-empty message with Clear filters appears.
