# Heatmap Mobile Portrait Redesign — Design Spec

**Date:** 2026-04-18
**Scope:** `src/admin/pages/HeatmapPage.jsx` mobile portrait layout + `src/styles/pages/heatmap.css`
**Motivation:** Current mobile portrait view renders the full desktop juror × project table with horizontal scroll. Score cells are 9px cramped, juror names wrap awkwardly, the experience is unreadable on phones.

---

## Goals

- Replace the mobile portrait table with a juror-first card list optimized for phones.
- Preserve every capability the desktop heatmap already offers: criteria tabs, project averages, partial/empty cells, status pills, sort.
- Match the "premium SaaS" standard already in place on other admin pages (Organizations, Reviews).
- Desktop landscape / tablet views are unchanged.

## Non-Goals

- No new data, no new RPCs. UI refactor only.
- No change to Rankings or other admin pages.
- No project-first or dual-toggle view — that mental model is already served by Rankings.

---

## Layout

Mobile portrait (`max-width: 900px` + `orientation: portrait`) page structure:

```
Page header   — "Heatmap" title + description  (unchanged)
Criteria tabs — All / Tech / Written / Oral / Teamwork  (unchanged; horizontal scroll if needed)
Action bar    — Sort dropdown (left) · Export button (right)
Juror cards   — one card per visible juror
Project Avgs  — single summary card
Legend        — Low…High range + partial note  (unchanged)
```

- The existing `<table>` is hidden via CSS on mobile portrait (`display: none`).
- A new `<div className="heatmap-mobile">` is rendered unconditionally in JSX and shown only on mobile portrait (`display: block` inside the media query).
- Desktop / landscape rendering is untouched.

---

## Juror Card

### Anatomy

```
┌───────────────────────────────────┐
│ [avatar] Name                     │
│          Affiliation       ╭────╮ │
│          ✓ Completed       │80.7│ │   ← 72px donut, band-colored
│                            │Avg │ │
│                            ╰────╯ │
│  5 projects · ●●●◐●  [Tap ▾]      │   ← collapsed summary
├───────────────────────────────────┤   ← divider only when expanded
│ P1  Wearable ECG Monitor     [88] │
│ P2  MIMO Antenna Design      [76] │
│ P3  Solar Monitor Station    [78] │
│ P4  RF Beamforming           [92] │
│ P5  Smart Grid Controller    [!]  │
│                    [Tap ▴ Close]  │
└───────────────────────────────────┘
```

### Header

- Left column: `JurorBadge` (existing component, avatar + name + affiliation) and `JurorStatusPill` underneath.
- Right column: donut (72px × 72px) showing the juror's average for the active tab.
  - Stroke color derived from the same score band used for cells: `getScoreBgVar(avg, tabMax)` (reuse existing helper — but map to foreground/stroke variant).
  - Track stroke: `--border-subtle` or equivalent neutral.
  - Center label: `{avg.toFixed(1)}` large (18px, `font-weight: 700`) + `Avg` micro-label (8px uppercase, `--text-tertiary`).
  - If the juror has no scored cells for the active tab: render an empty ring (0% fill) with `—` in the center.

### Collapsed summary

Rendered directly below the header when the card is collapsed:

- Text: `{projectCount} projects · `
- Mini sparkline: one 6×6 square per project, colored with the same score-band variable (`getScoreBgVar(score, max)`). Partial cells use `--score-partial-bg`, unscored cells use `--border-subtle`.
- Trailing `Tap ▾` hint in `--text-tertiary`.

### Expanded state

- Replaces the collapsed summary with the full project row list + a `Tap ▴ Close` row at the bottom.
- Each row is a three-column grid: `P#` (10px bold, `--text-secondary`) · project title (11px, truncate with ellipsis) · score pill.
- Score pill:
  - Scored: filled with `getScoreBgVar(score, max)`, number centered.
  - Partial: filled with `--score-partial-bg`, displays score + `!` badge, keeps the existing `.m-cell-tip` tooltip pattern.
  - Unscored: muted `—`, no background.
- Rows separated by `border-top: 1px dashed var(--border-subtle)`; first row has no top border. No inner panel backgrounds (`no-nested-panels` rule).

### Collapse / expand interaction

- Default state: all cards **collapsed**.
- Tap target: the entire card header area (avatar block + donut + summary strip). Clicking the score pill in an expanded row should **not** toggle.
- State is local React state (`Map<jurorKey, boolean>`). No persistence across reloads, no URL param.
- This is explicitly permitted under the `no tap-to-open` rule — that rule forbids row-level navigation/drawer opens, not accordion self-expansion (same exception that covers CriteriaPage inline editors).

---

## Sort Control

- Single `CustomSelect` in the mobile action bar. Replaces desktop's two independent sort mechanisms (juror-header sort and group-column sort).
- Options, in order:
  1. `Avg ↓` — default
  2. `Avg ↑`
  3. `Name A-Z`
  4. `Name Z-A`
  5. `Status` — completed first, then in-progress, then not started
- Sort derives from existing `useGridSort` hook where possible. Extend `toggleJurorSort` usage or add a second branch that accepts a mobile sort key; the desktop behavior must remain bit-for-bit identical.
- Group-based sort has no equivalent on mobile — it does not fit the juror-first card metaphor and is intentionally dropped for portrait.

---

## Criteria Tabs

- Identical to desktop: `All Criteria / Tech / Written / Oral / Teamwork` (driven by `criteriaConfig`).
- `.matrix-tabs` container gains `overflow-x: auto` on mobile so long tab sets scroll horizontally inside the bar without affecting page layout.
- Switching tabs re-computes the donut average, summary sparkline, score pills, and the Project Averages card — all via the existing `getCellDisplay` / `jurorRowAvgs` / `visibleAverages` memo chain.

---

## Project Averages Card

A single summary card rendered after the juror cards, serving the same purpose as desktop's `<tfoot>` row.

```
┌───────────────────────────────────┐
│ Project Averages                  │
├───────────────────────────────────┤
│ P1  Wearable ECG Monitor     87.3 │
│ P2  MIMO Antenna Design      77.7 │
│ P3  Solar Monitor Station    78.3 │
│ ...                               │
│ ─────────────────────────────────│
│ Overall                     82.1  │   ← bold
└───────────────────────────────────┘
```

- Neutral styling — no color fills, the heatmap signal lives on juror cards.
- Rows reuse the `P# · title · value` layout from juror cards.
- Overall average is the last row, separated by a solid border, with `font-weight: 600`.
- All values update with the active tab (`visibleAverages[i]` and `overallAvg`).
- If `overallAvg` is `null`, card renders with `—` in every row.

---

## Edge Cases

| Case | Behavior |
|------|----------|
| No visible jurors | Show existing empty message inside a single neutral card. |
| Juror has zero scored cells for active tab | Donut renders as empty ring + `—` center; collapsed summary shows `0 projects scored`. |
| Row cell unscored | Muted `—` pill, `aria-label="{title}: not scored"`. |
| Row cell partial | Score + `!` badge, `.m-cell-tip` tooltip `Partial · N / M`. |
| Project list > ~10 | No scroll inside the card — full expanded list flows vertically, outer page scrolls. |
| Long project title | Single-line truncate with ellipsis on the title column only. |

---

## CSS Strategy

All changes stay within `src/styles/pages/heatmap.css`.

- Desktop rules remain untouched. The existing `@media (max-width: 900px) and (orientation: portrait)` block gains:
  - `.matrix-wrap table.matrix-table { display: none; }`
  - `.matrix-footer` stays visible (legend remains useful).
  - `.heatmap-mobile { display: block; }`
- A new `.heatmap-mobile` rule set defines: card container, header, donut wrapper, summary strip, row grid, project-averages card.
- All colors come from existing tokens (`--score-*-bg`, `--border`, `--border-subtle`, `--text-*`). No new color tokens.
- Field error ring / FbAlert / nested-panel rules all respected — no new inner panel backgrounds, no inline red text, no raw SVG.
- Lucide icons only: `ChevronDown` / `ChevronUp` for the expand cue.

---

## Component Boundaries

New components, each in `src/admin/pages/heatmap/` (new directory):

- `HeatmapMobileList.jsx` — top-level mobile container; owns the expand-state Map and sort-key local state.
- `JurorHeatmapCard.jsx` — renders one juror card (header, donut, collapsed/expanded states).
- `AvgDonut.jsx` — reusable 72px donut. Props: `value`, `max`, optional `label`. Used only here initially but designed as a generic shared-ui component so Rankings/Analytics can adopt later.
- `ProjectAveragesCard.jsx` — the footer summary card.

`HeatmapPage.jsx` gains one import + one JSX block; no logic changes outside the render.

---

## Accessibility

- Collapsed card header is a `<button>` with `aria-expanded={isExpanded}` and `aria-controls={rowsId}`.
- Donut has `role="img"` and `aria-label="{juror} average {avg} out of {max}"`.
- Score pill `aria-label` matches existing desktop cells.
- Sort dropdown uses `CustomSelect` which already handles keyboard and aria.

---

## Testing

- Add QA IDs to `src/test/qa-catalog.json`:
  - `heatmap_mobile_card_expand` — verifies tap toggles expand state.
  - `heatmap_mobile_sort_avg_desc` — verifies default sort.
  - `heatmap_mobile_tab_recomputes_donut` — verifies tab switch recomputes averages.
- Unit tests in `src/admin/__tests__/HeatmapMobileList.test.jsx` using `qaTest()`.
- Mock `supabaseClient` per testing conventions.
- Run `npm run check:no-native-select` and `npm run check:no-nested-panels` before finishing.
- Manually verify against the running app (prod and demo) per the "Verify Against Live App" feedback.

---

## Out of Scope (explicitly)

- No persistence of expand state across reloads.
- No "expand all" / "collapse all" bulk control.
- No mobile landscape redesign (`@media … (orientation: landscape)` continues to use its own compact table rules).
- No changes to Export flow, Send Report modal, or the legend.
- No new data fetches or RPC changes.
