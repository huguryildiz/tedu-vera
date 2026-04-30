# Org Management — Compact Card Design

**Date:** 2026-04-30
**Status:** Approved
**Scope:** Mobile portrait card layout for `/admin/organizations` (`OrgTable.jsx` + `OrganizationsPage.css`)

---

## Goal

Replace the current tall 4-cell grid card (≈120px) with a compact two-row card (≈64px) that shows the same information density in less vertical space, letting the user see more organizations without scrolling.

## Non-goals

- Desktop table layout — unchanged
- Drawer components (`OrgDrawers.jsx`) — unchanged
- Data fetching or API layer — unchanged
- Dark mode tokens — use existing CSS variables; no new token definitions needed

---

## Design Spec

### Card anatomy

```
┌──────────────────────────────────────────────────────┐
│ [Avatar 34px] AAS CanSat Competition  ✓ Active  [⋮] │  ← Row 1
│              CANSAT · 👥 1 admin · 30.04.2026        │  ← Row 2
└──────────────────────────────────────────────────────┘
```

### Row 1

| Element | Value |
|---|---|
| Avatar | 34×34px, border-radius 9px, colored initials (existing `getOrgHue` / `getOrgInitials`) |
| Org name | 13.5px, fw700, `#111827`, flex:1, single-line truncate with ellipsis |
| Status badge | Pill: Active → green (`#dcfce7` bg, `#15803d` text) · Archived → amber (`#fef3c7` bg, `#92400e` text) |
| Kebab | 26×26px tap target, `MoreVertical` lucide icon, existing action menu |

Gap between avatar and name: 9px.

### Row 2

Indented 43px (avatar 34px + gap 9px) to align under the org name.

Elements left-to-right, separated by 3px bullet dots (`#d1d5db`):

1. **Code chip** — monospace pill, `#f3f4f6` bg, `#e5e7eb` border, 10px font, `CANSAT` style
2. **Admin count** — `Users` lucide icon (10px) + `N admin` text (10.5px)
   - Normal: `#6b7280` text + `#9ca3af` icon
   - **Unstaffed (0 admins):** `#d97706` text + icon (amber warning, fw600)
   - Pluralization: `0 admin`, `1 admin`, `2 admins` (singular for 1, plural otherwise)
3. **Created date** — `DD.MM.YYYY` format, 10.5px, `#6b7280`

### Card container

| Property | Value |
|---|---|
| Background | `#fff` |
| Border | `1px solid #e5e7eb` (use `var(--border)`) |
| Border-radius | 13px |
| Padding | `10px 12px` |
| Margin-bottom | 8px |

### Filter strip (unchanged pills, confirmed)

`All · Active · Archived · Unstaffed` — existing filter logic, visual update to pill style only if needed.

---

## Behavior

- Kebab menu actions: identical to current (View, Edit, Manage Admins, Enable/Disable, Delete)
- Selection model: `.is-selected` via `useCardSelection` hook — unchanged
- No row-level `onClick` (no tap-to-open) — kebab is sole entry point (per ui-conventions.md)
- Long org names truncate with ellipsis at row 1; full name visible in View drawer

---

## Files to change

| File | Change |
|---|---|
| `src/admin/features/organizations/components/OrgTable.jsx` | Replace mobile card JSX with new two-row layout |
| `src/admin/features/organizations/OrganizationsPage.css` | Replace old mobile card styles with new compact card rules (scoped to `@media (max-width: 768px) and (orientation: portrait)`) |

No new components. No new hooks. No API changes.

---

## CSS scope rule

All new card styles must be scoped to:
```css
@media (max-width: 768px) and (orientation: portrait) { … }
```

Never use `@media (max-width: 768px)` alone — would break landscape (which must show desktop table per ui-conventions.md).

---

## Success criteria

1. Mobile portrait: new compact card renders for every org row
2. `0 admin` orgs show amber warning color on icon + text
3. Long org names truncate gracefully (no overflow)
4. Landscape orientation: desktop table layout unchanged
5. `npm run check:no-native-select` passes
6. `npm test -- --run` passes
7. `npm run build` clean
8. Live app: cards render correctly against real DB data
