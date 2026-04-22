# Indirect Assessment — Tooltip & Drawer Banner

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add informative tooltips to coverage badges and contextual banners in the outcome drawer so admins understand what Direct/Indirect/Not Mapped mean and what to do about it.

**Architecture:** Pure UI changes — no backend, no DB, no API. Replace native `title` attributes on coverage badges with the existing `Tooltip` component. Add `FbAlert` banners inside `OutcomeDetailDrawer` based on coverage state.

**Tech Stack:** React, Lucide icons, existing `Tooltip` and `FbAlert` components.

---

### Task 1: Add Tooltip to coverage badges in OutcomesPage

**Files:**
- Modify: `src/admin/pages/OutcomesPage.jsx` (lines 1-7 imports, lines 131-144 badge render)

- [ ] **Step 1: Add Tooltip import**

In `src/admin/pages/OutcomesPage.jsx`, add Tooltip to the imports at the top:

```jsx
import Tooltip from "@/shared/ui/Tooltip";
```

Add it after the existing lucide-react import line (line 6).

- [ ] **Step 2: Create coverage tooltip text helper**

Add this function after the existing `coverageLabel` helper (after line 36):

```jsx
function coverageTooltipText(type) {
  if (type === "direct")
    return "Assessed through mapped evaluation criteria. Attainment is calculated from jury scores.";
  if (type === "indirect")
    return "This outcome is assessed outside VERA through external instruments (surveys, alumni feedback, employer evaluations, etc.). Include results in your self-evaluation report.";
  return "No assessment method assigned. Map criteria for direct assessment, or mark as indirect if assessed externally.";
}
```

- [ ] **Step 3: Wrap coverage badge with Tooltip**

In the `OutcomeRow` component, replace the coverage badge `<td>` (lines 132-144) with:

```jsx
{/* Coverage */}
<td className="text-center" data-label="Coverage">
  <Tooltip text={coverageTooltipText(coverage)} position="top">
    <span
      className={coverageBadgeClass(coverage)}
      onClick={(e) => {
        e.stopPropagation();
        if (coverage !== "direct") onCycleCoverage(outcome.id);
      }}
    >
      <span className="acc-cov-dot" />
      {coverageLabel(coverage)}
    </span>
  </Tooltip>
</td>
```

This removes the native `title` attribute and wraps the badge with the custom `Tooltip` component.

- [ ] **Step 4: Verify in browser**

Run: `npm run dev`

1. Open http://localhost:5173 and navigate to the Outcomes page
2. Hover over a Direct badge — should show "Assessed through mapped evaluation criteria..."
3. Hover over an Indirect badge — should show "This outcome is assessed outside VERA..."
4. Hover over a Not Mapped badge — should show "No assessment method assigned..."
5. Confirm clicking Indirect/Not Mapped badges still cycles coverage
6. Confirm clicking a Direct badge does nothing (no toggle)
7. Tooltip should appear above the badge and auto-reposition if near screen edge

- [ ] **Step 5: Commit**

```bash
git add src/admin/pages/OutcomesPage.jsx
git commit -m "feat(outcomes): add custom tooltips to coverage badges

Replace native title attributes with Tooltip component showing
contextual explanations for Direct, Indirect, and Not Mapped states.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add FbAlert banner in OutcomeDetailDrawer

**Files:**
- Modify: `src/admin/drawers/OutcomeDetailDrawer.jsx` (line 14 imports, lines 177-200 coverage section)

- [ ] **Step 1: Add FbAlert import**

In `src/admin/drawers/OutcomeDetailDrawer.jsx`, add FbAlert to the imports:

```jsx
import FbAlert from "@/shared/ui/FbAlert";
```

Add it after the `InlineError` import (line 19).

- [ ] **Step 2: Add coverage info banner after Coverage Type selector**

After the coverage type selector `<div>` (after line 200, before `</div>` that closes `fs-drawer-body`), add:

```jsx
{/* Coverage guidance banner */}
{coverageType === "indirect" && criterionIds.length === 0 && (
  <FbAlert variant="info" style={{ marginTop: 16 }}>
    This outcome is not directly measured by VERA. It should be assessed through external instruments such as student exit surveys, alumni surveys, or employer evaluations. Include the results in your accreditation self-evaluation report.
  </FbAlert>
)}
{coverageType !== "indirect" && criterionIds.length === 0 && (
  <FbAlert variant="warning" style={{ marginTop: 16 }}>
    No assessment method assigned. You can map evaluation criteria above for direct measurement, or select "Indirect" if this outcome will be assessed through external instruments.
  </FbAlert>
)}
```

Logic:
- **Indirect selected + no criteria:** Info banner explaining external assessment
- **Direct selected + no criteria:** Warning banner suggesting to map criteria or switch to indirect
- **Any selection + criteria mapped:** No banner (criteria list is self-explanatory)

- [ ] **Step 3: Verify in browser**

1. Open an outcome with mapped criteria — no banner should appear
2. Open an outcome with no criteria + Indirect selected — blue info banner appears below Coverage Type
3. Open an outcome with no criteria + Direct selected — amber warning banner appears
4. Toggle coverage type in the drawer — banner should switch between info/warning
5. Add a criterion via chip selection — banner should disappear
6. Remove all criteria — banner reappears based on coverage selection

- [ ] **Step 4: Commit**

```bash
git add src/admin/drawers/OutcomeDetailDrawer.jsx
git commit -m "feat(outcomes): add contextual FbAlert banners in outcome drawer

Show info banner for Indirect outcomes (assess externally) and warning
banner for unmapped outcomes (map criteria or mark indirect).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Clean up remaining native title attributes

**Files:**
- Modify: `src/admin/pages/OutcomesPage.jsx` (lines 112, 124, 153)

- [ ] **Step 1: Replace icon button title attributes with Tooltip**

Three remaining native `title` attributes in `OutcomeRow` need Tooltip wrapping. In `src/admin/pages/OutcomesPage.jsx`:

**Remove chip X button title (line 112):**
Replace `title="Remove mapping"` with nothing — the X icon is self-explanatory inside a chip, and wrapping each tiny X in a Tooltip would be noisy:

```jsx
<span
  className="acc-chip-x"
  onClick={(e) => { e.stopPropagation(); onRemoveChip(c.id, outcome.id); }}
>
  <XCircle size={12} strokeWidth={2.5} />
</span>
```

**Remove "+ Map criterion" button title (line 124):**
The button already has text "+ Map criterion" — remove the redundant `title`:

```jsx
<button
  className="acc-chip-add"
  onClick={(e) => { e.stopPropagation(); onAddMapping(outcome); }}
>
  +{!hasMappings && coverage !== "indirect" ? " Map criterion" : ""}
</button>
```

**Remove "Actions" ⋮ button title (line 153):**
Remove `title="Actions"` — the ⋮ icon is a universal menu indicator:

```jsx
<button
  className="juror-action-btn"
  onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : menuKey); }}
>
  <MoreVertical size={14} />
</button>
```

- [ ] **Step 2: Verify no native title attributes remain in OutcomeRow**

Search the file for `title=` and confirm only the Modal/FbAlert `title` props remain (those are component props, not HTML title attributes).

- [ ] **Step 3: Commit**

```bash
git add src/admin/pages/OutcomesPage.jsx
git commit -m "fix(outcomes): remove native title attributes from icon buttons

Native browser tooltips violate premium SaaS standards. Remove from
chip X, add-mapping, and actions buttons where text/icon is sufficient.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
