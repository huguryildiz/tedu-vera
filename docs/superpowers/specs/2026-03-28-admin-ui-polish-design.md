# VERA Admin UI Polish — Design Spec

## Problem

After the shadcn/Tailwind CSS migration, the admin UI looks like a flat wireframe rather than a premium dashboard product. Components were migrated correctly but the result lacks visual hierarchy, depth, spacing rhythm, and deliberate design. Cards don't separate from the background, inputs are invisible, KPI cards are weak, and the overall composition feels underdesigned.

## Design Decisions

| Question | Choice | Rationale |
|----------|--------|-----------|
| Dashboard feel | Light: Corporate Clean / Dark: Bold Dark | Professional calm in light, strong contrast in dark |
| KPI card style | Ring Progress | Data-dense, compact, matches VERA's evaluation-heavy UX |
| Sidebar/content balance | Tinted Sidebar (B) | Sidebar recedes, content area gets focus |
| Overview composition | Hero KPI + Split (C) | Strongest hierarchy — primary metric elevated, secondary compact |

## Theme Token Changes

### Light Mode

| Token | Current | New | Notes |
|-------|---------|-----|-------|
| `--background` | `oklch(1 0 0)` (white) | `oklch(1 0 0)` (white) | Stays white |
| `--card` | `oklch(1 0 0)` (white) | `oklch(0.98 0 0)` (~`#f8fafc`) | Cards separate from background |
| `--sidebar-background` | (inherits sidebar) | `oklch(0.98 0 0)` (~`#f8fafc`) | Tinted sidebar |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.965 0 0)` | Slightly warmer |

### Dark Mode

| Token | Current | New | Notes |
|-------|---------|-----|-------|
| `--background` | (dark default) | `oklch(0.145 0.015 265)` (~`#0f172a`) | Deep slate |
| `--card` | (dark default) | `oklch(0.21 0.015 265)` (~`#1e293b`) | Elevated slate |
| `--border` | (dark default) | `oklch(0.30 0.015 265)` (~`#334155`) | Visible borders |

## Component Fixes

### Input (`src/components/ui/input.jsx`)

| Property | Current | New |
|----------|---------|-----|
| Height | `h-8` | `h-10` |
| Background | `bg-transparent` | `bg-background` |
| Padding | `px-2.5 py-1` | `px-3 py-2` |
| Shadow | none | `shadow-sm` |
| Focus ring | `ring-3` | `ring-2` |

### Card (`src/components/ui/card.jsx`)

| Property | Current | New |
|----------|---------|-----|
| Border | `ring-1 ring-foreground/10` | `border` (uses `--border` token) |
| Shadow | none | `shadow-sm` |

### Button (`src/components/ui/button.jsx`)

| Property | Current | New |
|----------|---------|-----|
| Default height | `h-8` | `h-9` |
| Default padding | `px-2.5` | `px-4` |

## KPI Card Redesign

### Layout

```text
┌────────────────────────────────────────┐
│  ┌──────┐                              │
│  │ Ring │  Label (small, muted)        │
│  │  67% │  Value (large, bold)         │
│  └──────┘  Sub-text (trend or delta)   │
└────────────────────────────────────────┘
```

### Ring Colors (by percentage)

| Range | Color | Tailwind |
|-------|-------|----------|
| 0% | Gray | `text-muted-foreground` |
| 1–33% | Orange | `#f97316` (orange-500) |
| 34–66% | Amber | `#eab308` (yellow-500) |
| 67–99% | Lime | `#84cc16` (lime-500) |
| 100% | Emerald | `#22c55e` (green-500) |

### Ring Specs

- SVG circle, 52px diameter, 4px stroke
- Percentage text centered inside ring
- `stroke-dasharray` + `stroke-dashoffset` for progress
- `transition: stroke-dashoffset 500ms ease-out`
- Ring color matches percentage band

### Card Content

- **Label**: `text-xs font-medium text-muted-foreground`
- **Value**: `text-2xl font-extrabold tracking-tight text-foreground`
- **Sub**: `text-xs text-muted-foreground` (or colored for trends: green for positive, red for negative)

## Overview Page Composition

### Hero KPI Row

```text
┌────────────────────────────────┬──────────────┐
│  [Ring 67%]                    │  Avg Score    │
│  Evaluation Progress           │  72.4         │
│  16 / 24 jurors completed      ├──────────────┤
│                                │  Groups       │
│                                │  8            │
└────────────────────────────────┴──────────────┘
```

- Left: Hero metric — large ring (52px) + big value (`text-2xl`) + description
- Right: 2 compact metric rows stacked vertically, each with label + value
- Left takes ~60% width, right takes ~40%
- Responsive: stacks vertically on mobile

### Content Split

```text
┌──────────────────────────┬──────────────────┐
│  Juror Activity Table    │  Criteria        │
│  (flex-[2])              │  Breakdown       │
│                          │  (flex-1)        │
└──────────────────────────┴──────────────────┘
```

- Juror Activity: full table with status badges, progress bars, timestamps
- Criteria Breakdown: colored dots + labels + average scores, compact card
- Responsive: stacks vertically on `< lg` breakpoints

## PageShell Enhancement

| Element | Current | New |
|---------|---------|-----|
| Title | `text-lg font-semibold tracking-tight` | `text-xl font-bold tracking-tight` |
| Content gap | `mt-6` | `mt-8` |
| Description | `text-sm text-muted-foreground` | Same |

## Sidebar Styling

### Light Mode

- Background: `bg-sidebar` (slate-50 / `#f8fafc`)
- Border-right: `border-sidebar-border` (slate-200)
- Active item: white bg + subtle shadow — feels like a "raised card" on the muted sidebar
- Section labels: `text-xs uppercase tracking-wider text-muted-foreground`

### Dark Mode

- Background: `bg-sidebar` (slate-900 / `#0f172a`)
- Active item: `bg-primary text-primary-foreground`
- Section labels: same pattern, darker muted color

## Files to Modify

### Theme tokens

- `src/styles/globals.css` — update `--card`, `--sidebar-*` CSS variables

### Base components

- `src/components/ui/input.jsx` — height, background, padding, shadow
- `src/components/ui/card.jsx` — border instead of ring, shadow
- `src/components/ui/button.jsx` — default height and padding

### Layout

- `src/admin/pages/PageShell.jsx` — title size, content gap
- `src/components/ui/sidebar.jsx` — sidebar background token usage

### Overview

- `src/admin/overview/KpiCard.jsx` — ring progress layout redesign
- `src/admin/overview/KpiGrid.jsx` — may need hero variant support
- `src/admin/OverviewTab.jsx` — hero KPI + split composition layout

## Out of Scope

- Jury form screens (separate iteration)
- Score Grid / Score Details tables
- Analytics chart visual redesign
- Login form layout (benefits automatically from component fixes)
- Dark mode full implementation (token changes enable it; full visual QA is separate)
