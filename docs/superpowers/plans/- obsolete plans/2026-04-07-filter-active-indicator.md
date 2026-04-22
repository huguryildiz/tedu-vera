# Filter Active Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a count badge to every admin Filter button so users can see how many filters are active even when the filter panel is closed.

**Architecture:** A single shared `FilterButton` component encapsulates the badge logic. Each of the 6 admin pages computes a local `activeFilterCount` and passes it as a prop. The existing `.filter-badge` CSS rule moves from `reviews.css` to `components.css` to become global.

**Tech Stack:** React, lucide-react (`Filter` icon), vitest + @testing-library/react, existing `.btn.btn-outline.btn-sm` + `.filter-badge` CSS classes.

---

## File Map

| Action | File | What changes |
|---|---|---|
| Create | `src/shared/ui/FilterButton.jsx` | New shared component |
| Create | `src/shared/__tests__/FilterButton.test.jsx` | Component tests |
| Modify | `src/styles/components.css` | Add `.filter-badge` rule |
| Modify | `src/styles/pages/reviews.css` | Remove `.filter-badge` rule (moved) |
| Modify | `src/test/qa-catalog.json` | Add 4 test IDs |
| Modify | `src/admin/pages/ReviewsPage.jsx` | Use FilterButton |
| Modify | `src/admin/pages/RankingsPage.jsx` | Use FilterButton + add count |
| Modify | `src/admin/pages/JurorsPage.jsx` | Use FilterButton + add count |
| Modify | `src/admin/pages/ProjectsPage.jsx` | Use FilterButton |
| Modify | `src/admin/pages/AuditLogPage.jsx` | Use FilterButton + add count |
| Modify | `src/admin/pages/PeriodsPage.jsx` | Use FilterButton + add count |

---

## Task 1: Add qa-catalog entries

**Files:**
- Modify: `src/test/qa-catalog.json`

- [ ] **Step 1: Add 4 test IDs to qa-catalog.json**

Open `src/test/qa-catalog.json`. The file is a JSON array. Append these 4 objects before the closing `]`:

```json
  {
    "id": "ui.filter-btn.01",
    "module": "Shared UI",
    "area": "FilterButton",
    "story": "Badge visibility",
    "scenario": "renders without badge when activeCount is 0",
    "whyItMatters": "Badge must not appear when no filters are active.",
    "risk": "False positive indicator would confuse users.",
    "coverageStrength": "High",
    "severity": "normal"
  },
  {
    "id": "ui.filter-btn.02",
    "module": "Shared UI",
    "area": "FilterButton",
    "story": "Badge visibility",
    "scenario": "renders badge with correct count when activeCount > 0",
    "whyItMatters": "Users must see how many filters are active at a glance.",
    "risk": "Missing badge means users don't know filters are set.",
    "coverageStrength": "High",
    "severity": "normal"
  },
  {
    "id": "ui.filter-btn.03",
    "module": "Shared UI",
    "area": "FilterButton",
    "story": "Panel open state",
    "scenario": "has active class when isOpen is true",
    "whyItMatters": "Button must visually indicate the filter panel is open.",
    "risk": "Missing active state breaks the open/closed affordance.",
    "coverageStrength": "High",
    "severity": "normal"
  },
  {
    "id": "ui.filter-btn.04",
    "module": "Shared UI",
    "area": "FilterButton",
    "story": "Interaction",
    "scenario": "calls onClick when clicked",
    "whyItMatters": "Button must fire its handler to toggle the panel.",
    "risk": "Silent click break would make the filter inaccessible.",
    "coverageStrength": "High",
    "severity": "normal"
  }
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('src/test/qa-catalog.json','utf8')); console.log('valid')"
```

Expected: `valid`

---

## Task 2: Write failing FilterButton tests

**Files:**
- Create: `src/shared/__tests__/FilterButton.test.jsx`

- [ ] **Step 1: Create the test file**

```jsx
// src/shared/__tests__/FilterButton.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterButton } from "../ui/FilterButton.jsx";
import { qaTest } from "../../test/qaTest.js";

describe("FilterButton", () => {
  qaTest("ui.filter-btn.01", () => {
    render(<FilterButton activeCount={0} isOpen={false} onClick={() => {}} />);
    expect(screen.queryByText(/^\d+$/)).toBeNull();
  });

  qaTest("ui.filter-btn.02", () => {
    render(<FilterButton activeCount={3} isOpen={false} onClick={() => {}} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("3").className).toContain("filter-badge");
  });

  qaTest("ui.filter-btn.03", () => {
    render(<FilterButton activeCount={0} isOpen={true} onClick={() => {}} />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("active");
  });

  qaTest("ui.filter-btn.04", () => {
    const handler = vi.fn();
    render(<FilterButton activeCount={0} isOpen={false} onClick={handler} />);
    fireEvent.click(screen.getByRole("button"));
    expect(handler).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- --run src/shared/__tests__/FilterButton.test.jsx
```

Expected: FAIL — `Cannot find module '../ui/FilterButton.jsx'`

---

## Task 3: Create FilterButton component

**Files:**
- Create: `src/shared/ui/FilterButton.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/shared/ui/FilterButton.jsx
import { Filter } from "lucide-react";

export function FilterButton({ activeCount = 0, isOpen = false, onClick }) {
  return (
    <button
      type="button"
      className={`btn btn-outline btn-sm${isOpen ? " active" : ""}`}
      onClick={onClick}
    >
      <Filter size={14} style={{ verticalAlign: "-1px" }} />
      {" "}Filter
      {activeCount > 0 && (
        <span className="filter-badge">{activeCount}</span>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Run tests — verify they pass**

```bash
npm test -- --run src/shared/__tests__/FilterButton.test.jsx
```

Expected: 4 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/shared/ui/FilterButton.jsx src/shared/__tests__/FilterButton.test.jsx src/test/qa-catalog.json
git commit -m "feat(ui): add FilterButton shared component with active count badge"
```

---

## Task 4: Move .filter-badge CSS to components.css

**Files:**
- Modify: `src/styles/pages/reviews.css` (remove rule at line ~130)
- Modify: `src/styles/components.css` (add rule)

- [ ] **Step 1: Remove `.filter-badge` from reviews.css**

Find and delete this block from `src/styles/pages/reviews.css` (around line 129–144):

```css
/* ── Filter badge on Filter button ───────────────────────────── */
.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  margin-left: 4px;
  padding: 0 4px;
  line-height: 1;
}
```

- [ ] **Step 2: Add `.filter-badge` to components.css**

Find the section in `src/styles/components.css` that contains other shared button/badge utilities (search for `/* ──` comment blocks). Append after the last relevant block:

```css
/* ── Filter badge on Filter button ──────────────────────────── */
.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  margin-left: 4px;
  padding: 0 4px;
  line-height: 1;
}
```

- [ ] **Step 3: Run dev server and visually verify Reviews page badge still appears**

```bash
npm run dev
```

Open the Reviews page, apply a filter — the badge count must still render correctly.

- [ ] **Step 4: Commit**

```bash
git add src/styles/pages/reviews.css src/styles/components.css
git commit -m "refactor(css): move .filter-badge to components.css for global use"
```

---

## Task 5: Update ReviewsPage

**Files:**
- Modify: `src/admin/pages/ReviewsPage.jsx`

The Reviews page already has the correct badge behavior — this task replaces the inline button with `FilterButton` for consistency.

- [ ] **Step 1: Add FilterButton import**

Find the existing imports at the top of `src/admin/pages/ReviewsPage.jsx`. Add:

```js
import { FilterButton } from "../../shared/ui/FilterButton.jsx";
```

- [ ] **Step 2: Remove the lucide-react Filter import (if only used for the button)**

Find the import line:
```js
import { Filter, ... } from "lucide-react";
```

Remove `Filter` from that import if it is only used for the filter button. If it appears elsewhere in the file, leave it.

- [ ] **Step 3: Replace inline filter button with FilterButton**

Find this block (around line 398–408):

```jsx
<button
  type="button"
  className={`btn btn-outline btn-sm${showFilter ? " active" : ""}`}
  onClick={() => { setShowFilter((v) => !v); setShowExport(false); }}
>
  <Filter size={14} style={{ verticalAlign: "-1px" }} />
  Filter
  {activeFilterCount > 0 && (
    <span className="filter-badge">{activeFilterCount}</span>
  )}
</button>
```

Replace with:

```jsx
<FilterButton
  activeCount={activeFilterCount}
  isOpen={showFilter}
  onClick={() => { setShowFilter((v) => !v); setShowExport(false); }}
/>
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --run
```

Expected: all tests pass (no regressions)

- [ ] **Step 5: Commit**

```bash
git add src/admin/pages/ReviewsPage.jsx
git commit -m "refactor(reviews): use FilterButton component"
```

---

## Task 6: Update RankingsPage

**Files:**
- Modify: `src/admin/pages/RankingsPage.jsx`

- [ ] **Step 1: Add FilterButton import**

At the top of `src/admin/pages/RankingsPage.jsx`, add:

```js
import { FilterButton } from "../../shared/ui/FilterButton.jsx";
```

- [ ] **Step 2: Add active count computation**

Find the block of `useState` declarations (around line 236–246). After them, add:

```js
const activeFilterCount =
  (searchText ? 1 : 0) +
  (consensusFilter !== "all" ? 1 : 0) +
  (minAvg !== "" || maxAvg !== "" ? 1 : 0) +
  (criterionFilter !== "all" ? 1 : 0);
```

- [ ] **Step 3: Remove the FilterIcon component**

Find and delete the `FilterIcon` component definition near the top of the file (it is an inline SVG arrow/funnel component used only for the filter button).

- [ ] **Step 4: Replace inline filter button with FilterButton**

Find this block (around line 488–493):

```jsx
<button
  className={`btn btn-outline btn-sm${filterPanelOpen ? " active" : ""}`}
  onClick={() => setFilterPanelOpen((o) => !o)}
>
  <FilterIcon /> Filter
</button>
```

Replace with:

```jsx
<FilterButton
  activeCount={activeFilterCount}
  isOpen={filterPanelOpen}
  onClick={() => setFilterPanelOpen((o) => !o)}
/>
```

- [ ] **Step 5: Run tests**

```bash
npm test -- --run
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/admin/pages/RankingsPage.jsx
git commit -m "feat(rankings): show active filter count badge on Filter button"
```

---

## Task 7: Update JurorsPage

**Files:**
- Modify: `src/admin/pages/JurorsPage.jsx`

- [ ] **Step 1: Add FilterButton import**

```js
import { FilterButton } from "../../shared/ui/FilterButton.jsx";
```

- [ ] **Step 2: Add active count computation**

Find the `useState` declarations for `statusFilter` and `affilFilter` (around line 186–189). After them, add:

```js
const activeFilterCount =
  (statusFilter !== "all" ? 1 : 0) +
  (affilFilter !== "all" ? 1 : 0);
```

- [ ] **Step 3: Replace inline filter button with FilterButton**

Find this block (around line 465–470):

```jsx
<button className="btn btn-outline btn-sm" onClick={() => { setFilterOpen((v) => !v); setExportOpen(false); }}>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px" }}>
    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
  </svg>
  {" "}Filter
</button>
```

Replace with:

```jsx
<FilterButton
  activeCount={activeFilterCount}
  isOpen={filterOpen}
  onClick={() => { setFilterOpen((v) => !v); setExportOpen(false); }}
/>
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --run
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/admin/pages/JurorsPage.jsx
git commit -m "feat(jurors): show active filter count badge on Filter button"
```

---

## Task 8: Update ProjectsPage

**Files:**
- Modify: `src/admin/pages/ProjectsPage.jsx`

Note: The filter panel for Projects is currently empty (no filter fields). `activeCount` will always be 0. The improvement here is: (1) consistent component, (2) the button now gets the `.active` class when the panel is open (currently missing).

- [ ] **Step 1: Add FilterButton import**

```js
import { FilterButton } from "../../shared/ui/FilterButton.jsx";
```

- [ ] **Step 2: Replace inline filter button with FilterButton**

Find this block (around line 254–259):

```jsx
<button className="btn btn-outline btn-sm" onClick={() => { setFilterOpen((v) => !v); setExportOpen(false); }}>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px" }}>
    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
  </svg>
  {" "}Filter
</button>
```

Replace with:

```jsx
<FilterButton
  activeCount={0}
  isOpen={filterOpen}
  onClick={() => { setFilterOpen((v) => !v); setExportOpen(false); }}
/>
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --run
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/admin/pages/ProjectsPage.jsx
git commit -m "refactor(projects): use FilterButton component, add panel open indicator"
```

---

## Task 9: Update AuditLogPage

**Files:**
- Modify: `src/admin/pages/AuditLogPage.jsx`

- [ ] **Step 1: Add FilterButton import**

```js
import { FilterButton } from "../../shared/ui/FilterButton.jsx";
```

- [ ] **Step 2: Add active count computation**

Find where `hasAuditFilters` is destructured from `useAuditLogFilters` (around line 66). After that destructure, add:

```js
const auditActiveFilterCount =
  (auditSearch?.trim() ? 1 : 0) +
  (auditFilters?.startDate ? 1 : 0) +
  (auditFilters?.endDate ? 1 : 0);
```

- [ ] **Step 3: Replace inline filter button with FilterButton**

Find this block (around line 176–185):

```jsx
<button
  className={`btn btn-outline btn-sm${filterOpen ? " active" : ""}`}
  type="button"
  onClick={() => { setFilterOpen((v) => !v); setExportOpen(false); }}
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: -1 }}>
    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
  </svg>
  Filter{hasAuditFilters ? " •" : ""}
</button>
```

Replace with:

```jsx
<FilterButton
  activeCount={auditActiveFilterCount}
  isOpen={filterOpen}
  onClick={() => { setFilterOpen((v) => !v); setExportOpen(false); }}
/>
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --run
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/admin/pages/AuditLogPage.jsx
git commit -m "feat(audit-log): show active filter count badge on Filter button"
```

---

## Task 10: Update PeriodsPage

**Files:**
- Modify: `src/admin/pages/PeriodsPage.jsx`

- [ ] **Step 1: Add FilterButton import**

```js
import { FilterButton } from "../../shared/ui/FilterButton.jsx";
```

- [ ] **Step 2: Add active count computation**

Find the `useState` declarations for `statusFilter` and `lockFilter` (around line 96–99). After them, add:

```js
const activeFilterCount =
  (statusFilter !== "all" ? 1 : 0) +
  (lockFilter !== "all" ? 1 : 0);
```

- [ ] **Step 3: Replace inline filter button with FilterButton**

Find this block (around line 242–247):

```jsx
<button className="btn btn-outline btn-sm" onClick={() => { setFilterOpen((v) => !v); setExportOpen(false); }}>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px" }}>
    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
  </svg>
  {" "}Filter
</button>
```

Replace with:

```jsx
<FilterButton
  activeCount={activeFilterCount}
  isOpen={filterOpen}
  onClick={() => { setFilterOpen((v) => !v); setExportOpen(false); }}
/>
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --run
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/admin/pages/PeriodsPage.jsx
git commit -m "feat(periods): show active filter count badge on Filter button"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm test -- --run
```

Expected: all tests pass, no regressions

- [ ] **Step 2: Check no native select**

```bash
npm run check:no-native-select
```

Expected: `OK: no native <select> usage found in src/**/*.jsx|tsx`

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: build completes with no errors

- [ ] **Step 4: Final commit**

```bash
git add -p  # review any remaining unstaged changes
git commit -m "feat: add active filter count badge across all admin filter buttons"
```
