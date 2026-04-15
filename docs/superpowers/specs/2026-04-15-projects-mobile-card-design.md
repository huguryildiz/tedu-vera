# Projects — Mobile Card Redesign

## Context

`ProjectsPage.jsx` uses a `<table>` that collapses to stacked card-like rows on narrow viewports via `src/styles/pages/projects.css` (media query `max-width: 768px and orientation: portrait`). The current collapsed layout is visually weak: misaligned badge/title columns, floating `AVG` / `EVALUATIONS` labels, no hierarchy, wasted vertical space, and an orphan three-dot menu at the bottom. See `src/admin/pages/ProjectsPage.jsx:551-636` for the row markup and `src/styles/pages/projects.css:22-121` for the current mobile override.

This spec replaces the portrait-mobile card with a premium "Ranked Hero" design, using avatar chips for team members.

## Scope

- Redesign the **portrait mobile card only** (`@media (max-width: 768px) and (orientation: portrait)`).
- Desktop table and landscape-compact layouts (lines 128–139 of `projects.css`) are **out of scope** and must remain unchanged.
- The existing row `<tr>` markup and data already rendered in `ProjectsPage.jsx` is reused; no API changes.
- Per-card data comes from: `project.group_no`, `project.title`, `project.advisor`, `project.members`, `projectAvgMap.get(project.id)`, `periodMaxScore`, `project.updated_at`, plus (new) `rawScores`-derived `evaluationCount` per project.

## Visual Design — Ranked Hero

Each card is a bordered white surface (`background: var(--bg-card)`, `border: 1px solid var(--border)`, `border-radius: var(--radius)`) split into three regions:

### 1. Hero band (top)

Layout: `display: flex; gap: 12px; padding: 14px` over a soft gradient (`linear-gradient(135deg, var(--surface-1) 0%, var(--bg-card) 50%)`), bottom border `1px solid var(--border)`.

- **Rank ring (48×48px)** — left. Conic-gradient progress ring around a white inner circle. The ring sweep angle is `(avg / maxScore) * 360deg`. Inner text: integer score (14px, 700) above an 7px uppercase `AVG` label. Ring color follows score bands:
  - ≥ 85 → `var(--success)` green
  - 70–84 → `var(--warning)` amber
  - < 70 → `var(--danger)` red
  - no score → neutral `var(--text-tertiary)` with an em-dash in the middle
- **Title block** — flex-grow, min-width 0 (so it truncates correctly). Top: eyebrow `PROJECT · P{group_no}` (10px, 700, letter-spacing .6px, `var(--accent)`). Below: title (13.5px, 650, line-height 1.3, letter-spacing -.2px, up to 2 lines, ellipsis after).
- **Kebab button** — 28×28px rounded square, `var(--surface-1)` background, `MoreVertical` 14px icon. Opens the existing `FloatingMenu` with Edit / View Reviews / Delete. `stopPropagation` so it does not open the detail drawer.

### 2. Body (middle)

`padding: 10px 14px 12px`. Two stacked rows:

- **Advisor line** — flex row, 6px gap, 11px text, `var(--text-secondary)`. Leading `UserRound` 12px icon in `var(--text-quaternary)`. Full advisor string rendered (comma-joined if multiple); clamps to 1 line with ellipsis.
- **Team row** — flex row, 8px gap, 10px margin-top. Leading label `TEAM` (9.5px, uppercase, letter-spacing .6px, 600, `var(--text-tertiary)`). Then member chip stack:
  - Each chip is 26×26px circular, 2px white border, -6px overlap margin, subtle `0 1px 2px rgba(15,23,42,.08)` shadow.
  - Background is a gradient determined by a hash of the member name, chosen from a fixed 5-color palette (blue, purple, green, amber, pink) so that the same member always gets the same color.
  - Inside: 2-letter initials from the member name, 9.5px white, 700.
  - Up to 4 member chips render in full; if there are 5 or more, exactly 4 chips plus a neutral `+N` pill (`var(--surface-1)` bg, `var(--text-secondary)` text, same 26×26 size, no border) are shown. `N` equals `members.length - 4`.
  - Wrap each chip in the existing `PremiumTooltip` with the full member name.
  - If there are zero members, render a single muted `No team` em-dash pill in place of the chip stack.

### 3. Footer (bottom)

`display: flex; justify-content: space-between; padding: 8px 14px; background: var(--surface-1); border-top: 1px solid var(--border); font-size: 10.5px; color: var(--text-tertiary)`.

Three spans, left to right:

- `<strong>{count}</strong> members`
- `<strong>{count}</strong> evaluations` (distinct juror count from `rawScores` for this project)
- Relative timestamp (e.g. `27m ago`), wrapped in `PremiumTooltip` showing the full ISO datetime.

`<strong>` nodes use `var(--text-secondary)`, weight 600.

## Interaction

- **Tap anywhere on the card** (except kebab and its menu) → opens the existing detail drawer (`openDrawer(project)`).
- **Tap kebab** → opens `FloatingMenu` with Edit / View Reviews / Delete. Menu must anchor correctly via existing `FloatingMenu` placement="bottom-end".
- **Tap avatar chip** → shows tooltip with full name (no navigation). `+N` chip has no action — full member list is visible in the detail drawer.
- No swipe gestures, no long-press; existing interactions stay the only affordances.

## Data — Evaluation Count per Project

The footer needs `evaluationCount` (distinct jurors who scored the project). This is derivable from the existing `rawScores` array already available via `useAdminContext()`. Compute a new memo alongside `projectAvgMap`:

```js
const projectEvalCountMap = useMemo(() => {
  const map = new Map();
  if (!rawScores?.length) return map;
  const byProject = new Map();
  for (const r of rawScores) {
    const pid = r.projectId || r.project_id;
    const jid = r.jurorId || r.juror_id;
    if (!pid || !jid) continue;
    if (!byProject.has(pid)) byProject.set(pid, new Set());
    byProject.get(pid).add(jid);
  }
  for (const [pid, set] of byProject) map.set(pid, set.size);
  return map;
}, [rawScores]);
```

`0` renders as `0 evaluations` — no special empty state.

## Color Hash for Avatar Chips

Add a small pure helper `avatarGradient(name)` in a new file `src/shared/ui/avatarColor.js`:

```js
const PALETTE = [
  "linear-gradient(135deg,#3b82f6,#2563eb)", // blue
  "linear-gradient(135deg,#8b5cf6,#7c3aed)", // purple
  "linear-gradient(135deg,#10b981,#059669)", // green
  "linear-gradient(135deg,#f59e0b,#d97706)", // amber
  "linear-gradient(135deg,#ec4899,#db2777)", // pink
];
export function avatarGradient(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}
export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
```

Used only by this card for now; extractable later for other surfaces.

## Implementation Strategy

The current mobile view hides `<thead>` and re-lays out `<td>` cells via `display: flex` on `<tr>`. Continue using the same `<tr>` markup and data-label attributes — **do not introduce a separate React component for mobile**. All changes live in `src/styles/pages/projects.css`, with two targeted JSX additions in `ProjectsPage.jsx`:

1. Add the `projectEvalCountMap` memo.
2. Add a single `<td className="col-footer">` cell per row holding the three footer stats (hidden on desktop via CSS, visible on portrait mobile). Desktop CSS already has explicit column widths; an extra td with `display: none` on desktop does not break the existing table.
3. Replace the `<StudentNames />` render in the `col-members` cell with a mobile-aware renderer: desktop continues to show text names; mobile CSS hides text children and reveals avatar chips. Simplest route — render **both** (text + chips), and hide the alternate per breakpoint. Chips live in a `<span className="member-chips">` sibling inside the same cell.

This keeps desktop untouched and avoids a dual-tree React refactor.

## CSS Structure

Rewrite the `@media (max-width: 768px) and (orientation: portrait)` block in `src/styles/pages/projects.css`:

- Reset table/tbody to `display: contents` / `display: block`.
- Each `<tr>` becomes a card: `display: grid`, rows for hero / body / footer, removing the old flex+order hacks.
- Use CSS Grid `grid-template-areas` to map cells:
  ```
  "badge title score kebab"
  "advisor advisor advisor advisor"
  "members members members members"
  "footer  footer  footer  footer"
  ```
  — with `td:nth-child(1)` → badge (rank ring), etc.
- Hide `data-label::before` pseudos on mobile (the new layout has explicit visual labels, so micro-labels are noise).
- Rank ring is rendered from the existing "No" cell (`td:nth-child(1)`): the badge `P{n}` is kept as hidden text (for desktop) and the ring is drawn via `::before` / `::after` pseudos — OR, cleaner, render the ring markup once inside the cell and let CSS hide it on desktop. Prefer the latter for readability.
- All colors via existing tokens in `src/styles/variables.css`. Score band colors reuse the `var(--success) / --warning / --danger)` tokens already used elsewhere.

## Dark Mode

All backgrounds and borders already use CSS variables that switch in dark mode via `body.dark-mode` overrides in `variables.css`. The hero gradient must be dark-mode safe — use `linear-gradient(135deg, var(--surface-1) 0%, var(--bg-card) 50%)` which resolves correctly in both modes. Avatar gradient colors are fixed (they are brand-style, not theme-bound). Ring colors use semantic tokens, so no dark-mode special-casing is needed.

## Non-Goals

- No changes to desktop table columns, sort behaviour, pagination, search, filters, or drawers.
- No new admin RPCs or DB migrations.
- No animation beyond a 120ms hover/active transform on the card (same subtlety as current).
- No bulk select, no multi-select, no inline editing on mobile.
- Evaluation count is derived from currently-loaded `rawScores`; no separate fetch.

## Risks / Edge Cases

- **Very long titles** — 2-line clamp with ellipsis; verified visually at 320px viewport.
- **Many members (5+)** — first 4 chips + `+N` pill (per the chip-count rule above). Tapping `+N` does nothing; full list is accessed by tapping the card to open the detail drawer.
- **No score yet** — ring is neutral gray, inner text `—`, footer shows `0 evaluations`.
- **No advisor** — the advisor line row is removed (not an empty space). Hero and team rows still render.
- **Unicode / Turkish characters in initials** — `toUpperCase()` handles Turkish `i` correctly per locale when passed `"tr-TR"`; use `.toLocaleUpperCase("tr-TR")` inside `initials()` to avoid `İ` / `I` confusion.
- **Dark mode contrast** — ring band colors (success/warning/danger) are already dark-mode tuned in `variables.css`.

## Files Touched

- `src/admin/pages/ProjectsPage.jsx` — add `projectEvalCountMap` memo, augment `col-members` cell with chip markup, add `<td className="col-footer">` per row.
- `src/styles/pages/projects.css` — rewrite the portrait-mobile media block; add `.col-footer` hidden-on-desktop rule.
- `src/shared/ui/avatarColor.js` — new helper file for `avatarGradient` and `initials`.

## Acceptance

Verified manually on a 375×812 viewport (portrait iPhone) and via `npm run dev`:

1. Three sample projects with varying scores (91 / 84 / 65), varying member counts (2 / 3 / 6), with and without advisors render correctly.
2. Ring color switches at the 85 / 70 thresholds.
3. Tap on card opens detail drawer; tap on kebab opens FloatingMenu; tap on avatar shows tooltip.
4. `+N` pill appears only when members > 4 and shows the correct remainder.
5. Desktop table at ≥ 769px wide is visually unchanged vs. `main` before this change.
6. Dark mode renders with proper contrast; ring and footer tokens flip correctly.
7. `npm run check:no-native-select` still passes.
