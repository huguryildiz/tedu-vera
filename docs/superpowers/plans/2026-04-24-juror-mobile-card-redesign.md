# Juror Mobile Portrait Card Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant stats strip (SCORED / ASSIGNED / DONE%) from the juror mobile portrait card and replace the unlabelled timestamp with a "Last active:" footer that also shows the completion percentage.

**Architecture:** Two-file change — JSX block surgery in `JurorsTable.jsx` and CSS removal/addition in `JurorsPage.css`. No new components, no data-layer changes, no desktop layout changes.

**Tech Stack:** React JSX, CSS custom properties (`var(--*)`), Vitest + Testing Library

---

## File Map

| Action | File |
|---|---|
| Modify | `src/admin/features/jurors/components/JurorsTable.jsx` |
| Modify | `src/admin/features/jurors/JurorsPage.css` |
| Modify | `src/test/qa-catalog.json` |
| Create | `src/admin/features/jurors/__tests__/JurorsTable.test.jsx` |

---

## Task 1: Register test ID in qa-catalog

**Files:**
- Modify: `src/test/qa-catalog.json`

- [ ] **Step 1: Add the new test entry**

Open `src/test/qa-catalog.json` and append inside the array (before the final `]`):

```json
{
  "id": "admin.jurors.mobile.card.layout",
  "module": "Admin / Features",
  "area": "JurorsPage",
  "story": "mobile card layout",
  "scenario": "Mobile portrait card shows progress block and Last active footer; stats strip is absent",
  "whyItMatters": "Removing the redundant stats strip is the sole purpose of this change — verifying it stays gone prevents regressions.",
  "risk": "Stats strip creeps back in a future merge; layout regresses silently.",
  "coverageStrength": "Unit",
  "severity": "medium"
}
```

- [ ] **Step 2: Verify JSON parses cleanly**

```bash
node -e "JSON.parse(require('fs').readFileSync('src/test/qa-catalog.json','utf8')); console.log('ok')"
```

Expected output: `ok`

---

## Task 2: Write failing tests for the new card layout

**Files:**
- Create: `src/admin/features/jurors/__tests__/JurorsTable.test.jsx`

- [ ] **Step 1: Create the test file**

```jsx
import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";
import JurorsTable from "../components/JurorsTable";

// PremiumTooltip and FloatingMenu use portals — stub them out
vi.mock("@/shared/ui/PremiumTooltip", () => ({
  default: ({ children }) => children,
}));
vi.mock("@/shared/ui/FloatingMenu", () => ({
  default: ({ trigger }) => trigger,
}));

const noop = vi.fn();

const baseProps = {
  pagedList: [],
  loadingCount: 0,
  filteredList: [],
  jurorList: [],
  periodMaxScore: 100,
  jurorAvgMap: {},
  editWindowNowMs: Date.now(),
  sortKey: "name",
  sortDir: "asc",
  openMenuId: null,
  setOpenMenuId: noop,
  rowsScopeRef: { current: null },
  shouldUseCardLayout: true,
  isGraceLocked: false,
  graceLockTooltip: null,
  isPeriodLocked: false,
  activeFilterCount: 0,
  search: "",
  onSort: noop,
  onEdit: noop,
  onPinReset: noop,
  onRemove: noop,
  onEnableEdit: noop,
  onViewScores: noop,
  onNotify: noop,
  onClearSearch: noop,
  onClearFilters: noop,
  onAddJuror: noop,
  onImport: noop,
  onNavigatePeriods: noop,
  viewPeriodId: "period-1",
  periodList: [],
};

const makeJuror = (overrides = {}) => ({
  juror_id: "j1",
  juryName: "Dr. Test Juror",
  affiliation: "Test University, EE",
  overviewScoredProjects: 3,
  overviewTotalProjects: 5,
  lastSeenAt: "2024-01-15T10:30:00Z",
  overviewStatus: "in_progress",
  ...overrides,
});

function renderTable(juror) {
  return render(
    <MemoryRouter>
      <JurorsTable {...baseProps} pagedList={[juror]} filteredList={[juror]} jurorList={[juror]} />
    </MemoryRouter>
  );
}

describe("JurorsTable mobile card", () => {
  qaTest("admin.jurors.mobile.card.layout", () => {
    renderTable(makeJuror());

    // Stats strip must be gone
    expect(screen.queryByText("SCORED")).toBeNull();
    expect(screen.queryByText("ASSIGNED")).toBeNull();
    expect(screen.queryByText("DONE")).toBeNull();

    // Footer label present
    expect(screen.getByText("Last active:")).toBeDefined();

    // Percentage shown for partial juror
    expect(screen.getByText("60%")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
npm test -- --run src/admin/features/jurors/__tests__/JurorsTable.test.jsx
```

Expected: FAIL — "SCORED" is found in the DOM (stats strip still exists), "Last active:" not found, "60%" not found.

---

## Task 3: Remove the stats strip from JSX

**Files:**
- Modify: `src/admin/features/jurors/components/JurorsTable.jsx` lines 221–238

- [ ] **Step 1: Delete the `jc-stats` block**

Locate and remove the entire `<div className="jc-stats">` block (lines 221–238):

```jsx
          <div className="jc-stats">
            <div className="jc-stat">
              <span className={`jcs-val${scored >= total && total > 0 ? " val-done" : scored > 0 ? " val-partial" : " val-zero"}`}>
                {scored}
              </span>
              <span className="jcs-key">SCORED</span>
            </div>
            <div className="jc-stat">
              <span className="jcs-val val-zero">{total}</span>
              <span className="jcs-key">ASSIGNED</span>
            </div>
            <div className="jc-stat">
              <span className={`jcs-val${total === 0 ? " val-zero" : scored >= total ? " val-done" : " val-amber"}`}>
                {total === 0 ? "—" : `${Math.round((scored / total) * 100)}%`}
              </span>
              <span className="jcs-key">DONE</span>
            </div>
          </div>
```

Delete it entirely — nothing replaces it.

- [ ] **Step 2: Update the footer**

Replace the current footer (lines 257–260):

```jsx
          <div className="jc-footer">
            <Clock size={11} strokeWidth={2} style={{ opacity: 0.7 }} />
            <span>{lastActive ? formatRelative(lastActive) : "Never active"}</span>
          </div>
```

With:

```jsx
          <div className="jc-footer">
            <Clock size={11} strokeWidth={2} style={{ opacity: 0.7 }} />
            <span className="jc-footer-label">Last active:</span>
            <span className="jc-footer-time">{lastActive ? formatRelative(lastActive) : "Never"}</span>
            {total > 0 && (
              <span className={`jc-footer-pct${scored >= total ? " val-done" : " val-amber"}`}>
                {Math.round((scored / total) * 100)}%
              </span>
            )}
          </div>
```

---

## Task 4: Update CSS

**Files:**
- Modify: `src/admin/features/jurors/JurorsPage.css`

- [ ] **Step 1: Remove stats strip rules and add separator to progress block**

Delete the entire block between the `/* ── Stats strip ── */` comment and the `/* ── Progress block ── */` comment — that is, these rules (`.jc-stats`, `.jc-stat`, `.jcs-val`, `.jcs-key`):

```css
  /* ── Stats strip ── */
  .jc-stats {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    margin: 0;
  }

  .jc-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 9px 0;
    gap: 2px;
    border-right: 1px solid var(--border);
  }
  .jc-stat:last-child { border-right: none; }

  .jcs-val {
    font-size: 18px;
    font-weight: 900;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .jcs-val.val-done    { color: #22c55e; }
  .jcs-val.val-partial { color: var(--accent-purple, #6c63ff); }
  .jcs-val.val-zero    { color: var(--text-tertiary); }
  .jcs-val.val-amber   { color: #f59e0b; }

  .jcs-key {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--text-tertiary);
  }
```

Then add `border-top` to `.jc-prog-block` so the header section and progress block remain visually separated now that the stats strip (which provided that border) is gone. Find `.jc-prog-block { padding: 9px 12px 10px; }` and add `border-top: 1px solid var(--border);` to it.

- [ ] **Step 2: Update `.jc-footer` and its children**

Replace the existing footer block:

```css
  /* ── Footer ── */
  .jc-footer {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 14px;
    border-top: 1px solid var(--border);
    color: var(--text-tertiary);
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.015em;
  }
  .jc-footer span {
    font-family: var(--font-mono, ui-monospace, monospace);
    letter-spacing: -0.01em;
  }
```

With:

```css
  /* ── Footer ── */
  .jc-footer {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 14px;
    border-top: 1px solid var(--border);
    color: var(--text-tertiary);
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.015em;
  }
  .jc-footer-label {
    color: var(--text-tertiary);
  }
  .jc-footer-time {
    font-family: var(--font-mono, ui-monospace, monospace);
    letter-spacing: -0.01em;
  }
  .jc-footer-pct {
    margin-left: auto;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-weight: 700;
    font-size: 11px;
  }
  .jc-footer-pct.val-done  { color: #22c55e; }
  .jc-footer-pct.val-amber { color: #f59e0b; }
```

---

## Task 5: Run tests and verify

**Files:** none

- [ ] **Step 1: Run the unit test — expect PASS**

```bash
npm test -- --run src/admin/features/jurors/__tests__/JurorsTable.test.jsx
```

Expected: PASS (1 test)

- [ ] **Step 2: Run full test suite**

```bash
npm test -- --run
```

Expected: no new failures

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: clean build, no TypeScript/JSX errors

- [ ] **Step 4: Commit**

```bash
git add src/admin/features/jurors/components/JurorsTable.jsx \
        src/admin/features/jurors/JurorsPage.css \
        src/admin/features/jurors/__tests__/JurorsTable.test.jsx \
        src/test/qa-catalog.json
git commit -m "feat: juror mobile card — progress hero, remove stats strip, label timestamp"
```
