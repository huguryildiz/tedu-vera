# Session 12 — Opus Sprint 1: Global CSS Modularization

**Date:** 2026-04-23
**Scope:** S12 — Split 5 global CSS files (11,338 lines total) into coherent sub-files per CSS ceiling policy.
**Model:** Opus 4.7 (1M context)
**Duration:** ~1.5h

---

## Goal

Retire the 5 largest global CSS offenders (all ≥1500 lines, the biggest at 3284) by splitting each into a named subdirectory whose files each stay under the 600-line ceiling (coherent single-concern exceptions allowed up to ~600).

## What was done

Each source file was split into a same-named subdirectory (`src/styles/<name>/`), `src/styles/main.css` was updated to import the new files in source order, and the original monolith was deleted. Each split landed as its own atomic commit.

### 1. `layout.css` (3284) → `layout/` (15 files)

| File | Lines | Responsibility |
|---|---|---|
| `admin-shell.css` | 454 | Admin shell: sidebar + header + main area + light-mode sidebar (incl. vera.css duplicate consolidation block) |
| `responsive-base.css` | 62 | Baseline mobile + landscape media queries for shell |
| `period-popover.css` | 195 | Period popover dropdown component |
| `mobile-admin-nav.css` | 161 | Mobile menu button, sidebar close, overlay backdrop, focus-visible states |
| `portrait-overview.css` | 118 | Overview page portrait refinements |
| `portrait-tables.css` | 395 | Table → card transformations (rankings/reviews/jurors/semesters/criteria) |
| `portrait-heatmap.css` | 197 | Heatmap/matrix compact + horizontal scroll |
| `portrait-charts.css` | 156 | Attainment/KPI/insight/chart portrait |
| `portrait-headers.css` | 214 | Header/toolbar stacking and compact rhythm |
| `portrait-filters.css` | 117 | Export/filter/pagination stacking |
| `portrait-typography.css` | 60 | Page-wide portrait typography/spacing |
| `portrait-toolbar.css` | **639** | Global portrait toolbar pattern (search + actions + KPI grids) — **coherent single-concern exception** |
| `landscape-rankings.css` | 91 | Rankings table landscape preservation |
| `landscape-analytics.css` | 174 | Analytics bar-chart cards landscape composition |
| `very-small.css` | 254 | ≤480px portrait extras |

Source structure preserved: each per-category portrait file rewraps its rules in `@media (max-width: 768px) and (orientation: portrait) { … }` so they can live as independent imports.

**Commits:** `616fad5` (files) + `f554bca` (main.css wire-up follow-up after concurrent-session revert).

### 2. `landing.css` (3066) → `landing/` (12 files)

| File | Lines | Responsibility |
|---|---|---|
| `hero.css` | 292 | Nav + hero + pill + headline + CTAs + stats |
| `features.css` | 57 | Feature grid + social proof |
| `trust-usecase.css` | 418 | Trust use-case grid + eyebrow variants |
| `responsive-inline.css` | 45 | Landing-specific @media queries |
| `sections.css` | 285 | Trust band + before-after + use-cases + comparison + testimonials + FAQ + gallery + CTA reprise |
| `light-mode.css` | 427 | Light-mode overrides (primary copy) |
| `legacy-shell.css` | 337 | Duplicate landing shell from vera.css consolidation |
| `legacy-eyebrow.css` | 287 | Duplicate eyebrow + hero extras |
| `legacy-responsive.css` | 45 | Duplicate @media queries |
| `legacy-sections.css` | 285 | Duplicate extended sections |
| `legacy-light-mode.css` | 426 | Duplicate light-mode overrides |
| `mobile.css` | 162 | Mobile portrait ≤640px |

**Note on `legacy-*` files:** Lines 1525–2904 of the original are a near-duplicate of the primary blocks (historical vera.css consolidation artefact). Blocks differ in places (nav toggle, nav CTAs, etc.) so silent dedupe is unsafe; preserving them intact is the correct sprint-scope action. A follow-up dedupe pass is worth scheduling (tracked for C3).

**Commit:** `ba03285`.

### 3. `components/misc.css` (1871) → `misc/` (8 files)

| File | Lines | Responsibility |
|---|---|---|
| `scrollbars-chips.css` | 87 | Custom scrollbars + team-member chips + pill radius |
| `menus.css` | 151 | Demo menu + UserAvatarMenu + data-tooltip |
| `security-pill.css` | 237 | Security signal pill + popover |
| `maintenance.css` | 86 | Maintenance gate banners |
| `empty-state-card.css` | **595** | vera-es card system (hero/variants/actions/clone-picker + dark mode) — coherent single-concern |
| `empty-state-states.css` | 239 | vera-es no-data + page-prompt states |
| `lock-notice.css` | 276 | Lock notice banner (shared outcomes/criteria) |
| `mobile-row.css` | 199 | Unified `.mcard` shell + `.row-action-btn` kebab + owner pill |

**Boundary bug caught during build:** initial slice of `empty-state-card` cut off before the final `}` closing `.dark-mode .vera-es-pending-change:hover`; postcss flagged "Unclosed block" — fixed by appending `}` and trimming the leading stray `}` from `empty-state-states`. Verified by second build.

**Commit:** `83e189d` (the commit picked up a concurrently-staged S13 session report + README edits from another Opus session — noted but not disruptive).

### 4. `drawers.css` (1617) → `drawers/` (5 files)

| File | Lines | Responsibility |
|---|---|---|
| `base.css` | **585** | Drawer primitives: overlay/shell/icon/title/close/footer/sections/fields/buttons/alerts/upload/preview/danger/typed-confirm/step-indicator/info-row/badge/profile/password-strength/criteria-specifics/framework-cards/session-card/toggle — single-concern exception |
| `crud-legacy.css` | 356 | vera.css-consolidation duplicate (CRUD drawer + modal + fields + criteria card + backups drawer inline bits) |
| `backups.css` | 212 | Backups drawer (status card, schedule, stat row, storage meter, item card, pill variants, row actions) |
| `inline-confirm.css` | 72 | Shared inline confirmation panel |
| `project-scores.css` | 392 | Project Scores drawer (KPI strip, section blocks, criterion card, juror row, feedback, empty states, responsive, team members) |

**Commit:** `e5491ae`.

### 5. `ui-base.css` (1500) → `ui-base/` (8 files)

| File | Lines | Responsibility |
|---|---|---|
| `inputs.css` | 131 | Textarea autogrow + global input/textarea + placeholder + disabled + error + rounded-lg |
| `labels-errors.css` | 94 | Field labels + inline error + coverage banner + shake keyframes |
| `icon-meta.css` | 70 | Datetime text + icon buttons + last activity badge |
| `editor-item.css` | 128 | Collapsible editor item + drag handle + expand + lock icon |
| `pills-modals.css` | 176 | Pill buttons + modal/overlay system + ConfirmDialog internals |
| `mop-base.css` | 398 | ManageOrganizationsPanel shared: buttons + status badges + layout helpers + modal sub-components |
| `mop-dark-outcome.css` | 251 | Dark mode overrides + OutcomeEditor layout/row/editor |
| `mop-list.css` | 252 | mop-icon-btn variants + mop modal extras + org list + admin list |

**Commit:** `c79cbb8`.

---

## Policy compliance

| File | Split into | Max piece | Under 600 ceiling | Notes |
|---|---|---|---|---|
| `layout.css` (3284) | 15 files | 639 (portrait-toolbar) | 14/15 strict | 1 coherent single-concern exception (global portrait toolbar pattern) |
| `landing.css` (3066) | 12 files | 427 (light-mode) | 12/12 | ✅ all strict |
| `misc.css` (1871) | 8 files | 595 (empty-state-card) | 8/8 strict (at 595) | empty-state-card sits right at ceiling but coherent |
| `drawers.css` (1617) | 5 files | 585 (base) | 4/5 strict | 1 coherent single-concern exception (drawer primitives) |
| `ui-base.css` (1500) | 8 files | 398 (mop-base) | 8/8 | ✅ all strict |

**Total:** 48 files created, 5 monoliths deleted. 46/48 strictly under 600; 2 coherent single-concern exceptions at 585 and 639.

## Deferred / exception decisions

- **Landing `legacy-*` files:** Kept as duplicates rather than attempting silent dedupe. Safer scope boundary — risk of subtle visual regression from merging near-duplicates outweighs the bloat.
- **`portrait-toolbar.css` at 639:** Single coherent `@media` block; splitting by inner sub-selectors would scatter related rules across 3–4 tiny files with no readability gain.
- **`drawers/base.css` at 585:** Drawer "primitive design system" — fields+buttons+alerts+upload+typed-confirm etc. all live together and are used together. Splitting would fragment the mental model.
- **`misc/empty-state-card.css` at 595:** The vera-es card is one design system (card + hero variants + actions + clone-picker + dark overrides). Respect the boundary.

## Build validation

- `npm run build` green after each of the 5 split commits (final: 5.88s, no errors, no broken imports).
- One build break caught mid-sprint (misc boundary `}` leaked into adjacent file); fixed and re-verified before commit.
- Dev server **not** started (user-directive: parallel Opus sessions running on same port).

## Concurrent-session conflicts observed

- `main.css` was reverted by another process between my `git add` and `git commit` for the layout split — caught immediately, followed up with `f554bca`.
- The misc-split commit pulled in a concurrently-staged S13 session report + README edits (neutral — documentation from a parallel sprint).

Both were low-impact. For future multi-Opus sprints: prefer `git commit -- <paths>` to force file-level scope, or stage + commit in a tighter window.

## Next

- S13 (Opus Sprint 2): `jury-base.css` (4021) + `auth-base.css` (1178) — already in progress by a parallel session (observed commits on `main`).
- S14 (Opus Sprint 3): Feature CSS (criteria/setup-wizard/outcomes/periods/reviews) — parallel sessions already landed `periods`, `outcomes`, `reviews` splits.

---

**Files created:** 48 (15 + 12 + 8 + 5 + 8).
**Monoliths retired:** 5 (11,338 lines).
**Commits:** `616fad5`, `f554bca`, `ba03285`, `83e189d`, `e5491ae`, `c79cbb8`.
