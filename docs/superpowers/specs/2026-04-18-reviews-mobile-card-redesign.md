# Reviews Page — Mobile Portrait Card Redesign

## Summary

Replace the current Reviews mobile card (juror badge + inline score chips row + status pill row) with a richer, premium card that surfaces **per-criterion scores as first-class content** rather than hiding them in a horizontally-wrapping chip row. The new design uses a 2×2 score grid for criterion breakdown, an SVG donut ring for the total, and a dedicated team-members chip row under the project title.

Scope: mobile portrait only (`@media (max-width: 768px) and (orientation: portrait)` — the same breakpoint already governing `src/styles/pages/reviews.css` lines 499–671). Desktop table remains untouched.

---

## Visual Structure

```text
┌────────────────────────────────────────────────┐
│  [AK]  Dr. Aslıhan Koçak            ╭──────╮  │
│   32px TED University, EE           │ ◯ 81 │  │
│                                     │ /100 │  │
│                                     ╰──────╯  │
│                                                │
│  [P5] Biomedical Signal Processing for         │
│       Sleep Apnea Detection                    │
│  TEAM  (EA) E. Arslan  (BK) B. Kaya  (MC) M.…  │
│                                                │
│ ┌───────────────┬───────────────┐              │
│ │ TECHNICAL     │ DESIGN        │              │
│ │ 25 /30        │ 28 /30        │              │
│ │ ████████░░    │ █████████░    │              │
│ ├───────────────┼───────────────┤              │
│ │ DELIVERY      │ TEAMWORK      │              │
│ │ 22 /30        │ 6  /10        │              │
│ │ ███████░░░    │ ██████░░░░    │              │
│ └───────────────┴───────────────┘              │
│ ───────────────────────────────────────────── │
│  ● Scored                         Completed    │
└────────────────────────────────────────────────┘
```

Partial variant: left border becomes `3px solid var(--warning)`, ring stroke turns amber, missing criterion cells render at `opacity: 0.4` with an em-dash placeholder and no bar fill.

---

## Sections

### 1. Card Header (juror + total ring)

- **Juror avatar**: 32×32px circle, initials from `juryName`, color class derived from name hash (reuse existing `JurorBadge` palette logic).
- **Juror name**: 12px, font-weight 600, `text-overflow: ellipsis`.
- **Affiliation**: 10px, `--text-tertiary`.
- **Total ring** (right):
  - 44×44px SVG donut. Track `stroke: var(--border)`, fill `stroke-width: 4.5`, rotated -90deg.
  - Stroke color: `--accent` (blue) when `total ≥ 70%` of max, `--warning` (amber) when 40–69%, `--danger` when <40%, `--text-tertiary` when `total === null`.
  - `stroke-dasharray`/`stroke-dashoffset` computed from `total / totalMax`.
  - Center label: 13px font-weight 800 number, 8px `/100` denominator underneath. Shows `—` when null.

### 2. Project + Team Block

- **Project row**: `P{groupNo}` accent badge (10px, `--accent-glow` bg, 4px radius) + title (11px, font-weight 600, line-height 1.35, up to 2 lines then clip).
- **Team row** (new):
  - `TEAM` uppercase micro-label (9px, `--text-tertiary`, letter-spacing 0.4px).
  - Members parsed from existing comma-separated `students` string: split on `,`, trim, derive initials from first letter of each whitespace-separated token (fallback: first two letters of single token).
  - Each member rendered as a chip: elevated surface token (same as score cells), `border: 1px solid var(--border)`, 20px border-radius, `padding: 2px 7px 2px 3px`, gap 4px.
    - 20×20px colored avatar circle (initials, 8px bold) — color picked from a 5-entry palette hashed on surname.
    - Surname display: `{first-initial}. {last-word}` e.g. "E. Arslan" (10px, `--text-secondary`).
  - Wraps to next line when overflowing. If `students` is empty, omit the team row entirely (no label, no empty-state placeholder).
  - Cap at 4 visible chips; remaining members collapse into a `+N` chip (N = total − 4) with the same visual style but no avatar (`padding: 2px 8px`, 10px text).

### 3. Score Grid (2 × N/2)

- `display: grid; grid-template-columns: 1fr 1fr; gap: 5px`.
- Cell: slightly elevated surface token (use the same token the periods/criteria mobile cards use for their inner info blocks — resolve to the canonical name during implementation), `1px solid var(--border)`, 5px radius, `padding: 7px 8px`.
- Cell contents:
  - **Label**: 9px uppercase, `--text-tertiary`, letter-spacing 0.4px. Uses `criterion.shortLabel` when length > 9 chars, otherwise `criterion.label`.
  - **Score**: 15px font-weight 800 number, 9px `/max` denominator baseline-aligned.
  - **Bar**: 3px tall track (`background: var(--border)`), fill width `(score / max) * 100%`. Fill color cycles through `--accent → --success → --warning → --purple` in criterion index order (so rendering is consistent across periods regardless of criterion names).
- Empty cell (score null): `opacity: 0.4`, em-dash for number, no bar fill.
- **Dynamic count handling**: criteria count comes from the enriched row + `criteriaConfig`. Grid auto-flows:
  - 1 criterion → single full-width cell
  - 2 criteria → 2 columns, 1 row
  - 3 criteria → 2 columns, 2 rows (last cell spans 2 cols)
  - 4 criteria → 2×2 (the canonical case shown in mockup)
  - 5+ criteria → 2 columns, rows wrap naturally. Orphan last cell (odd count) spans both columns.

### 4. Card Footer

- `border-top: 1px solid var(--border); padding-top: 9px`.
- Left: cell-level `ScoreStatusPill` (`Scored` / `Partial` / `Empty`) — reuse existing component.
- Right: juror-level `JurorStatusPill` (`Completed` / `Ready to Submit` / `In Progress` / `Not Started` / `Editing`) — reuse existing component.
- Both render as soft-bg pills with Lucide icons matching `jurorStatusMeta` / cell-status metadata in `src/admin/utils/scoreHelpers.js`. No new icon work.

---

## Data Mapping (no new API calls)

Every field already exists on the enriched row produced by `filterPipeline.js`. No RPC or migration work.

| UI element | Source field |
|------------|--------------|
| Juror avatar/name/affiliation | `juryName`, `affiliation` |
| Project badge number | `groupNo` (prefix with `P`) |
| Project title | `title` (or `projectName`) |
| Team chips | `students` — parsed client-side |
| Score cell value | `row[criterion.key]` (dynamic) |
| Score cell max | `criterion.max` |
| Total ring | `total`, and `criteria.reduce((s, c) => s + c.max, 0)` for denominator |
| Cell status pill | `effectiveStatus` |
| Juror status pill | `jurorStatus` |

Criteria list drives the grid via `.map(...)` — never hardcoded.

---

## CSS Strategy

Current mobile CSS in `src/styles/pages/reviews.css` uses `display: contents` + flexbox `order` tricks to reflow the `<tr>/<td>` into a card. That pattern is kept for desktop but **abandoned in mobile portrait** in favor of an actual `<div>`-based card rendered conditionally.

Rationale: the score grid needs CSS grid semantics and explicit nesting, which `display: contents` on a `<tr>` cannot provide without fragile pseudo-element gymnastics.

Implementation approach:

1. In `ReviewsPage.jsx`, detect mobile portrait via the existing `useMediaQuery` pattern (or a simple `window.matchMedia` hook already used elsewhere — check sibling pages for consistency).
2. When mobile-portrait, render a parallel `<div className="reviews-mobile-list">` with `<ReviewMobileCard row={row} criteria={criteria} />` per row, in place of (not alongside) the table.
3. Desktop path continues to render the existing table unchanged.
4. Move old mobile-specific CSS (the `display: contents` block) behind a `@supports not` fallback or delete it entirely once the new path is verified.
5. New card CSS lives in `src/styles/pages/reviews.css` under a clearly labeled section (`/* ── Mobile portrait cards (new) ── */`). No new CSS files.

Nested panel rule: inner score cells have their own `bg-card2` background — this matches an existing accepted pattern (periods card mobile scoring grid), but we'll need a `/* nested-panel-ok */` marker to satisfy `npm run check:no-nested-panels`. The score grid genuinely needs differentiated cells; it is not decorative chrome.

---

## Interaction

- **No row-level `onClick`** (global rule: `feedback_no_tap_to_open`). The card is informational.
- **No kebab menu on mobile cards for now** — the Reviews page only has comment tooltips and timestamp, neither of which warrants a row action today. If a future action surfaces (e.g., "enable editing"), it can be added as a top-right `MoreVertical` button without disturbing layout.
- **Long press / hover** do nothing; there are no tooltips on mobile.
- **Comment indicator**: if `row.comments` is non-empty, prepend a small `MessageSquare` Lucide icon (11px, `--text-tertiary`) to the left of the cell status pill in the footer. Clicking it does nothing yet — it is a visibility hint only. (Original desktop exposes comments via hover tooltip; mobile will defer the full text to a future drawer/modal since the current spec keeps scope tight.)

---

## Edge Cases

| Case | Behavior |
|------|----------|
| `total === null` (fully empty) | Ring shows `—`, grey stroke track only, no progress arc. All cells faded. Footer shows `Empty` + `Not Started`. |
| `students === ''` | Team row omitted (no label, no placeholder). |
| Single team member | Renders as one chip, no special layout. |
| Team with 5+ members | First 4 chips + `+N` overflow chip. |
| Very long project title | Clamped to 2 lines via `-webkit-line-clamp: 2`. |
| Criteria count not in {2,4} | Grid auto-flows; odd count → last cell spans 2 columns. |
| Missing `criterion.shortLabel` | Fall back to `criterion.label`. If >9 chars, truncate with ellipsis in CSS. |
| Partial row (`effectiveStatus === 'partial'`) | Left border `3px solid var(--warning)`; null cells faded. |
| `editEnabled === true` (juror editing) | Juror pill shows `Editing` (purple). Ring and cells render normally. |

---

## Testing

- **Unit**: new `ReviewMobileCard.test.jsx` covering: full row render, partial row, empty row, no-team row, 5-member overflow, 3-criterion grid (odd count), long title clamp.
- **Existing**: `ReviewsPage.test.jsx` and `ReviewsPage.filter.test.jsx` should continue to pass. Mobile branch rendering must be tested against the same filter pipeline output.
- **qaTest IDs**: add new IDs under a `reviews.mobile_card.*` namespace in `src/test/qa-catalog.json` before writing tests.
- **Visual QA**: run `npm run dev`, open Chrome DevTools mobile portrait (iPhone SE + Pixel 7 viewports), cycle through filters to hit each row state (scored/partial/empty × completed/in_progress/not_started/editing).
- **Regressions to watch**: desktop table unaffected (same render path); CSS no-nested-panels check passes with `/* nested-panel-ok */` markers; `npm run check:no-native-select` still green (no new selects introduced).

---

## Out of Scope

- Comment body rendering on mobile (just the indicator icon).
- Per-card kebab actions.
- Score editing inline on mobile.
- Desktop table changes.
- Animation polish beyond existing transitions.

---

## Files to Touch

- `src/admin/pages/ReviewsPage.jsx` — add mobile-portrait branch.
- `src/admin/components/ReviewMobileCard.jsx` (new) — the card component.
- `src/styles/pages/reviews.css` — new mobile card styles; remove or fence off old `display: contents` mobile block.
- `src/test/qa-catalog.json` — new test IDs.
- `src/admin/__tests__/ReviewMobileCard.test.jsx` (new) — unit tests.
