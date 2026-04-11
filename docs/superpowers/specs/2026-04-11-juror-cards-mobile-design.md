# Juror Cards Mobile Portrait Redesign

**Date:** 2026-04-11
**Status:** Approved
**Scope:** `src/styles/pages/jurors.css` + `src/admin/pages/JurorsPage.jsx`

---

## Problem

The current mobile jurors layout collapses the desktop table into a 2-row flex card, but the result is cramped and visually inconsistent with VERA's dark theme. The layout shows avatar + score on row 1 and status pill + action icons on row 2 — no hierarchy, no progress context, and actions are exposed as icon buttons that are hard to tap.

---

## Design Decision

**Hybrid of Option C (compact list) + Option A (progress bar).**

- C's density: 5–6 cards visible at once without scrolling
- A's progress bar: the most actionable metric on evaluation day ("who's behind?")
- Kebab menu (···) replaces exposed action icon columns — opens existing action dropdown
- Whole card is tappable → opens juror drawer (same as desktop row click)

---

## Card Anatomy

Each card has two visual rows separated by a 1px hairline divider:

### Row 1 — Identity + Status + Score

```
[ Avatar 34×34 ] [ Name (semibold) ]      [ Score ] [ ··· ]
                 [ Affiliation (muted) ]   [ Status pill   ]
```

- **Avatar:** 34×34px, 10px border-radius, gradient background, initials. Color is deterministic per juror — same index-based CSS class (`jb-avatar-0` … `jb-avatar-N`) already used by the desktop `JurorBadge` component.
- **Name:** 12.5px, 600 weight, single line, ellipsis overflow.
- **Affiliation:** 10.5px, muted (`#475569`), ellipsis overflow.
- **Score:** 13px, 700 weight, tabular-nums. Color-coded:
  - ≥ 90 → `#34d399` (green)
  - 74–89 → `#60a5fa` (blue)
  - 60–73 → `#fb923c` (orange)
  - < 60 → `#475569` (muted)
  - No scores yet → `—` (muted dash)
- **Status pill:** Same `.pill-*` classes as desktop (done / edit / start / prog).
- **Kebab button (···):** 24×24px, 7px radius. Tapping opens the existing action dropdown (see below). Does NOT open the drawer.

### Row 2 — Progress

```
[ ████████████░  4px bar  ] [ 11/12 ]
```

- 4px height bar, full-width minus 12px padding each side.
- Fill color matches status: green (completed), blue (editing), orange (in-progress), slate (not started).
- Right label: `completed/total` — completed count in lighter color, total in muted.
- If juror has no project assignments → bar is hidden, label shows `0/0`.

---

## Interaction Model

| Target | Action |
|--------|--------|
| Anywhere on card (except ···) | Open juror detail/manage drawer |
| ··· button | Open action dropdown (anchored to button, top-right of card) |
| Outside dropdown | Dismiss dropdown |

### Action Dropdown Items

Identical to desktop action menu:

1. **Edit Juror** (pencil icon)
2. **Reset PIN** (lock icon)
3. **View Reviews** (document icon)
4. *(separator)*
5. **Remove Juror** (trash icon, danger red)

Dropdown is absolutely positioned, anchored top-right inside the card. Other cards dim to `opacity: 0.35` while open — achieved by adding a `has-open-menu` class on the `<tbody>` wrapper, with a CSS rule `.has-open-menu .jc:not(.menu-open) { opacity: 0.35 }`.

---

## CSS Strategy

All changes are inside `@media (max-width: 768px)` in `src/styles/pages/jurors.css`. The existing `display: contents` on `#jurors-main-table` and `thead { display: none }` rules stay as-is. Only the `tbody tr` flex layout changes.

**New structure for each `<tr>` card:**

```
.tr (flex column)
  .jc-main (flex row)
    .jc-avatar
    .jc-info (.jc-name + .jc-affil)
    .jc-right (.jc-top-right[score + kebab] + .jc-pill)
  .jc-divider
  .jc-progress (.jc-bar-wrap + .jc-proj-count)
```

The kebab button and dropdown are injected via JSX (not CSS-only) since dropdown positioning and dismiss-on-outside-click require JS.

---

## JSX Changes

`src/admin/pages/JurorsPage.jsx` — inside the mobile card render path:

1. Replace the current 2-row layout with the new 3-element structure (main + divider + progress).
2. Add `<button className="jc-kebab">···</button>` in the top-right cluster.
3. Wire kebab `onClick` (with `e.stopPropagation()`) to toggle a `openMenuId` state.
4. Render `<div className="action-menu">` conditionally when `openMenuId === juror.id`.
5. Add `onClick` on the card `<tr>` to call existing `handleEditJuror(juror)` (opens drawer).
6. Add global click listener to dismiss dropdown on outside click (same pattern as `CustomSelect`).

---

## What Does NOT Change

- Desktop layout — all CSS changes are inside `@media (max-width: 768px)`
- Existing `.jb-badge`, `.pill-*`, `.jurors-group-bar` classes — kept for desktop; new classes are additive for mobile
- Drawer components — unchanged, just called from new tap target
- Action functions — `handleEditJuror`, `handleResetPIN`, `handleRemoveJuror`, `handleViewReviews` — unchanged signatures

---

## Files Affected

| File | Change |
|------|--------|
| `src/styles/pages/jurors.css` | Replace `@media (max-width: 768px)` tr/td rules with new card layout classes |
| `src/admin/pages/JurorsPage.jsx` | Add mobile card structure + kebab state + dropdown render |
