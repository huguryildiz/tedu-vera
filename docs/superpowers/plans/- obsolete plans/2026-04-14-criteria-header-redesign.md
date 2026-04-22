# Criteria Header Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single green summary badge in the Criteria page card header with a structured chip row (criteria count · weight status · period badge · Add button), matching the Outcomes page's design language.

**Architecture:** Two-file change — `criteria.css` gets new chip classes replacing `.crt-summary-badge`; `CriteriaPage.jsx` gets updated imports, a trimmed page header, and a new chip row in the card header. No shared files touched, no API changes, no migration.

**Tech Stack:** React 18, Lucide-react icons, CSS custom properties (`--success`, `--warning`, `--accent` already defined in `variables.css`)

---

## File Map

| File | Change |
|---|---|
| `src/styles/pages/criteria.css` | Delete `.crt-summary-badge` block; add `.crt-chips-row`, `.crt-chip` variants, `.crt-period-badge` |
| `src/admin/pages/CriteriaPage.jsx` | Add `ListChecks`, `AlertTriangle`, `Calendar` imports; remove Add button from page header; replace summary badge with chip row in card header |

---

## Task 1: Update `criteria.css` — swap summary badge for chip classes

**Files:**
- Modify: `src/styles/pages/criteria.css` (lines 172–196, where `.crt-summary-badge` is defined)

- [ ] **Step 1: Delete the `.crt-summary-badge` block**

Find and remove lines 172–196 in `criteria.css` — the entire block below. Delete all three rules:

```css
.crt-summary-badge {
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

.crt-summary-badge svg {
  width: 13px;
  height: 13px;
  opacity: 0.8;
}

.dark-mode .crt-summary-badge {
  background: rgba(74, 222, 128, 0.08);
  color: #86efac;
  border-color: rgba(74, 222, 128, 0.18);
}
```

- [ ] **Step 2: Add chip classes in their place**

In the same location (after `.crt-table-card-title`, before `.dark-mode .crt-table-card`), insert:

```css
/* ── Chip row ────────────────────────────────────────────────── */

.crt-chips-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.crt-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid;
  white-space: nowrap;
  line-height: 1.3;
}

.crt-chip svg {
  width: 11px;
  height: 11px;
  opacity: 0.7;
  flex-shrink: 0;
}

.crt-chip.neutral {
  background: var(--surface-1);
  border-color: var(--border);
  color: var(--text-secondary);
}

.crt-chip.success {
  background: rgba(22, 163, 74, 0.06);
  border-color: rgba(22, 163, 74, 0.15);
  color: var(--success);
}

.crt-chip.warning {
  background: rgba(217, 119, 6, 0.06);
  border-color: rgba(217, 119, 6, 0.15);
  color: var(--warning);
}

.crt-period-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  line-height: 1.3;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(139, 92, 246, 0.06));
  border: 1px solid rgba(59, 130, 246, 0.18);
  color: var(--accent);
}

.crt-period-badge svg {
  width: 11px;
  height: 11px;
  opacity: 0.7;
  flex-shrink: 0;
}
```

---

## Task 2: Update `CriteriaPage.jsx` — imports + page header + card header

**Files:**
- Modify: `src/admin/pages/CriteriaPage.jsx` (lines 4–20 for imports, lines 327–390 for JSX)

- [ ] **Step 1: Update lucide-react imports**

Current import block (lines 4–20):

```js
import {
  Lock,
  Plus,
  ClipboardList,
  CheckCircle2,
  Pencil,
  Trash2,
  MoreVertical,
  ClipboardX,
  AlertCircle,
  Icon,
  Copy,
  MoveUp,
  MoveDown,
  Info,
} from "lucide-react";
```

Replace with (add `ListChecks`, `AlertTriangle`, `Calendar`; keep `ClipboardList` — still used in empty states):

```js
import {
  Lock,
  Plus,
  ClipboardList,
  ListChecks,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Pencil,
  Trash2,
  MoreVertical,
  ClipboardX,
  AlertCircle,
  Icon,
  Copy,
  MoveUp,
  MoveDown,
  Info,
} from "lucide-react";
```

- [ ] **Step 2: Remove Add Criterion button from the page-level header**

Find this block (lines 327–338):

```jsx
      {/* Page header */}
      <div className="crt-header">
        <div className="crt-header-left">
          <div className="page-title">Evaluation Criteria</div>
          <div className="page-desc">Define scoring rubrics and criteria weights for the active evaluation period.</div>
        </div>
        {periods.viewPeriodId && (
          <button className="crt-add-btn" onClick={() => setEditingIndex(-1)} disabled={isLocked}>
            <Plus size={13} strokeWidth={2.2} />
            Add Criterion
          </button>
        )}
      </div>
```

Replace with (button removed):

```jsx
      {/* Page header */}
      <div className="crt-header">
        <div className="crt-header-left">
          <div className="page-title">Evaluation Criteria</div>
          <div className="page-desc">Define scoring rubrics and criteria weights for the active evaluation period.</div>
        </div>
      </div>
```

- [ ] **Step 3: Replace the card header summary badge with the chip row**

Find this block (lines 380–390):

```jsx
          <div className="crt-table-card-header">
            <div className="crt-table-card-title">
              Active Criteria{periods.viewPeriodLabel ? ` — ${periods.viewPeriodLabel}` : ""}
            </div>
            {draftCriteria.length > 0 && (
              <div className="crt-summary-badge">
                <CheckCircle2 size={14} strokeWidth={2.2} />
                {draftCriteria.length} {draftCriteria.length === 1 ? "criterion" : "criteria"} &middot; {periods.draftTotal} points
              </div>
            )}
          </div>
```

Replace with:

```jsx
          <div className="crt-table-card-header">
            <div className="crt-table-card-title">Active Criteria</div>
            <div className="crt-chips-row">
              {draftCriteria.length > 0 && (
                <div className="crt-chip neutral">
                  <ListChecks size={11} strokeWidth={2} />
                  {draftCriteria.length} {draftCriteria.length === 1 ? "criterion" : "criteria"}
                </div>
              )}
              {draftCriteria.length > 0 && (
                periods.draftTotal === 100 ? (
                  <div className="crt-chip success">
                    <CheckCircle2 size={11} strokeWidth={2} />
                    {periods.draftTotal} pts · balanced
                  </div>
                ) : (
                  <div className="crt-chip warning">
                    <AlertTriangle size={11} strokeWidth={2} />
                    {periods.draftTotal} / 100 pts
                  </div>
                )
              )}
              {periods.viewPeriodLabel && (
                <div className="crt-period-badge">
                  <Calendar size={11} strokeWidth={1.75} />
                  {periods.viewPeriodLabel}
                </div>
              )}
              <button
                className="crt-add-btn"
                onClick={() => setEditingIndex(-1)}
                disabled={isLocked}
              >
                <Plus size={13} strokeWidth={2.2} />
                Add Criterion
              </button>
            </div>
          </div>
```

---

## Task 3: Visual verification + build check

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:5173` and navigate to Admin → Criteria.

- [ ] **Step 2: Verify each chip state**

Check all three scenarios:

| Scenario | Expected chip row |
|---|---|
| Period selected, criteria exist, total = 100 | `[N criteria]` `[100 pts · balanced]` (green) `[Period Name]` (accent) `[+ Add Criterion]` |
| Period selected, criteria exist, total < 100 | `[N criteria]` `[N / 100 pts]` (amber) `[Period Name]` (accent) `[+ Add Criterion]` |
| Period selected, no criteria yet | `[Period Name]` (accent) `[+ Add Criterion]` (chips hidden; empty state card shown) |

- [ ] **Step 3: Check that the Add Criterion button in the page header is gone**

The area above the WeightBudgetBar should show only the page title and description — no button.

- [ ] **Step 4: Check dark mode**

Toggle dark mode. Verify the chips respect dark-mode token values (the CSS uses `var(--surface-1)`, `var(--border)`, `var(--success)`, `var(--warning)`, `var(--accent)` — all defined for both themes in `variables.css`).

- [ ] **Step 5: Run the native-select check**

```bash
npm run check:no-native-select
```

Expected: passes (no native `<select>` added).

- [ ] **Step 6: Run the build**

```bash
npm run build
```

Expected: exits 0 with no errors.
