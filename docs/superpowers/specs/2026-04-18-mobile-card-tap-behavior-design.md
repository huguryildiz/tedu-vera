# Mobile Card Tap Behavior — Design Spec

**Date:** 2026-04-18
**Status:** Draft — awaiting review
**Scope:** Admin panel mobile cards (≤600px portrait) and their desktop kebab counterparts

---

## Problem

Mobile card tap behavior across VERA admin pages is inconsistent:

- Projects, Jurors: kebab-only, card inert (nothing happens on tap).
- Heatmap: whole-card expand/collapse (Linear-style toggle).
- Reviews: inline comment toggle, no kebab.
- Periods: inline navigation badges.
- Rankings: pure display, no interaction.
- Organizations, Criteria, Outcomes: kebab present on desktop rows but no standardized mobile card pattern.

Additionally, the current kebab button tap target is ~22-24px — well below the WCAG 2.2 AAA / Apple HIG 44×44px standard, causing frequent mis-taps on mobile.

There is no global rule for what visual feedback (if any) the card should give when tapped. This manifests as users re-learning interaction affordances on every page.

## Goals

1. Establish a single, globally consistent mobile card interaction contract.
2. Bring kebab tap target to platform standards (44×44px mobile).
3. Provide subtle but visible tap feedback that does not lie about tappability.
4. Avoid breaking the "no nested panels" rule — feedback must not cascade into inner card elements.

## Non-goals

- Building new detail drawers for Projects / Jurors / Periods / Organizations. Out of scope — tracked separately for v2.
- Desktop table row hover/interaction redesign. Separate spec.
- Jury flow card patterns (those are not admin rows).

## Decisions

### D1 — Tap Model: Pattern B (kebab-only)

The card is an **inert display surface**. All row-level actions (Edit, Delete, View, Duplicate, Reset PIN, etc.) live inside the kebab menu. The card itself has no `onClick`, no `cursor: pointer`, no navigation intent.

**Rationale:** VERA does not have read-only detail drawers for most entities (Projects, Jurors, Periods, Organizations). Pattern A ("tap opens detail") would require building 4-5 new drawers — a large scope unjustified by current user need. Pattern B delivers consistency today without that cost.

**Out of scope exception:** [JurorHeatmapCard.jsx](src/admin/pages/JurorHeatmapCard.jsx)'s whole-card expand-in-place remains as-is. It is not a Pattern B violation because expand/collapse is inline content disclosure, not a row action or navigation. This matches Linear sub-issue rows and Notion toggles.

### D2 — Kebab Button Tap Target

| Breakpoint | Button size | Visible icon | Padding |
|---|---|---|---|
| Mobile (≤600px) | 44×44px | 18px | `10px` |
| Desktop (>600px) | 32×32px | 15px | `6px` |

The icon itself stays small (no visual hantallık); only the invisible tap zone expands.

### D3 — Global Class Rename

Rename `.juror-action-btn` (currently in [src/styles/pages/jurors.css](src/styles/pages/jurors.css)) to `.row-action-btn` and move to [src/styles/components.css](src/styles/components.css).

Touched pages (6): [ProjectsPage.jsx](src/admin/pages/ProjectsPage.jsx), [JurorsPage.jsx](src/admin/pages/JurorsPage.jsx), [PeriodsPage.jsx](src/admin/pages/PeriodsPage.jsx), [OrganizationsPage.jsx](src/admin/pages/OrganizationsPage.jsx), [CriteriaPage.jsx](src/admin/pages/CriteriaPage.jsx), [OutcomesPage.jsx](src/admin/pages/OutcomesPage.jsx).

**Rationale:** "juror-action" is semantically misleading when used on projects, periods, outcomes, etc. `.row-action-btn` accurately describes scope.

### D4 — Card Tap Feedback (`:active`)

On mobile tap, the card's **border color** changes to `var(--primary)`. Background and inner elements are untouched.

**Mechanism:** JS-driven `.is-pressed` class with minimum 150ms visible duration. Pure CSS `:active` on touchscreens fires too briefly (~50-100ms) for reliable perception on fast taps.

**Implementation outline:**

```js
// src/shared/hooks/usePressedFeedback.js (new)
// Attaches pointerdown/pointerup/pointercancel listeners.
// On pointerdown: adds 'is-pressed' class, records timestamp.
// On pointerup/pointercancel: removes class after max(0, 150 - elapsed)ms.
// Skips if event.target.closest('.row-action-btn') — kebab handles its own state.
```

CSS:

```css
.mcard,
.hm-card,
.rmc-card {
  transition: border-color 100ms ease-out;
  -webkit-tap-highlight-color: transparent;
}
.mcard.is-pressed,
.hm-card.is-pressed,
.rmc-card.is-pressed {
  border-color: var(--primary);
}
```

**Why primary accent (not `--border-strong`):**
- User chose accent over neutral after visual comparison mockup.
- Short flash (~150ms) does not imply sustained tappability.
- Matches iOS Settings rows / Telegram bubbles pattern — premium signal "touch acknowledged."
- Works identically in light/dark mode (primary token is theme-aware).

**Why not background tint:** Prior incidents (nested panel artifacts, dark mode color wash) — see CLAUDE.md "nested panel yasağı." Border-only keeps feedback isolated to the card edge.

### D5 — Kebab Button `:active`

Standard pressed state: subtle background tint + 1px inset feel. Not tied to card feedback. When user taps the kebab, the card's `.is-pressed` class is **not** applied (see D4 mechanism).

```css
.row-action-btn:active {
  background: var(--surface-1);
  transform: scale(0.96);
  transition: transform 80ms, background 80ms;
}
```

### D6 — Desktop Card `:hover`

Out of scope for this spec. Mobile cards (`.mcard`) only render ≤600px; desktop uses table rows, which are tracked separately.

### D7 — Reviews Page

[ReviewMobileCard.jsx](src/admin/components/ReviewMobileCard.jsx):

- **No kebab** — no row-level actions defined today. Adding an empty kebab would be premium anti-pattern.
- **Inline comment toggle kept** — content-local disclosure (like Heatmap chevron), not a row action.
- Card receives D4 border feedback on tap.

If a Review-level action is introduced later (Copy scores, Export review), add kebab then.

## Architecture

```
src/styles/components.css
  └── .row-action-btn           (new global class, renamed from .juror-action-btn)
      ├── base: 32×32 desktop
      ├── @media (max-width: 600px) { 44×44, 18px icon }
      └── :active pressed state

src/styles/components.css
  └── .mcard, .hm-card, .rmc-card
      ├── transition: border-color 100ms
      ├── -webkit-tap-highlight-color: transparent
      └── .is-pressed { border-color: var(--primary); }

src/shared/hooks/usePressedFeedback.js        (new)
  └── Attaches pointer listeners, manages 150ms min-visible .is-pressed class.
      Skips when target is within .row-action-btn.

Consumers (wrap mobile card roots):
  - src/admin/pages/ProjectsPage.jsx      (.mcard rows)
  - src/admin/pages/JurorsPage.jsx        (.mcard.jc rows)
  - src/admin/pages/PeriodsPage.jsx       (.mcard rows)
  - src/admin/pages/RankingsPage.jsx      (.mcard rows)
  - src/admin/pages/JurorHeatmapCard.jsx  (.hm-card — also expand target, use same feedback)
  - src/admin/components/ReviewMobileCard.jsx (.rmc-card)
```

## Files Changed

**New:**

- `src/shared/hooks/usePressedFeedback.js` — pointer event hook.

**Renamed + moved:**

- `.juror-action-btn` class → `.row-action-btn` (class name + move styles from `src/styles/pages/jurors.css` to `src/styles/components.css`).

**Modified:**

- [src/styles/components.css](src/styles/components.css) — new `.row-action-btn` block; `.mcard/.hm-card/.rmc-card` feedback rules.
- [src/styles/pages/jurors.css](src/styles/pages/jurors.css) — remove `.juror-action-btn` block.
- Six admin pages (Projects, Jurors, Periods, Organizations, Criteria, Outcomes): replace className `juror-action-btn` → `row-action-btn`.
- Six mobile card consumers: call `usePressedFeedback(ref)` at card root.

## Testing

- Unit: `usePressedFeedback` hook — pointerdown adds class, pointerup removes after min 150ms, kebab target is skipped.
- Visual regression: tap each affected card on mobile viewport (375×667), verify primary-border flash, verify bg unchanged, verify dark mode parity.
- Accessibility: kebab button tappable at 44×44px (verified via DevTools Elements inspector), focus ring preserved.
- Run `npm run check:no-nested-panels` — ensure no inner element gained opaque background.

## Open items

None — all decisions resolved during brainstorm.

## References

- CLAUDE.md "No tap-to-open on cards/rows" rule
- CLAUDE.md "Nested panel yasağı"
- WCAG 2.2 AAA 2.5.8 Target Size (Minimum)
- Apple HIG Touch Targets
- Linear / Notion / Stripe Dashboard mobile card patterns
