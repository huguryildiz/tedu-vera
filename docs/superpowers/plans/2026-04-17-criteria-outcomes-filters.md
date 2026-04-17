# Criteria & Outcomes Filters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the canonical VERA filter theme (FilterButton + filter-panel slide-in) to `CriteriaPage` and `OutcomesPage`, plus clickable KPI strip on `OutcomesPage`.

**Architecture:** Pure UI work. Client-side filtering over already-loaded lists (`draftCriteria`, `fw.outcomes`). Reuse `FilterButton`, `CustomSelect`, and existing `.filter-panel` / `.filter-row` / `.filter-group` CSS from `src/styles/pages/analytics.css`. No RPC/data-layer changes. No new shared components.

**Tech Stack:** React 18, existing admin panel components (`FilterButton`, `CustomSelect`, `FloatingMenu`), Vite build, Vitest for unit checks.

**Reference:** Spec `docs/superpowers/specs/2026-04-17-criteria-outcomes-filters-design.md`.

**Codebase rules to follow:**
- No native `<select>` — always `CustomSelect`. `npm run check:no-native-select` must pass.
- All icons from `lucide-react`; no inline SVG.
- Don't commit or push unless the user explicitly asks.
- Don't run destructive git ops.

---

## File Map

| File | Role |
|---|---|
| `src/admin/pages/CriteriaPage.jsx` | Add filter state, `FilterButton` in card header, `.filter-panel`, rewire pagination & empty-row using `filteredCriteria`. Row actions keep indexing against `draftCriteria`. |
| `src/admin/pages/OutcomesPage.jsx` | Add filter state, `FilterButton` in card header, `.filter-panel`, rewire pagination using `filteredOutcomes`. Make KPI items clickable. |
| `src/styles/pages/outcomes.css` | Add `.scores-kpi-item` clickable affordance (cursor, hover, focus) and `.scores-kpi-item--active` accent state. |

No other files touched.

---

## Task 1 — CriteriaPage: filter state & FilterButton

**Files:**
- Modify: `src/admin/pages/CriteriaPage.jsx`

- [ ] **Step 1: Add imports**

In the existing import block of `CriteriaPage.jsx`, add `FilterButton` and `CustomSelect` next to the current imports. Add `Filter` to the existing `lucide-react` import.

```jsx
import { FilterButton } from "@/shared/ui/FilterButton";
import CustomSelect from "@/shared/ui/CustomSelect";
```

Add `Filter` and `XCircle` to the existing `lucide-react` import line at the top of the file.

- [ ] **Step 2: Add filter state near existing UI state**

Add directly below the existing `const [exportOpen, setExportOpen] = useState(false);` line:

```jsx
const [filterOpen, setFilterOpen] = useState(false);
const [mappingFilter, setMappingFilter] = useState("all");   // all | mapped | unmapped
const [rubricFilter, setRubricFilter] = useState("all");     // all | defined | none
const activeFilterCount =
  (mappingFilter !== "all" ? 1 : 0) + (rubricFilter !== "all" ? 1 : 0);
```

- [ ] **Step 3: Derive filteredCriteria and rewire pagination**

Find the block that computes `totalPages` / `pageRows` (~line 206–208). Replace with:

```jsx
const filteredCriteria = draftCriteria.filter((c) => {
  const hasMapping = Array.isArray(c.outcomes) && c.outcomes.length > 0;
  const hasRubric = Array.isArray(c.rubric) && c.rubric.length > 0;
  if (mappingFilter === "mapped" && !hasMapping) return false;
  if (mappingFilter === "unmapped" && hasMapping) return false;
  if (rubricFilter === "defined" && !hasRubric) return false;
  if (rubricFilter === "none" && hasRubric) return false;
  return true;
});

const totalPages = Math.max(1, Math.ceil(filteredCriteria.length / pageSize));
const safePage = Math.min(currentPage, Math.max(1, totalPages));
const pageRows = filteredCriteria.slice((safePage - 1) * pageSize, safePage * pageSize);
```

Row index math in map callbacks currently does `const i = (safePage - 1) * pageSize + rowIdx;`. That index is an offset into `pageRows` which is now filtered. Replace each such line with a lookup against the unfiltered `draftCriteria`:

```jsx
const i = draftCriteria.indexOf(criterion);
```

There are **two** such occurrences — one in the desktop `tbody` map (`pageRows.map((criterion, rowIdx) => { ... })`), and one in the mobile card list (`pageRows.map((criterion, rowIdx) => { ... })`). Update both. Leave the `key={criterion.key || i}` fallback in place for the mobile list; for the desktop row the `key` can keep its current form.

- [ ] **Step 4: Reset page to 1 when filters change**

Add below the filter state:

```jsx
useEffect(() => {
  setCurrentPage(1);
}, [mappingFilter, rubricFilter]);
```

- [ ] **Step 5: Add FilterButton inside the header actions**

Find the `<div className="crt-header-actions">` block. Insert `FilterButton` as the **first** child (before the existing Export button):

```jsx
<FilterButton
  activeCount={activeFilterCount}
  isOpen={filterOpen}
  onClick={() => { setFilterOpen((v) => !v); setExportOpen(false); }}
/>
```

Also update the existing Export button's onClick to close the filter panel:

```jsx
onClick={() => { setExportOpen((v) => !v); setFilterOpen(false); }}
```

- [ ] **Step 6: Render the filter panel**

Directly **after** the `{exportOpen && <ExportPanel ... />}` block, add:

```jsx
{filterOpen && (
  <div className="filter-panel show">
    <div className="filter-panel-header">
      <div>
        <h4>
          <Filter size={14} style={{ display: "inline", marginRight: 4, opacity: 0.5, verticalAlign: "-1px" }} />
          Filter Criteria
        </h4>
        <div className="filter-panel-sub">Narrow criteria by outcome mapping and rubric state.</div>
      </div>
      <button className="filter-panel-close" onClick={() => setFilterOpen(false)}>&#215;</button>
    </div>
    <div className="filter-row">
      <div className="filter-group">
        <label>Mapping</label>
        <CustomSelect
          compact
          value={mappingFilter}
          onChange={(v) => setMappingFilter(v)}
          options={[
            { value: "all", label: "All mappings" },
            { value: "mapped", label: "Mapped to outcomes" },
            { value: "unmapped", label: "Unmapped" },
          ]}
          ariaLabel="Mapping"
        />
      </div>
      <div className="filter-group">
        <label>Rubric</label>
        <CustomSelect
          compact
          value={rubricFilter}
          onChange={(v) => setRubricFilter(v)}
          options={[
            { value: "all", label: "All rubrics" },
            { value: "defined", label: "Rubric defined" },
            { value: "none", label: "No rubric" },
          ]}
          ariaLabel="Rubric"
        />
      </div>
      <button
        className="btn btn-outline btn-sm filter-clear-btn"
        onClick={() => { setMappingFilter("all"); setRubricFilter("all"); }}
      >
        <XCircle size={12} strokeWidth={2} style={{ opacity: 0.5, verticalAlign: "-1px" }} />
        {" "}Clear all
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 7: Update empty-row message when filtered set is empty**

Find the `pageRows.length === 0 &&` block inside `<tbody>`. Replace its contents with:

```jsx
{pageRows.length === 0 && (
  <tr className="crt-empty-row">
    <td colSpan={6} style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-tertiary)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <ClipboardList size={28} strokeWidth={1.4} style={{ opacity: 0.35 }} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {activeFilterCount > 0 ? "No criteria match the current filter" : "No criteria yet"}
        </span>
        <span style={{ fontSize: 12, opacity: 0.6 }}>
          {activeFilterCount > 0
            ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ marginTop: 6 }}
                onClick={() => { setMappingFilter("all"); setRubricFilter("all"); }}
              >
                Clear filters
              </button>
            )
            : "Click \"+ Add Criterion\" above to add your first criterion."}
        </span>
      </div>
    </td>
  </tr>
)}
```

- [ ] **Step 8: Verify build & lint**

```bash
npm run build
npm run check:no-native-select
```

Expected: both pass with no errors.

- [ ] **Step 9: Manual verification (dev server)**

```bash
npm run dev
```

In the browser, navigate to Admin → Evaluation Criteria with a period that has at least one criterion with outcomes and one without, at least one with a rubric and one without:
1. Click Filter → panel opens; Export closes if open.
2. Set Mapping = "Unmapped" → only criteria without outcome pills remain; filter-badge shows `1`.
3. Set Rubric = "No rubric" → list narrows further; filter-badge shows `2`.
4. Click "Clear all" → both reset to All; filter-badge disappears.
5. With filters producing zero rows, confirm "No criteria match the current filter" with Clear filters button.
6. Confirm pagination resets to page 1 on each filter change.
7. Open the kebab menu on a filtered row and confirm Duplicate / Delete / Move Up / Move Down still target the correct criterion.

- [ ] **Step 10: Stop here — do not commit**

Per CLAUDE.md rules, do not commit or push. Leave the changes staged for the user to review.

---

## Task 2 — OutcomesPage: filter state & FilterButton

**Files:**
- Modify: `src/admin/pages/OutcomesPage.jsx`

- [ ] **Step 1: Add imports**

Add to the existing `lucide-react` import line: `Filter`, `XCircle` (already imported — confirm). Also add:

```jsx
import { FilterButton } from "@/shared/ui/FilterButton";
import CustomSelect from "@/shared/ui/CustomSelect";
```

- [ ] **Step 2: Add filter state below existing UI state**

Below `const [currentPage, setCurrentPage] = useState(1);` add:

```jsx
const [filterOpen, setFilterOpen] = useState(false);
const [coverageFilter, setCoverageFilter] = useState("all"); // all | direct | indirect | none
const [criterionFilter, setCriterionFilter] = useState("all"); // all | <criterionId>
const activeFilterCount =
  (coverageFilter !== "all" ? 1 : 0) + (criterionFilter !== "all" ? 1 : 0);
```

- [ ] **Step 3: Derive filteredOutcomes and rewire pagination**

Find the block:

```jsx
const totalPages = Math.max(1, Math.ceil(sortedOutcomes.length / pageSize));
const safePage = Math.min(currentPage, totalPages);
const pageRows = sortedOutcomes.slice((safePage - 1) * pageSize, safePage * pageSize);
```

Replace with:

```jsx
const filteredOutcomes = sortedOutcomes.filter((o) => {
  const cov = fw.getCoverage(o.id);
  if (coverageFilter !== "all" && cov !== coverageFilter) return false;
  if (criterionFilter !== "all") {
    const mapped = fw.getMappedCriteria(o.id);
    if (!mapped.some((c) => c.id === criterionFilter)) return false;
  }
  return true;
});

const totalPages = Math.max(1, Math.ceil(filteredOutcomes.length / pageSize));
const safePage = Math.min(currentPage, totalPages);
const pageRows = filteredOutcomes.slice((safePage - 1) * pageSize, safePage * pageSize);
```

And update the `<Pagination totalItems={sortedOutcomes.length} ... />` prop to `filteredOutcomes.length`.

- [ ] **Step 4: Reset page on filter change**

Add near the state:

```jsx
useEffect(() => {
  setCurrentPage(1);
}, [coverageFilter, criterionFilter]);
```

- [ ] **Step 5: Add FilterButton in the card header actions**

Find the `<div style={{ display: "flex", alignItems: "center", gap: 8 }}>` inside the outcomes card header (the wrapper around Export + Add Outcome buttons). Insert as the **first** child:

```jsx
<FilterButton
  activeCount={activeFilterCount}
  isOpen={filterOpen}
  onClick={() => { setFilterOpen((v) => !v); setExportOpen(false); }}
/>
```

Update the Export button's onClick to also close the filter panel:

```jsx
onClick={() => { setExportOpen((v) => !v); setFilterOpen(false); }}
```

- [ ] **Step 6: Render the filter panel**

Directly **after** the `{exportOpen && <ExportPanel ... />}` block (which sits inside the outcomes card), add:

```jsx
{filterOpen && (
  <div className="filter-panel show">
    <div className="filter-panel-header">
      <div>
        <h4>
          <Filter size={14} style={{ display: "inline", marginRight: 4, opacity: 0.5, verticalAlign: "-1px" }} />
          Filter Outcomes
        </h4>
        <div className="filter-panel-sub">Narrow outcomes by coverage and mapped criterion.</div>
      </div>
      <button className="filter-panel-close" onClick={() => setFilterOpen(false)}>&#215;</button>
    </div>
    <div className="filter-row">
      <div className="filter-group">
        <label>Coverage</label>
        <CustomSelect
          compact
          value={coverageFilter}
          onChange={(v) => setCoverageFilter(v)}
          options={[
            { value: "all", label: "All coverage" },
            { value: "direct", label: "Direct" },
            { value: "indirect", label: "Indirect" },
            { value: "none", label: "Unmapped" },
          ]}
          ariaLabel="Coverage"
        />
      </div>
      <div className="filter-group">
        <label>Mapped Criterion</label>
        <CustomSelect
          compact
          value={criterionFilter}
          onChange={(v) => setCriterionFilter(v)}
          options={[
            { value: "all", label: "All criteria" },
            ...drawerCriteria.map((c) => ({ value: c.id, label: c.label })),
          ]}
          ariaLabel="Mapped Criterion"
        />
      </div>
      <button
        className="btn btn-outline btn-sm filter-clear-btn"
        onClick={() => { setCoverageFilter("all"); setCriterionFilter("all"); }}
      >
        <XCircle size={12} strokeWidth={2} style={{ opacity: 0.5, verticalAlign: "-1px" }} />
        {" "}Clear all
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 7: Filtered-empty message inside the table**

Find the existing `fw.outcomes.length === 0 ? (... No outcomes defined ...)` branch. The table is only rendered when `fw.outcomes.length > 0`. Between the table's `<tbody>...</tbody>` and the preceding conditional, we need a graceful "no match" row. Insert the following inside `<tbody>` directly above `{pageRows.map(...)}`:

```jsx
{pageRows.length === 0 && (
  <tr>
    <td colSpan={5} style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-tertiary)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <BadgeCheck size={28} strokeWidth={1.4} style={{ opacity: 0.35 }} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>No outcomes match the current filter</span>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          style={{ marginTop: 6 }}
          onClick={() => { setCoverageFilter("all"); setCriterionFilter("all"); }}
        >
          Clear filters
        </button>
      </div>
    </td>
  </tr>
)}
```

- [ ] **Step 8: Build & lint**

```bash
npm run build
npm run check:no-native-select
```

Expected: both pass.

- [ ] **Step 9: Manual verification**

In the browser, with a period that has at least one Direct, one Indirect, and one Unmapped outcome:
1. Click Filter → panel opens; Export closes.
2. Coverage = Direct → table narrows; badge = 1.
3. Mapped Criterion = specific criterion → table narrows to outcomes mapped to that criterion; badge = 2.
4. Clear all → full list restored.
5. With zero matches, see filtered-empty message + Clear filters button.
6. Pagination resets on filter change.

Don't commit.

---

## Task 3 — OutcomesPage: clickable KPI strip

**Files:**
- Modify: `src/admin/pages/OutcomesPage.jsx`
- Modify: `src/styles/pages/outcomes.css`

- [ ] **Step 1: Add CSS for clickable + active state**

Open `src/styles/pages/outcomes.css`. Append at the bottom of the file:

```css
/* ── Clickable KPI strip (coverage filter drilldown) ──────── */
#page-accreditation .scores-kpi-item {
  cursor: pointer;
  transition: background-color .12s, border-color .12s, box-shadow .12s, transform .08s;
  outline: none;
}
#page-accreditation .scores-kpi-item:hover {
  background: var(--surface-1);
}
#page-accreditation .scores-kpi-item:focus-visible {
  box-shadow: 0 0 0 2px var(--accent-soft, rgba(79, 70, 229, 0.25));
}
#page-accreditation .scores-kpi-item--active {
  border-color: var(--accent);
  box-shadow: inset 0 2px 0 var(--accent);
  background: var(--surface-1);
}
```

- [ ] **Step 2: Wire click + keyboard + active state in JSX**

Find the `{/* KPI strip */}` block. Rewrite the four items to be buttons with click handlers:

```jsx
{/* KPI strip */}
<div className="scores-kpi-strip">
  <div
    className={`scores-kpi-item${coverageFilter === "all" ? " scores-kpi-item--active" : ""}`}
    role="button"
    tabIndex={0}
    onClick={() => { setCoverageFilter("all"); }}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCoverageFilter("all"); } }}
  >
    <div className="scores-kpi-item-value">{totalOutcomes}</div>
    <div className="scores-kpi-item-label">Total Outcomes</div>
  </div>
  <div
    className={`scores-kpi-item${coverageFilter === "direct" ? " scores-kpi-item--active" : ""}`}
    role="button"
    tabIndex={0}
    onClick={() => { setCoverageFilter("direct"); setFilterOpen(true); setExportOpen(false); }}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCoverageFilter("direct"); setFilterOpen(true); setExportOpen(false); } }}
  >
    <div className="scores-kpi-item-value success">{directCount}</div>
    <div className="scores-kpi-item-label">Direct</div>
  </div>
  <div
    className={`scores-kpi-item${coverageFilter === "indirect" ? " scores-kpi-item--active" : ""}`}
    role="button"
    tabIndex={0}
    onClick={() => { setCoverageFilter("indirect"); setFilterOpen(true); setExportOpen(false); }}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCoverageFilter("indirect"); setFilterOpen(true); setExportOpen(false); } }}
  >
    <div className="scores-kpi-item-value warning">{indirectCount}</div>
    <div className="scores-kpi-item-label">Indirect</div>
  </div>
  <div
    className={`scores-kpi-item${coverageFilter === "none" ? " scores-kpi-item--active" : ""}`}
    role="button"
    tabIndex={0}
    onClick={() => { setCoverageFilter("none"); setFilterOpen(true); setExportOpen(false); }}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCoverageFilter("none"); setFilterOpen(true); setExportOpen(false); } }}
  >
    <div className="scores-kpi-item-value muted">{unmappedCount}</div>
    <div className="scores-kpi-item-label">Unmapped</div>
  </div>
</div>
```

Clicking `Total Outcomes` resets to All but does NOT auto-open the panel (symmetric: "reset" is not a drilldown). Clicking Direct / Indirect / Unmapped sets the coverage filter AND opens the panel so the badge + dropdown state is immediately visible.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: passes.

- [ ] **Step 4: Manual verification**

1. Hover each KPI item → background tint, cursor pointer.
2. Focus via Tab → focus ring visible.
3. Click Direct → coverage filter = direct, filter panel opens, Direct KPI has accent top border.
4. Click Total Outcomes → filter resets, Total Outcomes highlighted, panel remains in prior state.
5. Change coverage via the dropdown → the corresponding KPI highlight follows.
6. Light mode + dark mode both render correctly (accent variables work in both).

Don't commit.

---

## Task 4 — Final verification & handoff

- [ ] **Step 1: Run the full check suite**

```bash
npm run build
npm run check:no-native-select
npm test -- --run
```

Expected: all green. If `npm test` surfaces regressions unrelated to this work, note them but do not fix in this plan.

- [ ] **Step 2: Cross-page smoke**

In dev server:
1. CriteriaPage: filters work, row actions unaffected, SaveBar still shows correct totals.
2. OutcomesPage: filters work, KPI drilldown works, advisory banner still based on full set, coverage progress bar unchanged.
3. Switch between CriteriaPage and OutcomesPage several times — filter state resets on unmount (local `useState`).
4. Lock the period — filters remain functional, rows become non-editable as before.

- [ ] **Step 3: Report to user**

Summarize: which files changed, screenshots or brief walkthrough of each filter, note that no commit has been made. Await commit instruction.

---

## Notes

- **No tests added.** Existing filter implementations on JurorsPage/ProjectsPage have no unit tests; these filters are pure presentational derivations over already-loaded state. Manual verification against the dev server is the authoritative gate per user preference (see `feedback_verify_against_live.md`).
- **No qa-catalog entry** required for this work (no `qaTest()` tests).
- **No CSS duplication.** `.filter-panel`, `.filter-row`, `.filter-group`, `.filter-badge`, `.filter-clear-btn` are already defined in `src/styles/pages/analytics.css` and `src/styles/components.css` and render correctly inside any card.
- **Index math caveat (Criteria).** `draftCriteria.indexOf(criterion)` is O(n) per row; with typical 3–8 criteria this is trivial. Do not pre-build a Map for this scale.
