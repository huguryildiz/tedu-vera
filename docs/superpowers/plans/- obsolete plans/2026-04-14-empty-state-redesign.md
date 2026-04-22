# Empty State Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic empty states on Outcomes, Criteria, and Periods pages with a unified "gradient hero + numbered steps" card using the new `vera-es-*` CSS design system.

**Architecture:** One new CSS block appended to `components.css`; three page files get their empty-state markup replaced in-place. Zero logic changes — `onClick` handlers, API calls, and drawer state are untouched.

**Tech Stack:** React JSX, vanilla CSS (CSS variables from `variables.css`), Lucide React icons

---

## File Map

| File | Change |
|---|---|
| `src/styles/components.css` | Append `vera-es-*` CSS block (~170 lines) |
| `src/admin/pages/OutcomesPage.jsx` | Replace lines 390–416 (sw-empty block); add `Info` to Lucide import |
| `src/admin/pages/CriteriaPage.jsx` | Replace lines 391–433 (crt-empty block); add `Info` to Lucide import; add `showClonePicker` state |
| `src/admin/pages/PeriodsPage.jsx` | Replace lines 535–560 (sw-empty block); add `Info` to Lucide import |

---

## Task 1: Add vera-es-* CSS block to components.css

**Files:**
- Modify: `src/styles/components.css` (append after line 3838)

- [ ] **Step 1: Append the vera-es-* block**

Open `src/styles/components.css` and append the following after the last line (`}`):

```css

/* ── vera-es-* Empty State Design System ─────────────────────────────────── */

.vera-es-card {
  width: 100%;
  max-width: 480px;
  border-radius: 16px;
  background: var(--bg-card, #fff);
  box-shadow: 0 1px 4px rgba(15,23,42,0.06), 0 4px 20px rgba(15,23,42,0.05), 0 0 0 1px rgba(15,23,42,0.04);
  overflow: hidden;
  margin: 0 auto;
}

/* Hero band */
.vera-es-hero {
  padding: 28px 28px 22px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  position: relative;
  overflow: hidden;
}
.vera-es-hero::after {
  content: '';
  position: absolute;
  right: -24px;
  top: -24px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  pointer-events: none;
}

/* Hero colour variants */
.vera-es-hero--period {
  background: linear-gradient(145deg, #f0fdf4 0%, #dcfce7 55%, #f0fdf4 100%);
  border-bottom: 1px solid rgba(22,163,74,0.09);
}
.vera-es-hero--period::after {
  background: radial-gradient(circle, rgba(22,163,74,0.07) 0%, transparent 70%);
}
.vera-es-hero--criteria {
  background: linear-gradient(145deg, #fffbeb 0%, #fef3c7 55%, #fffbeb 100%);
  border-bottom: 1px solid rgba(217,119,6,0.09);
}
.vera-es-hero--criteria::after {
  background: radial-gradient(circle, rgba(217,119,6,0.07) 0%, transparent 70%);
}
.vera-es-hero--fw {
  background: linear-gradient(145deg, #f8faff 0%, #eef4ff 55%, #f4f0ff 100%);
  border-bottom: 1px solid rgba(59,130,246,0.09);
}
.vera-es-hero--fw::after {
  background: radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%);
}

/* Icon box */
.vera-es-icon {
  width: 52px;
  height: 52px;
  border-radius: 15px;
  background: var(--bg-card, #fff);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.vera-es-icon--period {
  border: 1px solid rgba(22,163,74,0.14);
  box-shadow: 0 3px 12px rgba(22,163,74,0.10), 0 1px 3px rgba(15,23,42,0.04);
  color: #16a34a;
}
.vera-es-icon--criteria {
  border: 1px solid rgba(217,119,6,0.14);
  box-shadow: 0 3px 12px rgba(217,119,6,0.10), 0 1px 3px rgba(15,23,42,0.04);
  color: #d97706;
}
.vera-es-icon--fw {
  border: 1px solid rgba(59,130,246,0.14);
  box-shadow: 0 3px 12px rgba(59,130,246,0.10), 0 1px 3px rgba(15,23,42,0.04);
  color: #3b82f6;
}

/* Hero text */
.vera-es-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 6px;
  line-height: 1.3;
}
.vera-es-desc {
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
  text-align: justify;
  text-justify: inter-word;
}

/* Action body */
.vera-es-actions {
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.vera-es-action {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 13px;
  padding: 13px 14px;
  border-radius: 11px;
  border: 1px solid transparent;
  cursor: pointer;
  text-align: left;
  width: 100%;
  font-family: var(--font, inherit);
  transition: background 0.14s, border-color 0.14s, box-shadow 0.14s;
  background: transparent;
}
.vera-es-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.vera-es-action--primary-period {
  background: linear-gradient(135deg, rgba(22,163,74,0.05) 0%, rgba(16,185,129,0.025) 100%);
  border-color: rgba(22,163,74,0.13);
}
.vera-es-action--primary-period:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(22,163,74,0.09) 0%, rgba(16,185,129,0.05) 100%);
  border-color: rgba(22,163,74,0.22);
  box-shadow: 0 2px 8px rgba(22,163,74,0.07);
}
.vera-es-action--primary-criteria {
  background: linear-gradient(135deg, rgba(217,119,6,0.05) 0%, rgba(245,158,11,0.025) 100%);
  border-color: rgba(217,119,6,0.13);
}
.vera-es-action--primary-criteria:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(217,119,6,0.09) 0%, rgba(245,158,11,0.05) 100%);
  border-color: rgba(217,119,6,0.22);
  box-shadow: 0 2px 8px rgba(217,119,6,0.07);
}
.vera-es-action--primary-fw {
  background: linear-gradient(135deg, rgba(59,130,246,0.04) 0%, rgba(99,102,241,0.025) 100%);
  border-color: rgba(59,130,246,0.13);
}
.vera-es-action--primary-fw:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(99,102,241,0.05) 100%);
  border-color: rgba(59,130,246,0.22);
  box-shadow: 0 2px 8px rgba(59,130,246,0.07);
}
.vera-es-action--secondary {
  border-color: rgba(15,23,42,0.07);
}
.vera-es-action--secondary:hover:not(:disabled) {
  background: rgba(15,23,42,0.02);
  border-color: rgba(15,23,42,0.12);
}

/* Number badge */
.vera-es-num {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.vera-es-num--period   { background: rgba(22,163,74,0.10);  color: #16a34a; }
.vera-es-num--criteria { background: rgba(217,119,6,0.10);  color: #d97706; }
.vera-es-num--fw       { background: rgba(59,130,246,0.10); color: #2563eb; }
.vera-es-num--secondary { background: rgba(15,23,42,0.05); color: #64748b; }

/* Action text */
.vera-es-action-text { flex: 1; }
.vera-es-action-label {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 2px;
}
.vera-es-action-sub {
  font-size: 11.5px;
  color: #94a3b8;
  line-height: 1.4;
}

/* Badge pill */
.vera-es-badge {
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
  white-space: nowrap;
}
.vera-es-badge--period   { background: rgba(22,163,74,0.08);  color: #16a34a; }
.vera-es-badge--criteria { background: rgba(217,119,6,0.08);  color: #d97706; }
.vera-es-badge--fw       { background: rgba(59,130,246,0.08); color: #2563eb; }
.vera-es-badge--secondary { background: rgba(15,23,42,0.05); color: #94a3b8; }

/* "or" divider */
.vera-es-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: #cbd5e1;
  font-weight: 500;
  padding: 0 2px;
}
.vera-es-divider::before,
.vera-es-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(15,23,42,0.06);
}

/* Footer note */
.vera-es-footer {
  padding: 12px 20px;
  border-top: 1px solid rgba(15,23,42,0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 10.5px;
  color: #94a3b8;
  background: #fafbfd;
}

/* Inline clone-picker (CriteriaPage) */
.vera-es-clone-list {
  padding: 0 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid rgba(15,23,42,0.05);
}
.vera-es-clone-list-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding-top: 12px;
  padding-bottom: 4px;
}
.vera-es-clone-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 9px;
  border: 1px solid rgba(15,23,42,0.07);
  background: transparent;
  cursor: pointer;
  font-family: var(--font, inherit);
  transition: background 0.12s, border-color 0.12s;
  text-align: left;
  width: 100%;
}
.vera-es-clone-item:hover:not(:disabled) {
  background: rgba(217,119,6,0.04);
  border-color: rgba(217,119,6,0.15);
}
.vera-es-clone-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.vera-es-clone-name {
  font-size: 12.5px;
  font-weight: 600;
  color: #0f172a;
}
.vera-es-clone-meta {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 1px;
}
.vera-es-clone-cta {
  font-size: 11px;
  font-weight: 700;
  color: #d97706;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(217,119,6,0.08);
  flex-shrink: 0;
}
```

- [ ] **Step 2: Verify the file ends cleanly**

Run `npm run build` (or just open the file to confirm no syntax error). Expected: no CSS parse errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/components.css
git commit -m "feat(styles): add vera-es-* empty state design system CSS"
```

---

## Task 2: Replace OutcomesPage.jsx empty state (blue / framework)

**Files:**
- Modify: `src/admin/pages/OutcomesPage.jsx`

Current code to replace: lines 390–416 (the `<div className="sw-empty-state">` block, including the wrapping `<>`).

- [ ] **Step 1: Add `Info` to the Lucide import**

Find the existing import line (line 6):
```js
import { Pencil, Trash2, Copy, MoreVertical, Layers, AlertCircle, XCircle, ChevronDown, CheckCircle, AlertTriangle, Circle } from "lucide-react";
```

Replace with:
```js
import { Pencil, Trash2, Copy, MoreVertical, Layers, AlertCircle, XCircle, ChevronDown, CheckCircle, AlertTriangle, Circle, Info } from "lucide-react";
```

- [ ] **Step 2: Replace the empty state block**

Find:
```jsx
      {noFramework ? (
        <>
          <div className="sw-empty-state">
            <div className="sw-empty-icon">
              <Layers size={32} strokeWidth={1.5} />
            </div>
            <div className="sw-empty-title">No framework assigned to this period</div>
            <div className="sw-empty-desc">
              A framework defines programme outcomes and criterion mappings.
              Required for accreditation analytics and reporting.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ width: "auto", padding: "8px 20px" }}
                onClick={() => setFrameworkDrawerOpen(true)}
              >
                Start from an existing framework
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: "auto", padding: "8px 20px" }}
                onClick={() => setFrameworkDrawerOpen(true)}
              >
                Create from scratch
              </button>
            </div>
            <div className="sw-empty-context">Optional step · Recommended for accreditation</div>
          </div>
        </>
      ) : (
```

Replace with:
```jsx
      {noFramework ? (
        <div style={{ padding: "48px 24px", display: "flex", justifyContent: "center" }}>
          <div className="vera-es-card">
            <div className="vera-es-hero vera-es-hero--fw">
              <div className="vera-es-icon vera-es-icon--fw">
                <Layers size={24} strokeWidth={1.65} />
              </div>
              <div>
                <div className="vera-es-title">No framework assigned to this period</div>
                <div className="vera-es-desc">
                  A framework defines programme outcomes and criterion mappings.
                  Required for accreditation analytics and reporting.
                </div>
              </div>
            </div>
            <div className="vera-es-actions">
              <button
                className="vera-es-action vera-es-action--primary-fw"
                onClick={() => setFrameworkDrawerOpen(true)}
              >
                <div className="vera-es-num vera-es-num--fw">1</div>
                <div className="vera-es-action-text">
                  <div className="vera-es-action-label">Start from an existing framework</div>
                  <div className="vera-es-action-sub">Clone from a previous period or pick a platform template</div>
                </div>
                <span className="vera-es-badge vera-es-badge--fw">Recommended</span>
              </button>
              <div className="vera-es-divider">or</div>
              <button
                className="vera-es-action vera-es-action--secondary"
                onClick={() => setFrameworkDrawerOpen(true)}
              >
                <div className="vera-es-num vera-es-num--secondary">2</div>
                <div className="vera-es-action-text">
                  <div className="vera-es-action-label">Create from scratch</div>
                  <div className="vera-es-action-sub">Start blank and add your own outcomes</div>
                </div>
                <span className="vera-es-badge vera-es-badge--secondary">Manual</span>
              </button>
            </div>
            <div className="vera-es-footer">
              <Info size={12} strokeWidth={2} />
              Optional step · Recommended for accreditation
            </div>
          </div>
        </div>
      ) : (
```

- [ ] **Step 3: Verify the page renders**

Start dev server (`npm run dev`), open `/admin/outcomes` with a period that has no framework. Confirm the gradient hero card appears centred, both buttons open the FrameworkPickerDrawer.

- [ ] **Step 4: Commit**

```bash
git add src/admin/pages/OutcomesPage.jsx
git commit -m "feat(outcomes): replace empty state with vera-es gradient card"
```

---

## Task 3: Replace CriteriaPage.jsx empty state (amber / criteria)

**Files:**
- Modify: `src/admin/pages/CriteriaPage.jsx`

Current code to replace: lines 391–433 (the `<div className="crt-empty-state">` block).

- [ ] **Step 1: Add `Info` to the Lucide import**

Find the existing import (lines 5–19):
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
} from "lucide-react";
```

Replace with:
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

- [ ] **Step 2: Add `showClonePicker` state**

Find the component's state declarations (look for a block of `useState` calls near the top of the component function body). Add this line alongside the other state declarations:

```js
const [showClonePicker, setShowClonePicker] = useState(false);
```

- [ ] **Step 3: Replace the empty state block**

Find:
```jsx
          {draftCriteria.length === 0 && !adminLoading && loadingCount === 0 && contextPeriods.length > 0 ? (
            <div className="crt-empty-state">
              <div className="crt-empty-state-icon">
                <ClipboardX size={28} strokeWidth={1.5} />
              </div>
              <div className="crt-empty-state-title">No criteria defined yet</div>
              <div className="crt-empty-state-desc">
                Start by importing from a previous period or create from scratch.
              </div>

              {otherPeriods.length > 0 && (
                <div className="crt-clone-card">
                  <div className="crt-clone-label">Import from previous period</div>
                  {otherPeriods.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      className="crt-clone-option"
                      onClick={() => handleClone(p.id)}
                      disabled={cloneLoading || isLocked}
                      type="button"
                    >
                      <div>
                        <div className="crt-clone-name">{p.name}</div>
                        <div className="crt-clone-meta">
                          {p.criteria_count || "—"} criteria
                        </div>
                      </div>
                      <span className="crt-clone-btn">Clone</span>
                    </button>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 18, fontSize: 12.5, color: "var(--text-tertiary)" }}>
                or{" "}
                <span
                  style={{ color: "var(--accent)", fontWeight: 600, cursor: "pointer" }}
                  onClick={() => setEditingIndex(-1)}
                >
                  + Add Criterion
                </span>{" "}
                to start from scratch
              </div>
            </div>
          ) : (
```

Replace with:
```jsx
          {draftCriteria.length === 0 && !adminLoading && loadingCount === 0 && contextPeriods.length > 0 ? (
            <div style={{ padding: "48px 24px", display: "flex", justifyContent: "center" }}>
              <div className="vera-es-card">
                <div className="vera-es-hero vera-es-hero--criteria">
                  <div className="vera-es-icon vera-es-icon--criteria">
                    <ClipboardX size={24} strokeWidth={1.65} />
                  </div>
                  <div>
                    <div className="vera-es-title">No criteria defined for this period</div>
                    <div className="vera-es-desc">
                      Criteria are the scored dimensions jurors evaluate. Each criterion has a weight and optional rubric bands.
                    </div>
                  </div>
                </div>
                <div className="vera-es-actions">
                  <button
                    className="vera-es-action vera-es-action--primary-criteria"
                    onClick={() => setShowClonePicker((s) => !s)}
                    disabled={otherPeriods.length === 0}
                  >
                    <div className="vera-es-num vera-es-num--criteria">1</div>
                    <div className="vera-es-action-text">
                      <div className="vera-es-action-label">Import from a previous period</div>
                      <div className="vera-es-action-sub">
                        {otherPeriods.length === 0
                          ? "No previous periods with criteria available"
                          : "Clone criteria and weights from an existing period"}
                      </div>
                    </div>
                    <span className="vera-es-badge vera-es-badge--criteria">Fastest</span>
                  </button>
                  <div className="vera-es-divider">or</div>
                  <button
                    className="vera-es-action vera-es-action--secondary"
                    onClick={() => setEditingIndex(-1)}
                  >
                    <div className="vera-es-num vera-es-num--secondary">2</div>
                    <div className="vera-es-action-text">
                      <div className="vera-es-action-label">Create from scratch</div>
                      <div className="vera-es-action-sub">Add criteria one by one with custom weights</div>
                    </div>
                    <span className="vera-es-badge vera-es-badge--secondary">Manual</span>
                  </button>
                </div>
                {showClonePicker && otherPeriods.length > 0 && (
                  <div className="vera-es-clone-list">
                    <div className="vera-es-clone-list-label">Select a period to clone from</div>
                    {otherPeriods.slice(0, 3).map((p) => (
                      <button
                        key={p.id}
                        className="vera-es-clone-item"
                        onClick={() => handleClone(p.id)}
                        disabled={cloneLoading || isLocked}
                        type="button"
                      >
                        <div>
                          <div className="vera-es-clone-name">{p.name}</div>
                          <div className="vera-es-clone-meta">{p.criteria_count || "—"} criteria</div>
                        </div>
                        <span className="vera-es-clone-cta">Clone</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="vera-es-footer">
                  <Info size={12} strokeWidth={2} />
                  Required · Weights must sum to 100 pts
                </div>
              </div>
            </div>
          ) : (
```

- [ ] **Step 4: Verify the page renders**

Open `/admin/criteria` with a period that has no criteria. Confirm:
- Amber hero card appears
- Action 1 button (disabled when no prior periods) toggles the clone list on click
- Clone list items trigger `handleClone`
- Action 2 opens the Add Criterion drawer

- [ ] **Step 5: Commit**

```bash
git add src/admin/pages/CriteriaPage.jsx
git commit -m "feat(criteria): replace empty state with vera-es gradient card"
```

---

## Task 4: Replace PeriodsPage.jsx empty state (green / periods)

**Files:**
- Modify: `src/admin/pages/PeriodsPage.jsx`

Current code to replace: lines 535–560 (the `<div className="sw-empty-state">` block inside the `statusFilter === "all"` branch).

- [ ] **Step 1: Add `Info` to the Lucide import**

Find the existing import (lines 15–27):
```js
import {
  Lock,
  LockOpen,
  Trash2,
  FileEdit,
  Play,
  CheckCircle,
  MoreVertical,
  Pencil,
  Eye,
  Icon,
  CalendarRange,
} from "lucide-react";
```

Replace with:
```js
import {
  Lock,
  LockOpen,
  Trash2,
  FileEdit,
  Play,
  CheckCircle,
  MoreVertical,
  Pencil,
  Eye,
  Icon,
  CalendarRange,
  Info,
} from "lucide-react";
```

- [ ] **Step 2: Replace the empty state block**

Find (inside the `statusFilter === "all"` branch):
```jsx
                    <div className="sw-empty-state">
                      <div className="sw-empty-icon">
                        <CalendarRange size={28} strokeWidth={1.5} />
                      </div>
                      <div className="sw-empty-title">No evaluation periods yet</div>
                      <div className="sw-empty-desc">
                        An evaluation period is the foundation of your setup. It defines the timeframe, criteria, and scope for jury evaluations.
                      </div>
                      <div className="sw-empty-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => onNavigate?.("setup")}
                          style={{ width: "auto", padding: "8px 20px" }}
                        >
                          Use Setup Wizard
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={openAddDrawer}
                          style={{ width: "auto", padding: "8px 20px" }}
                        >
                          + Create Period Manually
                        </button>
                      </div>
                      <div className="sw-empty-context">Step 1 of 7 in minimum setup</div>
                    </div>
```

Replace with:
```jsx
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <div className="vera-es-card">
                        <div className="vera-es-hero vera-es-hero--period">
                          <div className="vera-es-icon vera-es-icon--period">
                            <CalendarRange size={24} strokeWidth={1.65} />
                          </div>
                          <div>
                            <div className="vera-es-title">No evaluation periods yet</div>
                            <div className="vera-es-desc">
                              An evaluation period defines the timeframe, criteria, and scope for jury evaluations. It is the foundation of your setup.
                            </div>
                          </div>
                        </div>
                        <div className="vera-es-actions">
                          <button
                            className="vera-es-action vera-es-action--primary-period"
                            onClick={() => onNavigate?.("setup")}
                          >
                            <div className="vera-es-num vera-es-num--period">1</div>
                            <div className="vera-es-action-text">
                              <div className="vera-es-action-label">Use Setup Wizard</div>
                              <div className="vera-es-action-sub">Guided 7-step configuration from scratch</div>
                            </div>
                            <span className="vera-es-badge vera-es-badge--period">Step 1</span>
                          </button>
                          <div className="vera-es-divider">or</div>
                          <button
                            className="vera-es-action vera-es-action--secondary"
                            onClick={openAddDrawer}
                          >
                            <div className="vera-es-num vera-es-num--secondary">2</div>
                            <div className="vera-es-action-text">
                              <div className="vera-es-action-label">Create manually</div>
                              <div className="vera-es-action-sub">Set name, dates, and options yourself</div>
                            </div>
                            <span className="vera-es-badge vera-es-badge--secondary">Manual</span>
                          </button>
                        </div>
                        <div className="vera-es-footer">
                          <Info size={12} strokeWidth={2} />
                          Required · Step 1 of 7 in minimum setup
                        </div>
                      </div>
                    </div>
```

- [ ] **Step 3: Verify the page renders**

Open `/admin/periods` with no periods (or create a fresh demo account). Confirm:
- Green hero card appears centred inside the table cell
- "Use Setup Wizard" calls `onNavigate?.("setup")`
- "Create manually" opens the Add Period drawer

- [ ] **Step 4: Commit**

```bash
git add src/admin/pages/PeriodsPage.jsx
git commit -m "feat(periods): replace empty state with vera-es gradient card"
```

---

## Spec Coverage Check

| Spec requirement | Covered by |
|---|---|
| Green hero for Periods (foundation) | Task 1 CSS + Task 4 JSX |
| Amber hero for Criteria (config) | Task 1 CSS + Task 3 JSX |
| Blue hero for Outcomes (optional accreditation) | Task 1 CSS + Task 2 JSX |
| Numbered badge, primary/secondary action, badge pill | Task 1 CSS all variants |
| Footer note per page | Tasks 2–4, each footer |
| Inline clone picker (CriteriaPage, expandable) | Task 3 showClonePicker state |
| Both Outcomes buttons → setFrameworkDrawerOpen | Task 2 Step 2 |
| Criteria Action 2 → setEditingIndex(-1) | Task 3 Step 3 |
| Periods Action 1 → onNavigate?.("setup") | Task 4 Step 2 |
| Periods Action 2 → openAddDrawer() | Task 4 Step 2 |
| No changes to drawer/modal logic | All tasks — onClick handlers unchanged |
| No DB or API changes | All tasks — no API touched |
| Two simpler Criteria sub-states out of scope | Task 3 only touches the third condition branch |
