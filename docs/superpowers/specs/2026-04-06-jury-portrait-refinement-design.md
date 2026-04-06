# Jury Flow Portrait Mode Refinement

**Date:** 2026-04-06
**Scope:** All jury flow screens — IdentityStep, PinStep, PinRevealStep, ProgressStep, EvalStep, DoneStep, LockedStep
**Goal:** Portrait mode'da jury flow ekranları tek parça halinde, scroll gerektirmeden görünsün. "Dense but elegant" — sıkıştırılmış değil, bilinçli yoğunlaştırılmış.

## Approach

**B: CSS portrait layer + IdentityStep JSX restructure**

- CSS-only for all steps except IdentityStep
- IdentityStep meta rows merged into one flex line
- No existing breakpoints touched; new portrait-specific blocks added below

## Files Changed

| File | Change |
|---|---|
| `src/styles/jury.css` | 2 new media query blocks (~40 lines) |
| `src/jury/steps/IdentityStep.jsx` | Meta rows merged + alert padding reduced |

## CSS Changes

### Block 1 — `@media (max-width: 430px) and (orientation: portrait)`

Targets: 375–430px width phones in portrait (iPhone SE, 14/15, Pixel series).

| Selector | Property | Before | After |
|---|---|---|---|
| `.jury-step` | `padding` | `24px` | `12px 10px` |
| `.jury-card` | `padding` | `20px 14px` | `18px 14px` |
| `.jury-icon-box` | `width/height` | `52px` | `40px` |
| `.jury-icon-box` | `margin-bottom` | `16px` | `10px` |
| `.jury-icon-box` | `border-radius` | `16px` | `12px` |
| `.jury-icon-box svg` | size | `24px` | `18px` |
| `.jury-title` | `font-size` | `18px` | `16px` |
| `.jury-title` | `margin-bottom` | `4px` | `2px` |
| `.jury-sub` | `font-size` | `12.5px` | `11.5px` |
| `.jury-sub` | `margin-bottom` | `24px` | `12px` |
| `.form-group` | `margin-bottom` | — | `10px` |
| `.form-input` | `padding` | default | `8px 12px` |
| `.form-label` | `font-size` | `12px` | `11px` |
| `.btn-primary` | `padding` | default | `10px` |
| `.dj-stepper-bar` | `padding` | `8px 10px 10px` | `6px 8px 8px` |

### Block 2 — `@media (max-height: 700px) and (orientation: portrait)`

Targets: short-viewport portrait (iPhone SE 2nd gen ~667px, folded devices).

- `.jury-icon-box` → `36×36px`
- `.jury-sub` → `display: none` (subtitle hidden; title sufficient)
- `.form-group` → `margin-bottom: 8px`
- `.dj-stepper-bar` → `padding: 5px 8px 7px`

## JSX Changes — IdentityStep

### Meta rows: 2 blocks → 1 block

**Before:** Two separate `<div>` blocks, each with `marginBottom: 16px`:
- Block 1: institution · org name
- Block 2: period name · date · groups

**After:** Single `<div>`, all meta items inline, `flexWrap: "wrap"`, `gap: 6px`, `marginBottom: 12px`.

Saves ~16–20px vertical space. `flex-wrap` handles narrow widths naturally.

### Info alert

`padding` reduced from `"9px 12px"` → `"7px 10px"`.
`fontSize` reduced from `"11px"` → `"10.5px"`.
`marginBottom: 16px` → `marginBottom: 12px`.

## Acceptance Criteria

- Portrait mode'da modal ilk açılışta çok daha bütüncül görünmeli
- 375–430px arası telefonlarda isim, affiliation, e-mail alanları ve üst bilgiler aynı ekranda görülebilmeli
- Desktop/tablet görünümü bozulmamış olmalı
- `npm run build` hatasız geçmeli
- Dark theme + glow + blur dili korunmalı

## Constraints

- Mevcut breakpoint'lere (`max-width: 768px`, `max-width: 480px`, landscape portrait blokları) dokunulmaz
- Diğer step JSX dosyalarına dokunulmaz — CSS kazanımı yeterli
- Scroll tamamen engellenmez; sadece taşma minimuma indirilir
