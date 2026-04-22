# Org Card B-Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the organizations table mobile card (in `components.css`) to match Option B — left accent bar, styled mono code, cleaner meta grid.

**Architecture:** CSS-only change inside the existing `@media` block that transforms `.organizations-table tbody tr` into stacked cards. No JSX changes needed; `data-label` attributes remain unchanged.

**Tech Stack:** CSS custom properties (`--accent`, `--mono`, `--border`, `--bg-card`, `--text-*`)

---

### Task 1: Apply Option B card styles

**Files:**
- Modify: `src/styles/components.css` lines ~3118–3233

- [ ] **Step 1: Add `position: relative` + left accent bar to the `tbody tr` rule**

Replace the existing `tbody tr` rule (around line 3118):

```css
#page-platform-control .organizations-table tbody tr {
  display: grid;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "org actions"
    "program program"
    "code status"
    "admins admins"
    "created period";
  gap: 8px 10px;
  padding: 13px 13px 13px 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-card);
  box-shadow: var(--card-i-shadow-base);
  transition: var(--card-i-transition);
  position: relative;
  overflow: hidden;
}
#page-platform-control .organizations-table tbody tr::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, var(--accent) 0%, var(--accent-hover, var(--accent)) 100%);
  border-radius: 12px 0 0 12px;
}
```

- [ ] **Step 2: Style the Code cell — mono color, no micro-label border**

Replace the existing `td[data-label="Code"]` rule:

```css
#page-platform-control .organizations-table tbody td[data-label="Code"] {
  display: block;
  grid-area: code;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  font-family: var(--mono, "SF Mono", "Fira Code", monospace);
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.03em;
}
#page-platform-control .organizations-table tbody td[data-label="Code"]::before {
  color: var(--text-tertiary);
}
```

- [ ] **Step 3: Status cell — keep badge but right-align cleanly**

The existing rule is fine; confirm it reads:

```css
#page-platform-control .organizations-table tbody td[data-label="Status"] {
  display: block;
  grid-area: status;
  text-align: right;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
#page-platform-control .organizations-table tbody td[data-label="Status"]::before {
  text-align: right;
}
```

No change needed here — the `badge-success` already renders correctly.

- [ ] **Step 4: Verify in browser**

Run `npm run dev`, open `http://localhost:5173`, navigate to Admin → Organizations on a narrow viewport (≤ 640 px via DevTools). Confirm:
- Left accent bar visible on each card
- Code value is `var(--accent)` colored mono text
- Cards look clean, no clipping of the accent bar
- Dark mode: accent bar and mono color still correct

- [ ] **Step 5: Check nested-panel rule**

```bash
npm run check:no-nested-panels
```

Expected: no new violations.
