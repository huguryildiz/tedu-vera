---
title: Jury Gate — Premium SaaS Redesign
date: 2026-04-09
status: approved
---

## Summary

Redesign the `JuryGatePage` ("Enter Your Access Code" screen) to match the premium SaaS quality
of the login screen. Three targeted changes: replace the generic icon with the VERA logo,
remove the meaningless divider, and move "Return Home" outside the card to match the login screen's
footer link style.

## Changes

### 1. Replace `KeyRound` icon with VERA logo

**Current:** `<div className="jury-icon-box">` containing a `<KeyRound>` Lucide icon.

**New:** An `<img>` logo block replacing the icon box inside the card header.

- Dark mode → `src/assets/vera_logo_dark.png`
- Light mode (`body:not(.dark-mode)`) → `src/assets/vera_logo_white.png`

Implementation: use a CSS class (`jg-logo`) that sets the `content` via CSS `body:not(.dark-mode)`
override, or render a single `<img>` with a `src` attribute toggled by reading the `dark-mode` class
from `document.body` at render time. Preferred: CSS-only via two `img` tags with conditional
display — one for dark, one for light — controlled by existing `.dark-mode` body class.

Logo dimensions: `height: 28px`, `width: auto`, centered.

Remove the `jury-icon-box` wrapper and the `KeyRound` import.

### 2. Remove the `jg-divider`

**Current:** `<div className="jg-divider"><span>or enter your access code</span></div>` sits
between the subtitle and the form. There is no alternative input method above it, so "or" is
semantically meaningless.

**New:** Delete the divider element entirely. The subtitle flows directly into the form.

Also remove the `.jg-divider` CSS rules (and their light-mode overrides) from `jury.css`.

### 3. Move "Return Home" outside the card — match login screen style

**Current:** `<button className="jg-back-btn">` inside the glass card, with an `<ArrowLeft>` icon.

**New:** A `<div className="login-footer">` wrapper containing a `<button className="form-link">`
placed **outside and below** the `.jury-gate-card` element, parallel to how `LoginScreen` renders:

```jsx
<div className="login-footer" style={{ marginTop: "8px" }}>
  <button type="button" className="form-link" onClick={() => navigate("/", { replace: true })}>
    ← Return Home
  </button>
</div>
```

The `ArrowLeft` import can be removed (replaced by the `←` character, matching login).
Remove the `.jg-back-btn` CSS rules from `jury.css`.

## Files Affected

| File | Change |
|---|---|
| `src/jury/JuryGatePage.jsx` | Logo img, remove divider element, move Return Home outside card |
| `src/styles/jury.css` | Remove `.jg-divider` + `.jg-back-btn` rules; add `.jg-logo` |

## Out of Scope

- Loading/denied states of `JuryGatePage` — no changes to those states
- Any jury flow step beyond the gate screen
- Login screen — no changes
