# Juror Mobile Portrait Card Redesign

**Date:** 2026-04-24
**Status:** Approved — ready for implementation

---

## Problem

The mobile portrait card for jurors renders redundant information across two blocks:

- Stats row: `SCORED | ASSIGNED | DONE%`
- Progress block: `Progress` label + `5 / 5 projects` + progress bar

All three communicate the same data. Additionally, the footer timestamp has no label, making it ambiguous (last login? last score submission? last seen?).

---

## Goal

Remove the redundancy, make the progress bar the primary information element, and add a semantic label to the timestamp. Desktop table rows are untouched.

---

## Design (Option B — Progress Hero)

### What changes

| Element | Before | After |
|---|---|---|
| Stats row (SCORED / ASSIGNED / DONE%) | Present | **Removed** |
| Progress block header | `Progress` + `5 / 5 projects` | Unchanged |
| Progress bar | Present | Unchanged |
| Percentage value | Inside stats row | **Moved to footer right** |
| Timestamp | `just now` (no label) | `Last active: just now` |
| Footer structure | Clock + relative time | Clock + `Last active:` label + relative time + `%` on right |

### Card structure (after)

```
┌────────────────────────────────────────┐
│ [AK]  Dr. Alper Kılıç                 ⋮ │
│       TED University, EE               │
│       [✏ Editing]                      │
├────────────────────────────────────────┤
│ Progress                5 / 5 projects │
│ ████████████████████████████████████ │
│ ⏱ Last active: just now        100%   │
└────────────────────────────────────────┘
```

### Percentage display rules

| Condition | Value shown | Color |
|---|---|---|
| `total === 0` | Hidden (no % rendered) | — |
| `scored === 0, total > 0` | `0%` | amber (`val-amber`) |
| `0 < scored < total` | `X%` | amber (`val-amber`) |
| `scored >= total, total > 0` | `100%` | green (`val-done`) |

### Timestamp rules

- Source field: `lastSeenAt \|\| last_activity_at \|\| finalSubmittedAt \|\| final_submitted_at` (no change)
- Label: `Last active:` prefix, always shown
- If no timestamp: `Last active: Never`
- Format: `formatRelative(lastActive)` (no change)

---

## Scope

- **File:** `src/admin/features/jurors/components/JurorsTable.jsx` — only the `col-mobile-card` block inside `JurorRow`
- **CSS:** `src/admin/features/jurors/JurorsPage.css` — mobile card styles (`.jc-stats`, `.jc-footer`, `.jc-prog-*`)
- **Desktop:** Not touched — desktop `<tr>` layout unchanged
- **Tablet/portrait breakpoint:** Follows existing `@media` rule already in place

---

## Out of Scope

- Desktop table columns
- Juror detail drawer
- Other page mobile cards (projects, periods, etc.)
- Backend field changes — `lastSeenAt` semantics are not modified
