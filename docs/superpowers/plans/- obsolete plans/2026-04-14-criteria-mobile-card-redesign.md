# Criteria Page — Mobile Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin Criteria page's table view on mobile (≤ 768px) with premium preview cards that show rubric bands with score ranges, outcome pills, and a lock strip — editing via the existing `EditSingleCriterionDrawer`.

**Architecture:** A sibling `<div className="crt-mobile-list">` renders mobile cards alongside the existing `<table>`. CSS `@media (max-width: 768px)` hides the table and shows the card list; above 768px the opposite applies. All `FloatingMenu` actions already wired in `CriteriaPage.jsx` are re-used unchanged. `WeightBudgetBar` gains a `locked` prop for amber bar color.

**Tech Stack:** React 18, Lucide-react icons, CSS custom properties (`--warning`, `--text-muted`, `--border`, etc.), existing `FloatingMenu`, `EditSingleCriterionDrawer`, `FbAlert` components.

---

## File Map

| File | Change |
|------|--------|
| `src/admin/criteria/WeightBudgetBar.jsx` | Add `locked` prop; apply amber CSS class when true |
| `src/styles/pages/criteria.css` | Add: budget bar locked styles, mobile card styles, responsive breakpoint |
| `src/admin/pages/CriteriaPage.jsx` | Add: mobile card list JSX, lock badge, pass `locked` to `WeightBudgetBar` |

No new files. `CriterionEditor.jsx` is not used in the current `CriteriaPage.jsx` table layout and is not touched.

---

## Task 1: WeightBudgetBar — amber locked variant

**Files:**
- Modify: `src/admin/criteria/WeightBudgetBar.jsx`
- Modify: `src/styles/pages/criteria.css`

This task adds a visual amber state to the weight budget bar when the selected period is locked. No logic changes — purely visual.

- [ ] **Step 1: Add `locked` prop to WeightBudgetBar**

In `src/admin/criteria/WeightBudgetBar.jsx`, update the function signature and the `crt-budget-card` class:

```jsx
export default function WeightBudgetBar({ criteria, onDistribute, onAutoFill, locked }) {
  // ... existing code unchanged ...

  return (
    <div className={`crt-budget-card${isOver ? " crt-budget-over" : ""}${locked ? " crt-budget-card--locked" : ""}`}>
```

Also update the bar container line to add the locked class on the fill bar:

```jsx
      <div className="crt-budget-bar-container">
        <div className={`crt-budget-bar${locked ? " crt-budget-bar--locked" : ""}`}>
```

- [ ] **Step 2: Add amber locked styles to criteria.css**

Add these rules to `src/styles/pages/criteria.css`, after the existing `.crt-budget-card` block (search for `/* ── Weight budget bar` or add after the `.crt-budget-card` rules):

```css
/* ── Budget bar — locked (amber) variant ─────────────────────── */

.crt-budget-card--locked .crt-budget-value {
  color: var(--warning);
}

.crt-budget-card--locked .crt-budget-status {
  color: var(--warning);
}

.crt-budget-bar--locked .crt-budget-segment:not(.crt-budget-segment-remaining) {
  filter: saturate(0.4) sepia(0.8) hue-rotate(5deg);
  opacity: 0.75;
}

.crt-budget-card--locked {
  border-color: rgba(217, 119, 6, 0.25);
}

.dark-mode .crt-budget-card--locked {
  border-color: rgba(251, 191, 36, 0.25);
}

.dark-mode .crt-budget-card--locked .crt-budget-value,
.dark-mode .crt-budget-card--locked .crt-budget-status {
  color: #fbbf24;
}
```

- [ ] **Step 3: Pass `locked` from CriteriaPage to WeightBudgetBar**

In `src/admin/pages/CriteriaPage.jsx`, find the `WeightBudgetBar` usage (~line 335) and add the `locked` prop:

```jsx
      {periods.viewPeriodId && draftCriteria.length > 0 && (
        <WeightBudgetBar
          criteria={draftCriteria}
          onDistribute={handleDistribute}
          onAutoFill={handleAutoFill}
          locked={isLocked}
        />
      )}
```

- [ ] **Step 4: Verify visually**

Run `npm run dev`. Go to admin → Criteria. Select a locked period (one where `is_locked = true`). The budget bar should show amber tones. Select an unlocked period — normal indigo. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/admin/criteria/WeightBudgetBar.jsx src/styles/pages/criteria.css src/admin/pages/CriteriaPage.jsx
git commit -m "feat(criteria): add amber locked variant to WeightBudgetBar"
```

---

## Task 2: Mobile card CSS

**Files:**
- Modify: `src/styles/pages/criteria.css`

Add all mobile card styles and the responsive breakpoint. These rules are purely additive — no existing rules are changed.

- [ ] **Step 1: Add mobile card base styles**

Append to the end of `src/styles/pages/criteria.css`:

```css
/* ══════════════════════════════════════════════════════════════
   MOBILE CARD LIST  (≤ 768px)
   Shown on small screens; table hidden via media query below.
   ══════════════════════════════════════════════════════════════ */

.crt-mobile-list {
  display: none; /* shown via media query */
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px 16px;
}

/* ── Individual card ─────────────────────────────────────────── */

.crt-mobile-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: border-color .15s;
}

.crt-mobile-card--locked {
  border-left: 3px solid var(--warning);
}

/* ── Card header ─────────────────────────────────────────────── */

.crt-mobile-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 10px;
}

.crt-mobile-card-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  opacity: 0.85;
}

.crt-mobile-card-name {
  flex: 1;
  font-size: 13.5px;
  font-weight: 650;
  color: var(--text-primary);
  letter-spacing: -0.15px;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.crt-mobile-card-pts-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 7px;
  background: var(--surface-1);
  border: 1px solid var(--border);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.crt-mobile-card-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 7px;
  cursor: pointer;
  color: var(--text-tertiary);
  transition: background .13s, color .13s;
  flex-shrink: 0;
  padding: 0;
}

.crt-mobile-card-menu-btn:hover {
  background: var(--surface-1);
  color: var(--text-primary);
}

/* ── Lock strip ──────────────────────────────────────────────── */

.crt-mobile-lock-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: rgba(217, 119, 6, 0.07);
  border-top: 1px solid rgba(217, 119, 6, 0.18);
  border-bottom: 1px solid rgba(217, 119, 6, 0.18);
  font-size: 11px;
  font-weight: 600;
  color: var(--warning);
}

.crt-mobile-lock-strip svg {
  flex-shrink: 0;
  opacity: 0.85;
}

.dark-mode .crt-mobile-lock-strip {
  background: rgba(251, 191, 36, 0.08);
  border-color: rgba(251, 191, 36, 0.18);
  color: #fbbf24;
}

/* ── Rubric band rows ────────────────────────────────────────── */

.crt-mobile-bands {
  padding: 0 14px 6px;
  border-top: 1px solid var(--surface-1);
}

.crt-mobile-band-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-top: 1px solid rgba(15, 23, 42, 0.05);
  gap: 8px;
}

.crt-mobile-band-row:first-child {
  border-top: none;
}

.crt-mobile-band-name {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.05px;
}

/* Reuse existing band color tokens */
.crt-mobile-band-row.crt-band-excellent .crt-mobile-band-name { color: #16a34a; }
.crt-mobile-band-row.crt-band-good      .crt-mobile-band-name { color: #2563eb; }
.crt-mobile-band-row.crt-band-fair      .crt-mobile-band-name { color: #d97706; }
.crt-mobile-band-row.crt-band-poor      .crt-mobile-band-name { color: #dc2626; }

/* Locked: all bands go muted */
.crt-mobile-card--locked .crt-mobile-band-name {
  color: var(--text-tertiary) !important;
}

.crt-mobile-band-range {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  white-space: nowrap;
  flex-shrink: 0;
}

.dark-mode .crt-mobile-band-row.crt-band-excellent .crt-mobile-band-name { color: #4ade80; }
.dark-mode .crt-mobile-band-row.crt-band-good      .crt-mobile-band-name { color: #60a5fa; }
.dark-mode .crt-mobile-band-row.crt-band-fair      .crt-mobile-band-name { color: #fbbf24; }
.dark-mode .crt-mobile-band-row.crt-band-poor      .crt-mobile-band-name { color: #f87171; }

/* ── Outcome pills ───────────────────────────────────────────── */

.crt-mobile-outcomes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  padding: 8px 14px 12px;
  border-top: 1px solid var(--surface-1);
}

.crt-mobile-outcome-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.20);
  font-size: 10.5px;
  font-weight: 650;
  color: var(--accent);
  white-space: nowrap;
  letter-spacing: -0.05px;
}

.crt-mobile-outcome-overflow {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-1);
  border: 1px solid var(--border);
  font-size: 10.5px;
  font-weight: 650;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.dark-mode .crt-mobile-outcome-pill {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.30);
}

/* ── Lock badge (replaces Add button header chip on mobile) ───── */

.crt-lock-badge {
  display: none; /* shown via media query */
  align-items: center;
  gap: 5px;
  padding: 4px 11px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  background: rgba(217, 119, 6, 0.08);
  border: 1px solid rgba(217, 119, 6, 0.25);
  color: var(--warning);
  letter-spacing: -0.05px;
}

.crt-lock-badge svg {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
}

.dark-mode .crt-lock-badge {
  background: rgba(251, 191, 36, 0.10);
  border-color: rgba(251, 191, 36, 0.25);
  color: #fbbf24;
}

/* ── Responsive breakpoint ───────────────────────────────────── */

@media (max-width: 768px) {
  /* Show mobile list, hide desktop table */
  .crt-mobile-list {
    display: flex;
  }

  .crt-table-card .crt-table,
  .crt-table-card thead,
  .crt-table-card tbody,
  .crt-table-card tfoot {
    display: none;
  }

  /* Show lock badge, hide Add button */
  .crt-lock-badge {
    display: inline-flex;
  }

  .crt-lock-badge ~ .crt-add-btn {
    display: none;
  }
}
```

- [ ] **Step 2: Verify CSS compiled**

Run `npm run build` and confirm it exits with 0 errors. No visual check needed yet — JSX isn't wired.

- [ ] **Step 3: Commit**

```bash
git add src/styles/pages/criteria.css
git commit -m "feat(criteria): add mobile card CSS and responsive breakpoint"
```

---

## Task 3: Mobile card JSX in CriteriaPage

**Files:**
- Modify: `src/admin/pages/CriteriaPage.jsx`

Wire up the mobile card list and lock badge. All row action handlers (`handleDuplicate`, `handleMove`, `handleDeleteConfirm`) already exist — we just call them from the new card actions.

- [ ] **Step 1: Add lock badge to the chips row**

Find the `crt-chips-row` div in `CriteriaPage.jsx` (~line 376). It currently renders `crt-period-badge` and the Add button. Add the lock badge just before the Add button:

```jsx
            <div className="crt-chips-row">
              {periods.viewPeriodLabel && (
                <div className="crt-period-badge">
                  <Calendar size={11} strokeWidth={1.75} />
                  {periods.viewPeriodLabel}
                </div>
              )}
              {isLocked && (
                <span className="crt-lock-badge">
                  <Lock size={11} strokeWidth={2.2} />
                  Locked
                </span>
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
```

- [ ] **Step 2: Add mobile card list JSX**

Immediately after the closing `</table>` tag (and before the `Pagination` block, ~line 607) add the sibling mobile card list. Also add it inside the `periods.viewPeriodId && (...)` block, after the table's closing brace but still within the `crt-table-card` div:

Find this existing code:
```jsx
          )}
          {draftCriteria.length > 0 && (
            <Pagination
```

Replace with:

```jsx
          )}
          {/* Mobile card list — hidden on desktop via CSS */}
          {draftCriteria.length > 0 && (
            <div className="crt-mobile-list">
              {pageRows.map((criterion, rowIdx) => {
                const i = (safePage - 1) * pageSize + rowIdx;
                const rubric = Array.isArray(criterion.rubric) ? criterion.rubric : [];
                const outcomes = criterion.outcomes || [];
                const visibleOutcomes = outcomes.slice(0, 4);
                const overflowCount = outcomes.length - visibleOutcomes.length;
                const menuKey = `crt-mobile-${i}`;
                const isMenuOpen = openMenuId === menuKey;
                const color = criterion.color || CRITERION_COLORS[i % CRITERION_COLORS.length];
                return (
                  <div
                    key={criterion.key || i}
                    className={`crt-mobile-card${isLocked ? " crt-mobile-card--locked" : ""}`}
                  >
                    {/* Header */}
                    <div className="crt-mobile-card-header">
                      <span
                        className="crt-mobile-card-color-dot"
                        style={{ backgroundColor: color }}
                      />
                      <span className="crt-mobile-card-name">
                        {criterion.label || criterion.shortLabel || `Criterion ${i + 1}`}
                      </span>
                      <span className="crt-mobile-card-pts-badge">
                        {criterion.max != null ? `${criterion.max} pts` : "—"}
                      </span>
                      <FloatingMenu
                        trigger={
                          <button
                            className="crt-mobile-card-menu-btn"
                            aria-label="Actions"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(isMenuOpen ? null : menuKey);
                            }}
                          >
                            <MoreVertical size={14} />
                          </button>
                        }
                        isOpen={isMenuOpen}
                        onClose={() => setOpenMenuId(null)}
                        placement="bottom-end"
                      >
                        <button
                          className="floating-menu-item"
                          onMouseDown={() => { setOpenMenuId(null); setEditingIndex(i); }}
                        >
                          <Pencil size={13} strokeWidth={2} />
                          Edit Criterion
                        </button>
                        <button
                          className="floating-menu-item"
                          onMouseDown={() => { setOpenMenuId(null); handleDuplicate(i); }}
                        >
                          <Copy size={13} strokeWidth={2} />
                          Duplicate
                        </button>
                        <div className="floating-menu-divider" />
                        <button
                          className="floating-menu-item"
                          onMouseDown={() => { setOpenMenuId(null); handleMove(i, -1); }}
                          disabled={i === 0}
                          style={i === 0 ? { opacity: 0.4, pointerEvents: "none" } : {}}
                        >
                          <MoveUp size={13} strokeWidth={2} />
                          Move Up
                        </button>
                        <button
                          className="floating-menu-item"
                          onMouseDown={() => { setOpenMenuId(null); handleMove(i, 1); }}
                          disabled={i === draftCriteria.length - 1}
                          style={i === draftCriteria.length - 1 ? { opacity: 0.4, pointerEvents: "none" } : {}}
                        >
                          <MoveDown size={13} strokeWidth={2} />
                          Move Down
                        </button>
                        <div className="floating-menu-divider" />
                        <button
                          className="floating-menu-item danger"
                          onMouseDown={() => { setOpenMenuId(null); setDeleteIndex(i); }}
                        >
                          <Trash2 size={13} strokeWidth={2} />
                          Remove
                        </button>
                      </FloatingMenu>
                    </div>
                    {/* Lock strip */}
                    {isLocked && (
                      <div className="crt-mobile-lock-strip">
                        <Lock size={11} strokeWidth={2.2} />
                        Weights &amp; bands are read-only
                      </div>
                    )}
                    {/* Rubric band rows */}
                    {rubric.length > 0 && (
                      <div className="crt-mobile-bands">
                        {rubric.map((band, bi) => (
                          <div
                            key={bi}
                            className={`crt-mobile-band-row ${rubricBandClass(band.level || band.label)}`}
                          >
                            <span className="crt-mobile-band-name">
                              {band.level || band.label}
                            </span>
                            {bandRangeText(band) && (
                              <span className="crt-mobile-band-range">
                                {bandRangeText(band)} pts
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Outcome pills */}
                    {outcomes.length > 0 && (
                      <div className="crt-mobile-outcomes">
                        {visibleOutcomes.map((code) => (
                          <span key={code} className="crt-mobile-outcome-pill">
                            {code}
                          </span>
                        ))}
                        {overflowCount > 0 && (
                          <span className="crt-mobile-outcome-overflow">
                            +{overflowCount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {draftCriteria.length > 0 && (
            <Pagination
```

- [ ] **Step 3: Verify no lint errors**

Run `npm run build`. Expected: clean build, 0 errors.

- [ ] **Step 4: Test on mobile**

Run `npm run dev`. Open Chrome DevTools → Toggle device toolbar → set width to 375px (iPhone SE). Go to admin → Criteria.

Verify:
- Table is hidden, mobile card list is visible
- Each card shows: color dot, name, pts badge, "⋯" menu
- Rubric bands show horizontal rows: band name left, `X–Y pts` right
- Outcome pills appear (max 4 + overflow badge)
- "⋯" menu opens FloatingMenu with all 6 actions
- Edit → `EditSingleCriterionDrawer` opens
- Duplicate → new card appears immediately after original
- Move Up / Move Down → card reorders
- Remove → delete confirmation modal opens

Test locked period:
- Cards show amber left border
- Lock strip visible inside each card
- Budget bar shows amber tones
- Lock badge appears in header chip row

Test empty state (period with no criteria):
- Table empty state card is still visible at mobile width (it uses the existing `vera-es-card` pattern which is responsive)

- [ ] **Step 5: Commit**

```bash
git add src/admin/pages/CriteriaPage.jsx
git commit -m "feat(criteria): add mobile card list with rubric bands, outcome pills, and lock state"
```

---

## Self-Review Checklist

After all tasks, verify against spec:

| Spec requirement | Task |
|-----------------|------|
| Preview card: color dot, name, pts badge, "⋯" menu | Task 3 |
| Rubric bands: horizontal rows, band name left, range right | Task 3 |
| Outcome pills: max 4 + overflow | Task 3 |
| Empty state: existing vera-es-card (responsive, unchanged) | Not needed |
| WeightBudgetBar amber in locked state | Task 1 |
| Lock info banner (already present, amber via CSS) | Task 1 |
| Lock badge replaces Add button on mobile | Task 3 Step 1 |
| Amber card border + lock strip | Task 2 + Task 3 |
| Band rows muted when locked | Task 2 |
| Desktop table unchanged | CSS media query (Task 2) |
| No inline styles | All tasks — CSS classes used |
| No nested panel backgrounds | Band rows use border-top, no background |
| Lucide icons only | All tasks |
