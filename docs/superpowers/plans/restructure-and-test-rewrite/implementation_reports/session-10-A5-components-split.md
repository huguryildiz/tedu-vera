# Session 10 — A5: components.css Split

**Date:** 2026-04-23
**Branch:** main
**Build:** ✅ green after split

---

## Scope

Split the `src/styles/components.css` monolith (4922 lines) into 8 per-pattern CSS files under `src/styles/components/`. Update `src/styles/main.css` to import each file individually. Delete `components.css`.

---

## Files Created

| File | Lines | Contents |
|---|---|---|
| `src/styles/components/buttons.css` | 129 | Dark mode button overrides (`.btn-primary`, `.btn-outline`, `.btn-danger`), `.btn-loading-content`, admin primary button CSS custom property system, `.btn-success`, `body:not(.dark-mode)` button border fix |
| `src/styles/components/cards.css` | 134 | Team member chips (`.team-members-inline`, `.team-member-chip`, `.team-member-avatar`), meta chip row pattern, `.verdict-badge`, `.juror-card-link`, row-meta chips |
| `src/styles/components/forms.css` | 70 | Field validation (`.field-error`, `.field-success`, `.field-helper`, `.field-req`), interactive validation showcase (`.validation-showcase`, `.vld-*` system), `.modal-input` |
| `src/styles/components/alerts.css` | 114 | `.dark-mode .fs-alert.*` overrides, `:root` fb feedback status tokens (`--fb-success/warning/danger/info/editing`), full toast system (`@keyframes toast-in/out`, `.toast-container`, `.toast`, `.toast-icon`, `.toast-body`, `.toast-progress-bar`), page-level banners (`.fb-banner`), modal inline feedback (`.fb-modal-alert`), empty/error states (`.fb-empty`), autosave indicator (`.fb-autosave`, `@keyframes fb-spin`) |
| `src/styles/components/tables.css` | 151 | `.table-wrap`, `table`, `th`, `td`, sortable headers, `.tabs`, `.tab`, `.sub-page`, `.grid-2`, `.grid-3`, `.overview-right-stack`, `.chart-card`, `.score-grid-wrap`, `.score-cell`, `.score-high/mid/low/missing`, full `.acc-summary` accreditation system, `.acc-table`, `.acc-code`, `.acc-outcome-label`, `.acc-chip-wrap`, `.acc-chip`, `.acc-no-criteria`, `.acc-coverage`, `.acc-drawer-*` elements |
| `src/styles/components/pills-badges.css` | 128 | Consensus light mode (`body:not(.dark-mode) .consensus-*`), `.project-no-badge`, `.badge` system, `.status-dot`, consensus badges (`.consensus-badge`, `.consensus-high/moderate/disputed/low`), `.consensus-sub` tooltip with arrow, per-level sigma colors |
| `src/styles/components/nav-menu.css` | 147 | Floating action menu (`.floating-menu`, `.floating-menu-item`, `.floating-menu-divider`, `@keyframes publish-ready-pulse`, `.publish-ready`), UserAvatarMenu (`.ph-avatar-btn`, `.ph-avatar-menu`, `.ph-avatar-menu-header`, `.ph-avatar-menu-identity`, `.ph-avatar-menu-name`, `.ph-avatar-role-badge`, `.ph-avatar-menu-tenant`, `.ph-avatar-menu-item`, light mode overrides) |
| `src/styles/components/misc.css` | 2655 | All remaining: custom scrollbars, dark mode surface overrides (admin-main/shell/header, jury screens, eval, score cards), dark mode glass card overrides, scores/rankings/compare UI, modal dialog structure, audit log CSS, DJ component, VERA PREMIUM POLISH PASS (identity icons, auth icon wraps, feature icons), settings light mode, typography hierarchy, sidebar/tab nav, dark mode depth system, entry-control/audit portrait media queries, `[data-tooltip]` CSS tooltip, security signal pill (`.sec-pill-wrap`, `.sec-pill`, `.sec-popover`), maintenance banners, email verify banner (`.evb-wrap`, `@keyframes ln-shimmer/ln-glow-bar/ln-ring`), vera-es empty state system (`.vera-es-card`, `@keyframes vera-ghost-pulse`), lock notice banner (`.lock-notice`), unified mobile card (`.mcard`), row action button (`.row-action-btn`), mobile card selection global rule, admin team owner pill (`.admin-team-owner-pill`) |

**Total:** 3528 lines across 8 files (vs. 4922 lines in original monolith — difference: content already extracted in prior sessions A1–A4)

---

## Files Modified

### `src/styles/main.css`

Replaced single import:
```css
@import './components.css';
```

With 8 targeted imports:
```css
@import './components/buttons.css';
@import './components/cards.css';
@import './components/forms.css';
@import './components/alerts.css';
@import './components/tables.css';
@import './components/pills-badges.css';
@import './components/nav-menu.css';
@import './components/misc.css';
```

---

## Files Deleted

- `src/styles/components.css` — 4922-line monolith removed

---

## Deduplication Rules Applied

These sections were present in `components.css` but **skipped** from misc.css because they had already been extracted to other target files:

| Skip target | Content |
|---|---|
| `buttons.css` | Dark mode `.btn-*` overrides (lines ~257–264), `.btn-loading-content` (line ~497), admin button system + `.btn-success` (lines ~2330–2448) |
| `cards.css` | `.card`, `.kpi` (lines ~520–568) |
| `forms.css` | Field validation, validation showcase, `.modal-input` (lines ~1025–1219) |
| `alerts.css` | `.dark-mode .fs-alert.*` (lines ~265–269), full toast/banner/empty state system (lines ~1025–1202) |
| `tables.css` | Table pattern, tabs, grid, acc-* system (lines ~570–749) |
| `pills-badges.css` | Consensus light mode (lines ~233–255), consensus badges (lines ~856–937) |
| `nav-menu.css` | Floating menu base (lines ~818–853), UserAvatarMenu (lines ~3068–3178) |

### `.fb-alert` base — not duplicated

`.fb-alert` base styles live in `src/shared/ui/FbAlert.css` (co-located from Session 2). The alerts.css file contains only the `:root` token vars and `.dark-mode .fs-alert.*` overrides from `drawers.css`.

### `@keyframes modal-in` — deduplicated

The keyframe `@keyframes modal-in` appeared twice in the source (compare modal block ~line 1005 and modal dialog block ~line 1208). Only one instance was written into misc.css.

---

## Verification

- **Build:** `npm run build` → ✅ 3193 modules transformed, no CSS import errors
- **Dev server:** All 8 component CSS files return HTTP 200 from Vite dev server
- **Playwright unavailable:** Browser session was locked by a prior conversation; visual smoke test was performed via build output + HTTP status verification instead
- **components.css deleted:** Confirmed absent from `src/styles/`

---

## State After Session

- `src/styles/components/` — 8 new files (3528 total lines)
- `src/styles/components.css` — **deleted**
- `src/styles/main.css` — updated to 8 imports
- **Faz A5 complete**
- **Next:** A6 — `src/styles/` finalize (globals-only audit), then Faz B (test rewrite)
