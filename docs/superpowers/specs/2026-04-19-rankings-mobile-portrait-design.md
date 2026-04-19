# Rankings Mobile Portrait — Design Spec

**Date:** 2026-04-19
**Status:** Approved

---

## Overview

Redesign the Rankings page mobile portrait card layout (≤600px portrait) to a premium hybrid design. Base is Option B (feed/timeline), augmented with Option C's criteria mini-bars, the existing `AvgDonut` component, and the `team-member-chip` avatar pattern from `EntityMeta`.

---

## Card Anatomy (top to bottom)

### 1. Top row

```
[ rank bubble ]  [ group chip + title ]  [ AvgDonut 52px ]
```

- **Rank bubble** (34×34px circle): medals 🥇🥈🥉 for ranks 1–3 with gradient backgrounds; plain number for rank 4+. Vertically aligned to center of title.
- **Group chip** (`P{group_no}`): small blue pill above title.
- **Title**: `font-size: 12.5px`, `font-weight: 600`, wraps naturally.
- **AvgDonut**: reuses `AvgDonut.jsx` exactly as-is. Size override: `52px`. Color bands unchanged (≥85% → success, ≥70% → warning, else danger).

### 2. Score progress bar

3px high, full card width (with 12px horizontal margin). Gradient fill matches medal color for top 3; blue→purple for the rest. Represents `totalAvg / 100`.

### 3. Team members

`team-member-chip` pattern from `src/shared/ui/EntityMeta.jsx` — 20px avatar circle with initial + name. Wraps to multiple rows if needed. Reuses existing `.team-members-inline`, `.team-member-chip`, `.team-member-avatar`, `.team-member-name` classes from `components.css`.

### 4. Criteria mini-bars

Separated by a 1px border-top. One row per criterion (Written / Oral / Innovation — dynamic from `criteriaConfig`). Each row: label (8.5px uppercase, 54px wide) + 3px bar + numeric value (9px). Bar colors: Written → `#388bfd`, Oral → `#a855f7`, Innovation → `#22c55e`.

### 5. Footer

Dark background (`#0d1117`), 1px border-top. Left: `ConsensusBadge` (dot + label). Right: σ + range in muted text, juror count pill.

---

## Top-3 Highlighting

| Rank | Left border color | Rank bubble gradient | Score bar gradient |
|------|-------------------|----------------------|--------------------|
| 1 | `#f59e0b` | `#92400e → #f59e0b` | `#f59e0b → #ef4444` |
| 2 | `#94a3b8` | `#334155 → #94a3b8` | `#94a3b8 → #60a5fa` |
| 3 | `#cd7c5a` | `#7c3f1a → #cd7c5a` | `#cd7c5a → #f59e0b` |
| 4+ | `#21262d` | plain number | `#388bfd → #7c3aed` |

---

## CSS Strategy

- New styles go in `src/styles/pages/rankings.css` under an existing `@media (max-width: 600px) and (orientation: portrait)` block (or add one if absent).
- **Do not redefine** `.team-member-*`, `.avg-donut*`, or `.consensus-badge` — reuse existing classes.
- Criteria bar colors defined as local classes `.fill-written`, `.fill-oral`, `.fill-innov` scoped inside `.ranking-table` to avoid leaking.
- Score bar: `.r-score-bar` / `.r-score-fill` (new, rankings-scoped).

---

## Files to Change

| File | Change |
|------|--------|
| `src/admin/pages/RankingsPage.jsx` | Refactor mobile card grid → new anatomy |
| `src/styles/pages/rankings.css` | New portrait media query styles |
| `src/admin/pages/AvgDonut.jsx` | Import and use as-is (no changes) |
| `src/shared/ui/EntityMeta.jsx` | Import `StudentNames` (already used — no changes) |

---

## What Does NOT Change

- Desktop table layout (unchanged)
- Landscape layout (unchanged)
- `AvgDonut.jsx` component internals
- `StudentNames` / `EntityMeta` internals
- `ConsensusBadge` behavior
- Data fetching / hook logic
