# Juror Card — Compact Mobile Portrait Design

**Date:** 2026-04-28
**Status:** Approved

---

## Goal

Reduce the juror mobile portrait card height by ~40% (from ~148px to ~88px) while preserving all current information and improving visual density. The redesigned card fits more jurors on screen during live evaluation days without sacrificing readability.

## Non-Goals

- No changes to desktop or landscape tablet layout — mobile portrait only.
- No changes to the juror list filtering, search, or kebab menu actions.
- No changes to `JurorStatusPill` component itself — the card consumes it as-is.
- No changes to the data model or API layer.

---

## Design

### Layout: Two-Row Card

```
┌──────────────────────────────────────────────┐
│ [40px avatar]  [Name ···] [Status Pill]  [⋮] │  ← Row 1 ~46px
│                [org text]                     │
├──────────────────────────────────────────────┤
│ [═══════════════▓▓▓░░░░]  3/5  12m ago        │  ← Row 2 ~26px (with border-top)
└──────────────────────────────────────────────┘
                                         ~88px total
```

### Row 1 — Header

| Element | Spec |
|---|---|
| Avatar | 40px diameter (↓ from 50px), initials, colored background |
| Name | `font-size: 13px; font-weight: 800; color: #1a1d2e` |
| Status pill | `flex-shrink: 0`, inline with name on same flex row |
| Org text | `font-size: 10.5px; color: #9ca3af`, second line below name |
| Kebab (⋮) | 28×28px, `border-radius: 7px`, `border: 1px solid #e5e7eb` |

**Name overflow:** The name element has `flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`. The pill has `flex-shrink: 0` so it never wraps — the name truncates instead. At 390px with the longest pill ("Ready to Submit") ~120px remains for the name.

**Row 1 padding:** `9px 10px 8px` (top/side/bottom).

### Row 2 — Progress

| Element | Spec |
|---|---|
| Progress bar | `height: 5px; border-radius: 99px; flex: 1` |
| Fill — complete | `background: linear-gradient(90deg, #22c55e, #86efac)` |
| Fill — partial | `background: linear-gradient(90deg, #6c63ff, #a78bfa)` |
| Fill — empty | `background: #e5e7eb; width: 0%` |
| Fraction | `font-family: var(--mono); font-size: 9.5px; font-weight: 700` |
| Fraction color — done | `#22c55e` |
| Fraction color — partial | `#60a5fa` |
| Fraction color — none | `#d1d5db` |
| Last-active | `font-size: 9px; color: #d1d5db; font-family: var(--mono)` |
| Border-top | `1px solid var(--border)` separates from Row 1 |

**Row 2 padding:** `6px 10px 8px` (top/side/bottom).

### Status Pill Tokens

Pill colors come from `src/styles/status-pills.css` CSS variables — no new tokens needed.

| State | Class | Icon (Lucide) | Background token | Text token |
|---|---|---|---|---|
| `editing` | `.pill-editing` | `PencilLineIcon` | `--pill-editing-bg` | `--pill-editing-text` |
| `completed` | `.pill-completed` | `CircleCheckIcon` | `--pill-completed-bg` | `--pill-completed-text` |
| `ready_to_submit` | `.pill-ready` | `SendIcon` | `--pill-ready-bg` | `--pill-ready-text` |
| `in_progress` | `.pill-progress` | `ClockIcon` | `--pill-progress-bg` | `--pill-progress-text` |
| `not_started` | `.pill-not-started` | `CircleSlashIcon` | `--pill-not-started-bg` | `--pill-not-started-text` |

### Selection State

Tap anywhere on the card → `is-selected` class added, border changes to `var(--accent)`, shadow ring added. Follows the existing `useCardSelection` hook — no change to the hook itself.

```css
.mcard.is-selected { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
```

---

## Files to Change

| File | Change |
|---|---|
| `src/admin/features/jurors/components/JurorsTable.jsx` | Restructure mobile card JSX: merge `.jc-header` + `.jc-prog-block` + `.jc-footer` into two rows (`.jc-row1` + `.jc-row2`); move pill into name row; remove separate progress label and footer |
| `src/admin/features/jurors/JurorsPage.css` | Replace portrait-only mobile card CSS under `@media (max-width: 768px) and (orientation: portrait)` with new two-row styles |

No other files touched. `JurorStatusPill.jsx` and `status-pills.css` are consumed as-is.

---

## Success Criteria

1. All 5 status states render correctly with correct icon and pill color.
2. Card height ≤ 90px on a 390px viewport.
3. Long name + "Ready to Submit" pill: name truncates with ellipsis, pill is never clipped or wrapped.
4. `is-selected` state: accent border visible, kebab still accessible.
5. No regression on desktop or landscape layout — portrait `and (orientation: portrait)` scoping ensures this.
6. `npm run build` passes with no new warnings.
7. `npm test -- --run` passes (no existing test depends on the removed `.jc-footer` or `.jc-prog-block` class selectors — verify with grep).

---

## Risks

- **Test selector drift:** Any existing unit test that queries `.jc-footer`, `.jc-prog-block`, or `.jc-header` by class will break. Grep `src/admin/__tests__/` and `e2e/` for these selectors before and after — update in the same commit.
- **Dark mode:** The two-row card inherits `--border` and `--card-bg` tokens from the global theme; no extra dark mode CSS should be needed. Verify in dark mode after implementation.
