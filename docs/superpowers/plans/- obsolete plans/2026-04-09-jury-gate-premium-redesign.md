# Jury Gate Premium Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `JuryGatePage` to premium SaaS quality — replace the `KeyRound` icon with the VERA logo (dark/light mode aware), remove the meaningless divider, and move "Return Home" outside the card matching the login screen's footer link style.

**Architecture:** Pure UI changes to two files: `JuryGatePage.jsx` (JSX structure) and `jury.css` (remove dead rules, add logo styles). No logic, API, or routing changes. Dark/light mode logo switching is handled via CSS `body:not(.dark-mode)` toggling `display` on two `<img>` elements.

**Tech Stack:** React, CSS (existing `vera.css`/`jury.css` design tokens), Lucide icons (some imports removed)

---

## Files

| File | Change |
|---|---|
| `src/jury/JuryGatePage.jsx` | Remove icon box + divider, add logo imgs, move Return Home outside card |
| `src/styles/jury.css` | Remove `.jg-divider` + `.jg-back-btn` rules, add `.jg-logo` rules |

---

### Task 1: Remove dead CSS rules and add logo styles

**Files:**
- Modify: `src/styles/jury.css` (lines ~2333–2382)

The `.jg-divider`, `.jg-divider::before`, `.jg-divider::after`, `.jg-divider span`,
`body:not(.dark-mode) .jg-divider::before`, `body:not(.dark-mode) .jg-divider::after`,
`body:not(.dark-mode) .jg-divider span`, `.jg-back-btn`, and `.jg-back-btn:hover` rules
are all being deleted. A new `.jg-logo` block is added in their place.

- [ ] **Step 1: Delete the `.jg-divider` rule block (lines ~2333–2353 in jury.css)**

Find and delete this entire block (the comment line through the last light-mode override):

```css
/* ── Divider: "or enter your access code" — prominent ── */
.jg-divider{
  display:flex;align-items:center;gap:10px;
  margin:18px 0 14px;
  user-select:none;
}
.jg-divider::before,.jg-divider::after{
  content:'';flex:1;height:1px;
  background:linear-gradient(90deg,transparent,rgba(148,163,184,0.22) 40%,rgba(148,163,184,0.22) 60%,transparent);
}
.jg-divider span{
  font-size:12px;font-weight:600;letter-spacing:0.03em;
  color:var(--text-secondary);
  white-space:nowrap;
  padding:0 4px;
}
body:not(.dark-mode) .jg-divider::before,
body:not(.dark-mode) .jg-divider::after{
  background:linear-gradient(90deg,transparent,rgba(15,23,42,0.14) 40%,rgba(15,23,42,0.14) 60%,transparent);
}
body:not(.dark-mode) .jg-divider span{color:#374151}
```

- [ ] **Step 2: Delete the `.jg-back-btn` rule block (lines ~2376–2382 in jury.css)**

Find and delete:

```css
.jg-back-btn{
  display:inline-flex;align-items:center;gap:5px;
  background:none;border:none;cursor:pointer;
  font-size:13px;color:var(--text-tertiary);padding:6px 0;
  transition:color .15s;margin-bottom:10px;
}
.jg-back-btn:hover{color:var(--text-primary)}
```

- [ ] **Step 3: Add `.jg-logo` rules right after the `.jg-icon-wrap` rule (~line 2329)**

Insert after `.jg-icon-wrap{display:flex;justify-content:center;margin-bottom:20px}`:

```css
.jg-logo{display:flex;justify-content:center;margin-bottom:20px}
.jg-logo img{height:28px;width:auto;display:block}
/* Dark mode shows vera_logo_dark, light mode shows vera_logo_white */
.jg-logo .jg-logo-light{display:none}
body:not(.dark-mode) .jg-logo .jg-logo-dark{display:none}
body:not(.dark-mode) .jg-logo .jg-logo-light{display:block}
```

- [ ] **Step 4: Verify the file looks right**

Run: `grep -n "jg-divider\|jg-back-btn\|jg-logo" src/styles/jury.css`

Expected output: only `jg-logo` lines, zero `jg-divider` or `jg-back-btn` lines.

---

### Task 2: Update JuryGatePage.jsx — logo, remove divider, move Return Home

**Files:**
- Modify: `src/jury/JuryGatePage.jsx`

- [ ] **Step 1: Update the import line — remove `ArrowLeft`, add logo assets**

Current import at line 8:
```js
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
```

Replace with:
```js
import { KeyRound, Loader2 } from "lucide-react";
import veraLogoDark from "../assets/vera_logo_dark.png";
import veraLogoWhite from "../assets/vera_logo_white.png";
```

(`KeyRound` is still used in the input field icon — keep it.)

- [ ] **Step 2: Replace the icon box with the logo block**

Current JSX (lines ~175–178):
```jsx
{/* Icon */}
<div className="jury-icon-box" style={{ marginBottom: 20 }}>
  <KeyRound size={24} strokeWidth={1.8} />
</div>
```

Replace with:
```jsx
{/* Logo */}
<div className="jg-logo">
  <img src={veraLogoDark} alt="VERA" className="jg-logo-dark" />
  <img src={veraLogoWhite} alt="VERA" className="jg-logo-light" />
</div>
```

- [ ] **Step 3: Remove the divider element**

Current JSX (lines ~193–195):
```jsx
{/* Divider */}
<div className="jg-divider">
  <span>or enter your access code</span>
</div>
```

Delete these three lines entirely.

- [ ] **Step 4: Replace the jg-back-btn with login-footer style — move it outside the card**

Current JSX inside the card (lines ~224–227):
```jsx
{/* Back */}
<button className="jg-back-btn" onClick={() => navigate("/", { replace: true })}>
  <ArrowLeft size={13} />
  Return Home
</button>
```

Delete those lines from inside the card.

Then, after the closing `</div>` of `.jury-gate-card` (and before the closing `</div>` of `.jury-step`), add:

```jsx
<div className="login-footer" style={{ marginTop: "8px" }}>
  <button type="button" className="form-link" onClick={() => navigate("/", { replace: true })}>
    ← Return Home
  </button>
</div>
```

- [ ] **Step 5: Verify the final JSX structure**

The outer return (non-loading state) should look like this:

```jsx
return (
  <div className="jury-screen jury-gate-screen">
    <div className="jury-step">
      <div className="jury-card dj-glass-card jury-gate-card">

        {/* Logo */}
        <div className="jg-logo">
          <img src={veraLogoDark} alt="VERA" className="jg-logo-dark" />
          <img src={veraLogoWhite} alt="VERA" className="jg-logo-light" />
        </div>

        {/* Header */}
        <div className="jury-title" style={{ marginBottom: 8 }}>Enter Your Access Code</div>
        <div className="jury-sub" style={{ marginBottom: 16 }}>
          Paste the link from your invitation email, or type your access code below.
        </div>

        {/* Denied banner */}
        {status === "denied" && (
          <FbAlert variant="danger" title="Access denied" style={{ marginBottom: 16, textAlign: "left" }}>
            {denyMessage || "The link is invalid, expired, or has been revoked."}
          </FbAlert>
        )}

        {/* Manual token entry */}
        <form onSubmit={handleVerify} className="jg-form">
          <div className="jg-input-wrap">
            <KeyRound size={15} className="jg-input-icon" />
            <input
              ref={inputRef}
              className="form-input jg-token-input"
              placeholder="Paste your access link or code…"
              value={manualToken}
              onChange={(e) => setManual(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button
            type="submit"
            className="btn-primary jg-verify-btn"
            disabled={!manualToken.trim() || verifying}
          >
            {verifying
              ? <><Loader2 size={14} className="jg-spin" /> Verifying…</>
              : "Verify Access"}
          </button>
        </form>

        <div className="jury-gate-note">
          If you are a walk-in juror, please contact the registration desk.
        </div>

      </div>

      <div className="login-footer" style={{ marginTop: "8px" }}>
        <button type="button" className="form-link" onClick={() => navigate("/", { replace: true })}>
          ← Return Home
        </button>
      </div>

    </div>
  </div>
);
```

- [ ] **Step 6: Verify no remaining references to removed elements**

Run:
```bash
grep -n "ArrowLeft\|jg-back-btn\|jg-divider" src/jury/JuryGatePage.jsx
```

Expected: no output (zero matches).

---

### Task 3: Verify in browser

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the gate page**

Navigate to `http://localhost:5173/eval` (or any URL that lands on the gate screen — no token needed, it shows the manual entry form).

Check:
- VERA logo appears at the top of the card (dark mode)
- No `KeyRound` icon box visible
- No "or enter your access code" divider visible
- "← Return Home" link appears **below** the card, styled as a blue text link (matching login screen)
- Form + Verify button render correctly

- [ ] **Step 3: Toggle light mode**

In DevTools console: `document.body.classList.toggle('dark-mode')`

Check:
- Light mode logo (`vera_logo_white.png` → should be visible on light background)
- "← Return Home" link color matches light-mode `form-link` override (blue `#3b82f6`)

- [ ] **Step 4: Check mobile viewport**

Resize to 390px width. Verify:
- Logo still visible (not hidden by existing mobile rule — check: `.jury-gate-card .jury-icon-box{display:none}` only hides `jury-icon-box`, not `jg-logo` ✓)
- Return Home link still visible below the card

---

### Task 4: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add src/jury/JuryGatePage.jsx src/styles/jury.css
git commit -m "feat: jury gate premium redesign — VERA logo, remove divider, footer Return Home link"
```
