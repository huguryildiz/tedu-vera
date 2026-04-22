# Card Interaction Pattern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize tap/hover/focus feedback across all 4 interactive mobile card surfaces using CSS custom property tokens, with no JSX changes.

**Architecture:** Define 7 `--card-i-*` tokens in `:root` (+ dark mode override in `.dark-mode`), then replace hardcoded `rgba(59,130,246,...)` values in `.jc` and org card blocks with those tokens, and add the pattern fresh to projects + periods card rows in a grouped block in `components.css`.

**Tech Stack:** Pure CSS — custom properties, pseudo-class selectors, `box-shadow` transitions

---

### Task 1: Add `--card-i-*` tokens to `variables.css`

**Files:**
- Modify: `src/styles/variables.css:56-57` (`:root` closing)
- Modify: `src/styles/variables.css:229-230` (`.dark-mode` closing)

- [ ] **Step 1: Insert tokens into `:root` in `src/styles/variables.css`**

Find line 56 (`--z-toast` line) and insert the new token block before the closing `}` of `:root`:

```css
  --z-toast:           400;   /* toast notifications, critical alerts */
  /* ── Interactive card interaction tokens ── */
  --card-i-shadow-base:   0 1px 3px rgba(0,0,0,.04), 0 0 0 0 rgba(59,130,246,0);
  --card-i-shadow-hover:  0 0 0 3px rgba(59,130,246,.12), 0 4px 12px rgba(59,130,246,.06);
  --card-i-shadow-active: 0 0 0 2px rgba(59,130,246,.22), 0 2px 6px rgba(59,130,246,.08);
  --card-i-shadow-open:   0 0 0 3px rgba(59,130,246,.14), 0 4px 16px rgba(59,130,246,.08);
  --card-i-shadow-focus:  0 0 0 3px rgba(59,130,246,.28);
  --card-i-bg-active:     rgba(59,130,246,.03);
  --card-i-transition:    border-color .15s, box-shadow .2s, background .1s, transform .1s;
}
```

Use Edit with:
- `old_string`: the `--z-toast` line + `\n}`
- `new_string`: the `--z-toast` line + `\n  /* ── Interactive card interaction tokens ── */\n  --card-i-shadow-base: ...` (7 tokens) + `\n}`

- [ ] **Step 2: Add dark mode override inside `.dark-mode` block**

Find line 229 (`--glass-footer-blur` line) and add the dark-mode shadow-base override before the closing `}`:

```css
  --glass-footer-blur:blur(16px);
  --card-i-shadow-base:   0 1px 4px rgba(0,0,0,.25), 0 0 0 0 rgba(59,130,246,0);
}
```

Use Edit with:
- `old_string`: `  --glass-footer-blur:blur(16px);\n}`
- `new_string`: `  --glass-footer-blur:blur(16px);\n  --card-i-shadow-base:   0 1px 4px rgba(0,0,0,.25), 0 0 0 0 rgba(59,130,246,0);\n}`

- [ ] **Step 3: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds with no CSS errors.

---

### Task 2: Refactor `.jc` states in `jurors.css` to use tokens

**Files:**
- Modify: `src/styles/pages/jurors.css:387-413`

The `.jc` block (lines 378–413) has hardcoded `rgba(59,130,246,...)` values and a `.dark-mode .jc` override. Replace them with token references. The dark mode override becomes unnecessary because `--card-i-shadow-base` now resolves to its dark variant automatically when `.dark-mode` is on the ancestor.

- [ ] **Step 1: Replace base shadow + transition + remove dark-mode override**

Exact old block (lines 387–392):
```css
    /* Pre-state shadow keeps the glow transition smooth */
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03), 0 0 0 0 rgba(59, 130, 246, 0);
    transition: border-color 0.15s, box-shadow 0.2s, background 0.1s, transform 0.1s;
  }
  .dark-mode .jc {
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25), 0 0 0 0 rgba(59, 130, 246, 0);
  }
```

New block:
```css
    /* Pre-state shadow keeps the glow transition smooth */
    box-shadow: var(--card-i-shadow-base);
    transition: var(--card-i-transition);
  }
```

Use Edit — old_string is the 7-line block above, new_string is the 3-line block above.

- [ ] **Step 2: Replace hardcoded values in `:hover`, `:active`, `.menu-open`, `:focus-visible`**

Exact old block (lines 394–413):
```css
  .jc:hover {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12), 0 4px 12px rgba(59, 130, 246, 0.06);
  }
  .jc:active {
    transform: scale(0.985);
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.22), 0 2px 6px rgba(59, 130, 246, 0.08);
    background: rgba(59, 130, 246, 0.03);
    opacity: 1;
  }
  .jc.menu-open {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.14), 0 4px 16px rgba(59, 130, 246, 0.08);
  }
  .jc:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.28);
  }
```

New block:
```css
  .jc:hover {
    border-color: var(--accent);
    box-shadow: var(--card-i-shadow-hover);
  }
  .jc:active {
    transform: scale(0.985);
    border-color: var(--accent);
    box-shadow: var(--card-i-shadow-active);
    background: var(--card-i-bg-active);
    opacity: 1;
  }
  .jc.menu-open {
    border-color: var(--accent);
    box-shadow: var(--card-i-shadow-open);
  }
  .jc:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: var(--card-i-shadow-focus);
  }
```

Use Edit — match the old block exactly (all 20 lines).

- [ ] **Step 3: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds.

---

### Task 3: Refactor org card states in `components.css` to use tokens

**Files:**
- Modify: `src/styles/components.css:2977-3001`

The org card block at lines 2960–3001 (inside `@media (max-width: 768px) and (orientation: portrait)`) has the same hardcoded values plus a `.dark-mode` override and uses `scale(0.99)` on `:active` instead of `scale(0.985)`. Refactor to tokens and standardize the scale value.

- [ ] **Step 1: Replace base shadow + transition + remove dark-mode override**

Exact old block (lines 2977–2982):
```css
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03), 0 0 0 0 rgba(59, 130, 246, 0);
    transition: border-color 0.15s, box-shadow 0.2s, background 0.1s, transform 0.1s;
  }
  .dark-mode #page-organizations .organizations-table tbody tr {
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25), 0 0 0 0 rgba(59, 130, 246, 0);
  }
```

New block:
```css
    box-shadow: var(--card-i-shadow-base);
    transition: var(--card-i-transition);
  }
```

Use Edit.

- [ ] **Step 2: Replace hardcoded values in the 4 interaction states + standardize scale**

Exact old block (lines 2983–3001):
```css
  #page-organizations .organizations-table tbody tr:hover {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12), 0 4px 12px rgba(59, 130, 246, 0.06);
  }
  #page-organizations .organizations-table tbody tr:active {
    transform: scale(0.99);
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.22), 0 2px 6px rgba(59, 130, 246, 0.08);
    background: rgba(59, 130, 246, 0.03);
  }
  #page-organizations .organizations-table tbody tr.menu-open {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.14), 0 4px 16px rgba(59, 130, 246, 0.08);
  }
  #page-organizations .organizations-table tbody tr:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.28);
  }
```

New block (note `scale(0.99)` → `scale(0.985)`):
```css
  #page-organizations .organizations-table tbody tr:hover {
    border-color: var(--accent);
    box-shadow: var(--card-i-shadow-hover);
  }
  #page-organizations .organizations-table tbody tr:active {
    transform: scale(0.985);
    border-color: var(--accent);
    box-shadow: var(--card-i-shadow-active);
    background: var(--card-i-bg-active);
  }
  #page-organizations .organizations-table tbody tr.menu-open {
    border-color: var(--accent);
    box-shadow: var(--card-i-shadow-open);
  }
  #page-organizations .organizations-table tbody tr:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: var(--card-i-shadow-focus);
  }
```

Use Edit — match the old block exactly (19 lines).

- [ ] **Step 3: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds.

---

### Task 4: Add grouped interaction block for projects + periods in `components.css`

**Files:**
- Modify: `src/styles/components.css:3720` (append after last line)

The `#projects-main-table tbody tr` and `.sem-table tbody tr` card rows (defined in `layout.css`) have no interaction states at all. Add them in a new `@media (max-width: 768px)` block appended to the end of `components.css`. This keeps all card interaction states in one file (`components.css`) rather than mixing them into the layout file.

- [ ] **Step 1: Append new block to end of `src/styles/components.css`**

Exact old string (last 2 lines of file):
```css
    text-align: center;
  }
}
```

New string:
```css
    text-align: center;
  }
}

/* ── Interactive card states — projects + periods ─────────── */
@media (max-width: 768px) {
  #projects-main-table tbody tr,
  .sem-table tbody tr {
    box-shadow: var(--card-i-shadow-base);
    transition: var(--card-i-transition);
  }
  #projects-main-table tbody tr:hover,
  .sem-table tbody tr:hover {
    border-color: var(--accent);
    box-shadow: var(--card-i-shadow-hover);
  }
  #projects-main-table tbody tr:active,
  .sem-table tbody tr:active {
    transform: scale(0.985);
    border-color: var(--accent);
    box-shadow: var(--card-i-shadow-active);
    background: var(--card-i-bg-active);
  }
  #projects-main-table tbody tr.menu-open,
  .sem-table tbody tr.menu-open {
    border-color: var(--accent);
    box-shadow: var(--card-i-shadow-open);
  }
  #projects-main-table tbody tr:focus-visible,
  .sem-table tbody tr:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: var(--card-i-shadow-focus);
  }
}
```

Use Edit — the old_string is the last 3 lines of the file (starting with `    text-align: center;`).

Note on `.sem-table tbody tr.sem-row-current`: It has `border-color: rgba(59,130,246,0.2)` as a base style (slightly blue border for the active period). The `:hover` state overrides this to `var(--accent)` — this is intentional and desirable since hover makes it more prominent.

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds.

---

### Task 5: Add `cursor: pointer` to `.sem-table tbody tr` in `layout.css`

**Files:**
- Modify: `src/styles/layout.css:1010-1024`

The `.sem-table tbody tr` block (line 1010) is missing `cursor: pointer`. The periods table rows are clickable (they open an edit drawer), so the pointer cursor is needed for mouse users. `#projects-main-table tbody tr` already has `cursor: pointer` (line 954) — no change needed there.

- [ ] **Step 1: Add `cursor: pointer` to `.sem-table tbody tr`**

Exact old block (lines 1010–1024):
```css
  .sem-table tbody tr {
    display: grid;
    grid-template-columns: minmax(0,1fr) minmax(0,1fr) auto;
    grid-template-areas:
      "name name actions"
      "projects jurors status"
      "updated updated updated";
    align-items: center;
    row-gap: 4px;
    column-gap: 8px;
    padding: 8px 11px 7px;
    background: linear-gradient(180deg, rgba(15,23,42,0.03), rgba(15,23,42,0.01));
    border-radius: 12px;
    border: 1px solid var(--border);
  }
```

New block:
```css
  .sem-table tbody tr {
    display: grid;
    grid-template-columns: minmax(0,1fr) minmax(0,1fr) auto;
    grid-template-areas:
      "name name actions"
      "projects jurors status"
      "updated updated updated";
    align-items: center;
    row-gap: 4px;
    column-gap: 8px;
    padding: 8px 11px 7px;
    background: linear-gradient(180deg, rgba(15,23,42,0.03), rgba(15,23,42,0.01));
    border-radius: 12px;
    border: 1px solid var(--border);
    cursor: pointer;
  }
```

Use Edit.

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds.

---

### Task 6: Manual Testing

**No files to edit.** Run the app and verify each case from the spec.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:5173` and log in as admin.

- [ ] **Step 2: Mobile simulation — open DevTools → toggle device toolbar (375px width)**

- [ ] **Step 3: Test org cards (Organizations page)**
  - Tap a card → blue flash on tap (`:active`)
  - Open kebab menu → blue border persists while menu is open (`.menu-open`)
  - Close menu → border reverts to default
  - Hover (desktop): glow visible

- [ ] **Step 4: Test juror cards (Jurors page)**
  - Same flow as org cards
  - Verify `.dark-mode .jc` override is gone and dark mode still looks correct

- [ ] **Step 5: Test project cards (Projects page)**
  - Tap → blue flash + scale on tap
  - Open kebab menu → blue border persists
  - Hover: glow visible

- [ ] **Step 6: Test period cards (Periods / Evaluation Periods page)**
  - Tap → blue flash
  - Verify pointer cursor is visible on mouse hover
  - If kebab present: menu-open border persists

- [ ] **Step 7: Keyboard navigation**
  - Tab through each card type → `:focus-visible` ring visible, no `outline` artifact

- [ ] **Step 8: Dark mode — toggle `.dark-mode` on body**
  - Glow visible but not garish on all 4 card types

- [ ] **Step 9: Layout shift check — tap rapidly**
  - No content jump on any card type (border width stays 1px throughout)

- [ ] **Step 10: Exclusion check**
  - Reviews table rows: no blue border on hover/tap
  - Audit log rows: no blue border on hover/tap (only bg tint)
  - Modal/drawer surfaces: no blue border bleed-through
