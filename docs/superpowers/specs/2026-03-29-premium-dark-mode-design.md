# Premium Dark Mode Design Spec

**Date:** 2026-03-29
**Scope:** React app only (not prototype HTML)
**Approach:** Unified token override (Approach 1)

---

## Goal

Add a toggleable premium dark theme to VERA that feels like Linear/Vercel — elegant,
readable, high-contrast where needed, calm and enterprise-ready. Light remains default.

## Decisions

| Decision | Choice |
|---|---|
| Toggle vs always-on | Toggleable (B) |
| Toggle location | Sidebar footer (existing) + OS preference fallback (B+D hybrid) |
| Scope | React app only, not prototype HTML |
| Approach | Unified token override in `.dark` blocks |

## Existing Infrastructure (Already Implemented)

- `ThemeProvider` + `useTheme` hook in `src/shared/theme/ThemeProvider.jsx`
- Sidebar footer toggle in `AdminSidebar.jsx` (Sun/Moon icons)
- `localStorage("vera-theme")` persistence
- `prefers-color-scheme` fallback
- `.dark` class on `<html>` element
- `@custom-variant dark (&:is(.dark *))` in `globals.css`
- shadcn `.dark` block in `globals.css` (basic/default values)

**What's missing:** Premium dark token values and hardcoded color migration.

## Premium Dark Palette

### Backgrounds (layered depth)

| Role | Value | Notes |
|---|---|---|
| Page | `#0a0f1a` | Deep navy-black, not pure black |
| Card / Surface | `#111827` | Slightly elevated |
| Secondary surface | `#1e293b` | Panels, table headers |
| Tertiary / hover | `#263348` | Subtle lift on interaction |

### Borders

| Role | Value |
|---|---|
| Default | `rgba(255,255,255,0.07)` |
| Strong | `rgba(255,255,255,0.12)` |
| Focus ring | `rgba(96,165,250,0.4)` |

### Text hierarchy

| Role | Value | Notes |
|---|---|---|
| Primary | `#f1f5f9` | Crisp but not pure white |
| Secondary | `#94a3b8` | Comfortable reading gray |
| Tertiary / muted | `#64748b` | Labels, timestamps |
| Disabled | `#475569` | Clearly de-emphasized |

### Brand accent

| Role | Value |
|---|---|
| Primary | `#60a5fa` |
| Hover | `#93c5fd` |
| Soft bg | `rgba(59,130,246,0.12)` |

### Semantic states

| State | Text | Background |
|---|---|---|
| Success | `#4ade80` | `rgba(34,197,94,0.12)` |
| Warning | `#fbbf24` | `rgba(245,158,11,0.12)` |
| Danger | `#f87171` | `rgba(239,68,68,0.12)` |
| Info | `#60a5fa` | `rgba(59,130,246,0.12)` |

### Shadows

| Role | Value |
|---|---|
| Card | `0 1px 3px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2)` |
| Elevated | `0 8px 32px rgba(0,0,0,0.4)` |
| Accent glow | `0 0 20px rgba(59,130,246,0.15)` |

### Rank badges (dark-adapted)

| Rank | Background | Text | Border |
|---|---|---|---|
| Gold | `rgba(202,138,4,0.15)` | `#fbbf24` | `rgba(251,191,36,0.3)` |
| Silver | `rgba(148,163,184,0.12)` | `#cbd5e1` | `rgba(148,163,184,0.3)` |
| Bronze | `rgba(180,83,9,0.15)` | `#fb923c` | `rgba(251,146,60,0.3)` |

## Token Override Strategy

### Layer 1 — `shared.css` `.dark` block (~40 custom tokens)

Add a `.dark { ... }` block to `shared.css` that overrides all custom design tokens:

```css
.dark {
  /* Backgrounds */
  --card-bg:       #111827;
  --gray-50:       #0a0f1a;
  --gray-100:      #1e293b;
  --gray-200:      rgba(255,255,255,0.07);
  --gray-300:      rgba(255,255,255,0.12);
  --gray-500:      #94a3b8;
  --gray-700:      #cbd5e1;
  --gray-900:      #f1f5f9;

  /* Navy (used in premium-screen gradients — stays dark) */
  --navy-900:      #050a18;
  --navy-800:      #0a1128;

  /* Text */
  --text-900:      #f1f5f9;
  --text-600:      #94a3b8;
  --text-primary:  var(--gray-900);
  --text-secondary: var(--gray-700);

  /* Brand */
  --brand-600:     #60a5fa;
  --brand-500:     #93c5fd;
  --brand-800:     #3b82f6;
  --primary-action: #60a5fa;

  /* Status */
  --blue:          #60a5fa;
  --blue-light:    rgba(59,130,246,0.15);
  --blue-dark:     #93c5fd;
  --green:         #4ade80;
  --green-light:   rgba(34,197,94,0.15);
  --amber:         #fbbf24;
  --amber-light:   rgba(245,158,11,0.15);
  --red:           #f87171;
  --red-light:     rgba(239,68,68,0.15);
  --error-accent:  #f87171;

  /* Ring / Progress */
  --ring-track:    rgba(255,255,255,0.08);
  --ring-empty:    rgba(255,255,255,0.08);

  /* Shadows */
  --shadow:        0 1px 3px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2);
  --shadow-lg:     0 8px 32px rgba(0,0,0,0.4);

  /* Button effects */
  --btn-focus-ring-brand:  0 0 0 3px rgba(96,165,250,0.4);
  --btn-focus-ring-danger: 0 0 0 3px rgba(248,113,113,0.4);
  --btn-shadow-rest:       0 1px 2px rgba(0,0,0,0.3);
  --btn-shadow-hover:      0 10px 20px rgba(0,0,0,0.4);
  --btn-shadow-press:      0 4px 10px rgba(0,0,0,0.35);
  --btn-glow-brand-soft:   0 0 0 4px rgba(96,165,250,0.2);
  --btn-glow-danger-soft:  0 0 0 4px rgba(248,113,113,0.2);

  /* Scrollbar */
  --scrollbar-thumb:       #60a5fa;
  --scrollbar-thumb-hover: #93c5fd;
}
```

### Layer 2 — `globals.css` `.dark` premium upgrade

Replace the existing generic `.dark` block with premium-tuned values:

```css
.dark {
  --background: oklch(0.07 0.02 260);    /* #0a0f1a deep navy */
  --foreground: oklch(0.96 0.005 260);   /* #f1f5f9 */
  --card: oklch(0.13 0.02 260);          /* #111827 */
  --card-foreground: oklch(0.96 0.005 260);
  --popover: oklch(0.15 0.02 260);       /* slightly above card */
  --popover-foreground: oklch(0.96 0.005 260);
  --primary: oklch(0.65 0.15 250);       /* #60a5fa */
  --primary-foreground: oklch(0.13 0.02 260);
  --secondary: oklch(0.20 0.02 260);     /* #1e293b */
  --secondary-foreground: oklch(0.96 0.005 260);
  --muted: oklch(0.20 0.02 260);
  --muted-foreground: oklch(0.60 0.02 260); /* #94a3b8 */
  --accent: oklch(0.22 0.02 260);        /* #263348 */
  --accent-foreground: oklch(0.96 0.005 260);
  --destructive: oklch(0.65 0.2 25);     /* #f87171 */
  --border: oklch(1 0 0 / 7%);
  --input: oklch(1 0 0 / 10%);
  --ring: oklch(0.65 0.15 250);          /* matches primary */
  --sidebar: oklch(0.13 0.02 260);
  --sidebar-foreground: oklch(0.96 0.005 260);
  --sidebar-primary: oklch(0.65 0.15 250);
  --sidebar-primary-foreground: oklch(0.96 0.005 260);
  --sidebar-accent: oklch(0.22 0.02 260);
  --sidebar-accent-foreground: oklch(0.96 0.005 260);
  --sidebar-border: oklch(1 0 0 / 7%);
  --sidebar-ring: oklch(0.65 0.15 250);
}
```

### Layer 3 — Hardcoded color migration

Convert the most common hardcoded hex values in admin CSS to token references:

| Hardcoded | Replace with | Occurrences |
|---|---|---|
| `#ffffff`, `#fff` (backgrounds) | `var(--card-bg)` | ~15 |
| `#0f172a` (text) | `var(--gray-900)` | ~20 |
| `#475569` (text) | `var(--gray-500)` or `var(--text-600)` | ~12 |
| `#94a3b8` (muted text) | `var(--gray-500)` | ~15 |
| `#64748b` (muted text) | `var(--gray-500)` | ~12 |
| `#e2e8f0` (borders) | `var(--gray-200)` | ~15 |
| `#f1f5f9` (light bg) | `var(--gray-100)` | ~8 |
| `#f8fafc` (lighter bg) | `var(--gray-50)` | ~5 |
| `#cbd5e1` (borders) | `var(--gray-300)` | ~8 |
| `#334155` (text) | `var(--gray-700)` | ~5 |
| `#3b82f6` (brand blue) | `var(--brand-600)` | ~25 |
| `#2563eb` (darker blue) | `var(--brand-800)` | ~5 |

**Not migrated (intentionally):**

- Rank badge gradient colors (gold/silver/bronze) — these get separate `.dark` overrides
- Status pill specific tints — these get `.dark` overrides
- Chart semantic colors — handled at chart component level
- Navy gradient backgrounds in premium-screen — already dark

## Component-Level Changes

### Auto-inheriting (no CSS changes needed)

- shadcn UI components (Button, Input, DropdownMenu, Tooltip, etc.)
- Admin sidebar — uses shadcn sidebar tokens
- Dashboard chart cards — use `--surface-bg`, `--surface-border`
- Admin screen shell — uses `--surface-*` aliases

### Needs hardcoded color migration

| File | Work |
|---|---|
| `home.css` | Card bg, text colors, button colors, footer |
| `admin-auth.css` | Form backgrounds, title colors, success states |
| `admin-summary.css` | Rank badges, status pills, score displays |
| `admin-dashboard.css` | Chart backgrounds, legends, filter panels, MÜDEK pills |
| `admin-jurors.css` | Status badges, evaluation cards, progress bars |
| `admin-details.css` | Table backgrounds, filter panels, score cells |
| `admin-layout.css` | Demo banner (minimal), status badges |
| `admin-matrix.css` | Matrix cell backgrounds (minimal) |

### Special dark mode overrides needed

These components have complex color schemes that cannot be solved by token swap alone:

1. **Rank badges** — gold/silver/bronze gradients need `.dark` class overrides
2. **Status badges** — completed/ready/in-progress backgrounds need dark variants
3. **Heatmap cells** — green/yellow/red cells need adjusted alpha for dark backgrounds
4. **Home page card** — white card on dark bg becomes dark card, needs full restyle
5. **Body background** — `shared.css` body rule applies `var(--gray-50)` which auto-inherits

## Files Modified (Summary)

| File | Type of change |
|---|---|
| `src/styles/globals.css` | Upgrade `.dark` block with premium oklch values |
| `src/styles/shared.css` | Add `.dark` block for ~40 custom tokens |
| `src/styles/home.css` | Replace hardcoded colors with tokens + add `.dark` overrides |
| `src/styles/admin-auth.css` | Replace hardcoded colors with tokens + add `.dark` overrides |
| `src/styles/admin-summary.css` | Replace hardcoded colors + rank badge dark overrides |
| `src/styles/admin-dashboard.css` | Replace hardcoded colors + chart/legend dark overrides |
| `src/styles/admin-jurors.css` | Replace hardcoded colors + status badge dark overrides |
| `src/styles/admin-details.css` | Replace hardcoded colors + table dark overrides |
| `src/styles/admin-layout.css` | Replace hardcoded colors (minimal) |
| `src/styles/admin-matrix.css` | Matrix cell dark overrides |

## Out of Scope

- Prototype HTML file (`vera-premium-prototype.html`)
- New components or React code changes (infrastructure already exists)
- Chart.js/SVG chart color changes (these use inline styles driven by config.js)
- Jury flow CSS (`jury-confetti.css`, `jury-pin.css`) — jury screens already use dark premium-screen

## Quality Criteria

- All text meets WCAG AA contrast ratio (4.5:1 for body, 3:1 for large text)
- Cards visually separate from page background
- Sticky headers/columns have explicit backgrounds (no transparency bleed)
- Status pills and semantic colors remain distinguishable
- Rank badges maintain visual hierarchy
- Toggle persists across sessions
- OS preference respected when no manual choice made
- No flash of wrong theme on page load (ThemeProvider handles this)
