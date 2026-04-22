# Lock Banner — Amber Glow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a premium animated amber-glow lock banner to the Criteria page (new) and upgrade the existing banner on the Outcomes page via shared CSS.

**Architecture:** Two isolated changes — (1) replace the `.lock-notice` CSS block in `components.css` with the Amber Glow design, (2) insert the banner JSX into `CriteriaPage.jsx`. OutcomesPage already uses `.lock-notice` and gets the upgrade for free.

**Tech Stack:** React JSX, CSS animations (`@keyframes`), Lucide icons (`Lock`, `LockKeyhole`, `PencilLine` — all already imported in both pages)

**Spec:** `docs/superpowers/specs/2026-04-15-lock-banner-design.md`

---

### Task 1: Upgrade `.lock-notice` CSS

**Files:**
- Modify: `src/styles/components.css:4386-4558`

The current block starts at the comment `/* ── Lock Notice Banner … */` and ends after `.dark-mode .lock-notice-chip.editable`. Replace the entire block in-place.

- [ ] **Step 1: Replace the lock-notice CSS block**

In `src/styles/components.css`, find the block that starts at line 4386:

```
/* ── Lock Notice Banner (shared — Outcomes + Criteria pages) ── */
```

…and ends after:

```css
.dark-mode .lock-notice-chip.editable {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.09);
  border-color: rgba(74, 222, 128, 0.20);
}
```

Replace the entire block with:

```css
/* ── Lock Notice Banner (shared — Outcomes + Criteria pages) ── */

.lock-notice {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(245, 158, 11, 0.25);
  background: linear-gradient(
    135deg,
    rgba(254, 243, 199, 0.60) 0%,
    rgba(255, 251, 235, 0.45) 50%,
    rgba(254, 252, 232, 0.55) 100%
  );
  display: grid;
  grid-template-columns: auto 1fr;
  box-shadow:
    0 0 0 1px rgba(245, 158, 11, 0.12),
    0 4px 20px rgba(245, 158, 11, 0.10),
    inset 0 1px 0 rgba(255, 255, 255, 0.70);
  margin-bottom: 20px;
}

/* Sweeping shimmer */
.lock-notice::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.35) 45%,
    rgba(255, 255, 255, 0.55) 50%,
    rgba(255, 255, 255, 0.35) 55%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: ln-shimmer 3.5s ease-in-out infinite;
  pointer-events: none;
}

@keyframes ln-shimmer {
  0%   { background-position: -100% 0; opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { background-position: 200% 0; opacity: 0; }
}

/* Glowing bottom bar */
.lock-notice::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(245, 158, 11, 0.50) 25%,
    rgba(251, 191, 36, 0.80) 50%,
    rgba(245, 158, 11, 0.50) 75%,
    transparent 100%
  );
  animation: ln-glow-bar 2.8s ease-in-out infinite;
}

@keyframes ln-glow-bar {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1;   }
}

.lock-notice-left {
  padding: 18px 16px 18px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: linear-gradient(180deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.03));
  border-right: 1px solid rgba(245, 158, 11, 0.13);
  min-width: 72px;
}

.lock-notice-icon-wrap {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(245, 158, 11, 0.11);
  border: 1px solid rgba(245, 158, 11, 0.22);
  display: grid;
  place-items: center;
  box-shadow:
    0 0 18px rgba(245, 158, 11, 0.18),
    0 2px 6px rgba(245, 158, 11, 0.12);
}

.lock-notice-icon-wrap svg {
  color: #b45309;
  width: 20px;
  height: 20px;
}

/* Pulsing ring */
.lock-notice-icon-wrap::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 18px;
  border: 1.5px solid rgba(245, 158, 11, 0.25);
  animation: ln-ring 2.8s ease-out infinite;
  pointer-events: none;
}

@keyframes ln-ring {
  0%   { opacity: 0.9; transform: scale(0.92); }
  70%  { opacity: 0;   transform: scale(1.12); }
  100% { opacity: 0; }
}

.lock-notice-badge {
  font-family: var(--mono);
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #92400e;
  background: rgba(245, 158, 11, 0.11);
  border: 1px solid rgba(245, 158, 11, 0.22);
  padding: 3px 7px;
  border-radius: 5px;
  white-space: nowrap;
}

.lock-notice-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.lock-notice-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.1px;
  line-height: 1.3;
}

.lock-notice-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  text-align: justify;
  text-justify: inter-word;
}

.lock-notice-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.lock-notice-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid;
  line-height: 1;
}

.lock-notice-chip svg {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
}

.lock-notice-chip.locked {
  color: #92400e;
  background: rgba(245, 158, 11, 0.09);
  border-color: rgba(245, 158, 11, 0.22);
}

.lock-notice-chip.editable {
  color: var(--success);
  background: rgba(22, 163, 74, 0.08);
  border-color: rgba(22, 163, 74, 0.18);
}

/* ── Dark mode ── */

.dark-mode .lock-notice {
  border-color: rgba(251, 191, 36, 0.20);
  background: linear-gradient(
    135deg,
    rgba(251, 191, 36, 0.07) 0%,
    rgba(30, 24, 10, 0.50)   50%,
    rgba(251, 191, 36, 0.05) 100%
  );
  box-shadow:
    0 0 0 1px rgba(251, 191, 36, 0.12),
    0 4px 24px rgba(251, 191, 36, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.dark-mode .lock-notice::before {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.04) 45%,
    rgba(255, 255, 255, 0.07) 50%,
    rgba(255, 255, 255, 0.04) 55%,
    transparent 100%
  );
  background-size: 200% 100%;
}

.dark-mode .lock-notice::after {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(251, 191, 36, 0.35) 25%,
    rgba(252, 211, 77,  0.65) 50%,
    rgba(251, 191, 36, 0.35) 75%,
    transparent 100%
  );
}

.dark-mode .lock-notice-left {
  background: linear-gradient(180deg, rgba(251, 191, 36, 0.09), rgba(251, 191, 36, 0.03));
  border-right-color: rgba(251, 191, 36, 0.12);
}

.dark-mode .lock-notice-icon-wrap {
  background: rgba(251, 191, 36, 0.12);
  border-color: rgba(251, 191, 36, 0.26);
  box-shadow:
    0 0 18px rgba(251, 191, 36, 0.20),
    0 2px 6px rgba(251, 191, 36, 0.12);
}

.dark-mode .lock-notice-icon-wrap svg {
  color: #fcd34d;
}

.dark-mode .lock-notice-icon-wrap::after {
  border-color: rgba(251, 191, 36, 0.22);
}

.dark-mode .lock-notice-badge {
  color: #fcd34d;
  background: rgba(251, 191, 36, 0.12);
  border-color: rgba(251, 191, 36, 0.24);
}

.dark-mode .lock-notice-chip.locked {
  color: #fcd34d;
  background: rgba(251, 191, 36, 0.09);
  border-color: rgba(251, 191, 36, 0.20);
}

.dark-mode .lock-notice-chip.editable {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.09);
  border-color: rgba(74, 222, 128, 0.20);
}
```

- [ ] **Step 2: Build and verify no CSS errors**

```bash
npm run build 2>&1 | grep -i "error\|warn" | head -20
```

Expected: no CSS parse errors.

- [ ] **Step 3: Verify Outcomes page banner visually**

```bash
npm run dev
```

Open the app, navigate to a **locked period's Outcomes page** (is_locked = true). Confirm:
- Banner appears with amber gradient background
- Shimmer sweeps left → right every ~3.5s
- Glowing bottom bar pulses
- Lock icon has pulsing ring
- Dark mode toggle works correctly

- [ ] **Step 4: Commit**

```bash
git add src/styles/components.css
git commit -m "feat(ui): amber glow lock banner — upgrade .lock-notice CSS"
```

---

### Task 2: Add lock banner to CriteriaPage

**Files:**
- Modify: `src/admin/pages/CriteriaPage.jsx:390-404`

The banner block goes in the `return (...)` section, between the panel error `FbAlert` and the page header `div.crt-header`. Condition: `isLocked && periods.viewPeriodId`. All three icons (`Lock`, `LockKeyhole`, `PencilLine`) are already imported at the top of the file.

- [ ] **Step 1: Insert the lock banner JSX**

In `src/admin/pages/CriteriaPage.jsx`, after the panel error block and before `{/* Page header */}`, add:

```jsx
      {/* Lock banner */}
      {isLocked && periods.viewPeriodId && (
        <div className="lock-notice">
          <div className="lock-notice-left">
            <div className="lock-notice-icon-wrap">
              <LockKeyhole size={20} strokeWidth={1.8} />
            </div>
            <div className="lock-notice-badge">locked</div>
          </div>
          <div className="lock-notice-body">
            <div className="lock-notice-title">Evaluation in progress — structural fields locked</div>
            <div className="lock-notice-desc">
              Criteria weights, rubric bands, and outcome mappings cannot be changed while scores exist.
              Labels and descriptions remain editable.
            </div>
            <div className="lock-notice-chips">
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Criterion Weights</span>
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Rubric Bands</span>
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Outcome Mappings</span>
              <span className="lock-notice-chip editable"><PencilLine size={11} strokeWidth={2} /> Labels &amp; Descriptions</span>
            </div>
          </div>
        </div>
      )}
```

The result in context:

```jsx
    <div id="page-criteria">
      {/* Panel error */}
      {panelError && (
        <FbAlert variant="danger" style={{ marginBottom: 16 }}>
          {panelError}
        </FbAlert>
      )}
      {/* Lock banner */}
      {isLocked && periods.viewPeriodId && (
        <div className="lock-notice">
          <div className="lock-notice-left">
            <div className="lock-notice-icon-wrap">
              <LockKeyhole size={20} strokeWidth={1.8} />
            </div>
            <div className="lock-notice-badge">locked</div>
          </div>
          <div className="lock-notice-body">
            <div className="lock-notice-title">Evaluation in progress — structural fields locked</div>
            <div className="lock-notice-desc">
              Criteria weights, rubric bands, and outcome mappings cannot be changed while scores exist.
              Labels and descriptions remain editable.
            </div>
            <div className="lock-notice-chips">
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Criterion Weights</span>
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Rubric Bands</span>
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Outcome Mappings</span>
              <span className="lock-notice-chip editable"><PencilLine size={11} strokeWidth={2} /> Labels &amp; Descriptions</span>
            </div>
          </div>
        </div>
      )}
      {/* Page header */}
      <div className="crt-header">
        ...
```

- [ ] **Step 2: Verify Criteria page banner visually**

With `npm run dev` still running, navigate to a **locked period's Criteria page**.

Confirm:
- Banner appears above the page header
- Three locked chips (Criterion Weights, Rubric Bands, Outcome Mappings) shown in amber
- One editable chip (Labels & Descriptions) shown in green
- Banner does NOT appear for unlocked periods
- Banner does NOT appear when `periods.viewPeriodId` is null (no period selected)

- [ ] **Step 3: Commit**

```bash
git add src/admin/pages/CriteriaPage.jsx
git commit -m "feat(criteria): add amber glow lock banner when period is locked"
```
