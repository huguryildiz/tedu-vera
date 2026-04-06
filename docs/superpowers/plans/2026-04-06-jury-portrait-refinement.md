# Jury Flow Portrait Mode Refinement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tüm jury flow ekranlarında portrait mode'da modal/card tek ekranda, scroll gerektirmeden sığsın; "dense but elegant" premium SaaS hissi.

**Architecture:** İki CSS media query bloğu (`jury.css` dosyasının sonuna eklenir) + `IdentityStep.jsx`'te meta satırlarının birleştirilmesi. Mevcut breakpoint'lere dokunulmaz. Desktop/tablet görünümü etkilenmez.

**Tech Stack:** React, CSS (no CSS-in-JS), Lucide icons

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/styles/jury.css` | Modify — append to end | 2 new `@media` blocks: portrait + short-viewport |
| `src/jury/steps/IdentityStep.jsx` | Modify | Merge 2 meta `<div>` blocks into 1; reduce alert padding |

---

## Task 1: Add portrait media query block to jury.css

**Files:**
- Modify: `src/styles/jury.css` — append after line 2665

- [ ] **Step 1: Append the portrait orientation CSS block**

Add the following **at the very end** of `src/styles/jury.css` (after the last `body:not(.dark-mode) .dj-cb-no:hover` rule):

```css
/* ── Portrait Mode Refinement (375–430px, orientation:portrait) ── */
@media (max-width: 430px) and (orientation: portrait) {
  .jury-step {
    padding: 12px 10px;
  }
  .jury-card {
    padding: 18px 14px;
  }
  .jury-icon-box {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    margin-bottom: 10px;
  }
  .jury-icon-box svg {
    width: 18px;
    height: 18px;
  }
  .jury-title {
    font-size: 16px;
    margin-bottom: 2px;
  }
  .jury-sub {
    font-size: 11.5px;
    margin-bottom: 12px;
  }
  .jury-card .form-group {
    margin-bottom: 10px;
  }
  .jury-card .form-input {
    padding: 8px 12px;
    font-size: 13.5px;
  }
  .jury-card .form-label {
    font-size: 11px;
    margin-bottom: 4px;
  }
  .jury-card .btn-primary {
    padding: 10px;
    font-size: 13.5px;
  }
  .dj-stepper-bar {
    padding: 6px 8px 8px !important;
  }
}

/* ── Short-Viewport Portrait (max-height: 700px) ── */
@media (max-height: 700px) and (orientation: portrait) {
  .jury-icon-box {
    width: 36px;
    height: 36px;
    margin-bottom: 8px;
    border-radius: 10px;
  }
  .jury-icon-box svg {
    width: 16px;
    height: 16px;
  }
  .jury-sub {
    display: none;
  }
  .jury-card .form-group {
    margin-bottom: 8px;
  }
  .dj-stepper-bar {
    padding: 5px 8px 7px !important;
  }
}
```

- [ ] **Step 2: Verify no syntax errors**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds, no CSS parse errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/jury.css
git commit -m "feat(css): portrait mode refinement for all jury flow screens"
```

---

## Task 2: Merge IdentityStep meta rows + compact alert

**Files:**
- Modify: `src/jury/steps/IdentityStep.jsx`

- [ ] **Step 1: Replace the two separate meta `<div>` blocks with one combined block**

In `src/jury/steps/IdentityStep.jsx`, find and replace the two consecutive period-info blocks (lines ~57–129).

**Replace this (two separate blocks):**

```jsx
{/* Period info banner */}
{period && (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: 4,
      justifyContent: "center",
      marginBottom: 16,
      fontSize: "11px",
      color: "var(--text-tertiary, #64748b)",
    }}
  >
    {/* University */}
    {period.organizations?.institution_name && (
      <>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <GraduationCap size={12} strokeWidth={2} />
          {period.organizations.institution_name}
        </span>
        <span style={{ opacity: 0.4 }}>&middot;</span>
      </>
    )}
    {/* Department */}
    {period.organizations?.name && (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Building2 size={12} strokeWidth={2} />
        {period.organizations.name}
      </span>
    )}
  </div>
)}
{period && (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: 4,
      justifyContent: "center",
      marginBottom: 16,
      fontSize: "11px",
      color: "var(--text-tertiary, #64748b)",
    }}
  >
    {/* Semester */}
    {period.name && (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <CalendarDays size={12} strokeWidth={2} />
        {period.name}
      </span>
    )}
    {/* Event date */}
    {period.poster_date && (
      <>
        <span style={{ opacity: 0.4 }}>&middot;</span>
        <span>
          {new Date(period.poster_date + "T00:00:00").toLocaleDateString("en-GB", {
            day: "2-digit", month: "short", year: "numeric",
          })}
        </span>
      </>
    )}
    {/* Group count */}
    {projectCount > 0 && (
      <>
        <span style={{ opacity: 0.4 }}>&middot;</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Users size={12} strokeWidth={2} />
          {projectCount} Groups
        </span>
      </>
    )}
  </div>
)}
```

**With this (single combined block):**

```jsx
{/* Period meta — single row, flex-wrap for narrow widths */}
{period && (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
      fontSize: "11px",
      color: "var(--text-tertiary, #64748b)",
    }}
  >
    {period.organizations?.institution_name && (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <GraduationCap size={12} strokeWidth={2} />
        {period.organizations.institution_name}
      </span>
    )}
    {period.organizations?.name && (
      <>
        <span style={{ opacity: 0.4 }}>&middot;</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Building2 size={12} strokeWidth={2} />
          {period.organizations.name}
        </span>
      </>
    )}
    {period.name && (
      <>
        <span style={{ opacity: 0.4 }}>&middot;</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <CalendarDays size={12} strokeWidth={2} />
          {period.name}
        </span>
      </>
    )}
    {period.poster_date && (
      <>
        <span style={{ opacity: 0.4 }}>&middot;</span>
        <span>
          {new Date(period.poster_date + "T00:00:00").toLocaleDateString("en-GB", {
            day: "2-digit", month: "short", year: "numeric",
          })}
        </span>
      </>
    )}
    {projectCount > 0 && (
      <>
        <span style={{ opacity: 0.4 }}>&middot;</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Users size={12} strokeWidth={2} />
          {projectCount} Groups
        </span>
      </>
    )}
  </div>
)}
```

- [ ] **Step 2: Compact the info alert**

Find the info alert div in `IdentityStep.jsx`:

```jsx
<div
  className="fb-alert fba-info"
  style={{ textAlign: "left", marginBottom: 16, padding: "9px 12px" }}
>
  <div className="fb-alert-icon" style={{ width: 22, height: 22 }}>
    <Info size={12} strokeWidth={2} />
  </div>
  <div className="fb-alert-body">
    <div className="fb-alert-desc" style={{ fontSize: "11px" }}>
      Name and Affiliation cannot be changed once evaluation starts.
    </div>
  </div>
</div>
```

Replace with:

```jsx
<div
  className="fb-alert fba-info"
  style={{ textAlign: "left", marginBottom: 12, padding: "7px 10px" }}
>
  <div className="fb-alert-icon" style={{ width: 20, height: 20 }}>
    <Info size={11} strokeWidth={2} />
  </div>
  <div className="fb-alert-body">
    <div className="fb-alert-desc" style={{ fontSize: "10.5px" }}>
      Name and Affiliation cannot be changed once evaluation starts.
    </div>
  </div>
</div>
```

- [ ] **Step 3: Build and visual check**

```bash
npm run build 2>&1 | tail -20
```

Expected: clean build, no errors.

Open `http://localhost:5173` in DevTools, toggle device emulator to iPhone 14 (390×844), portrait. Verify:
- All 5 meta items (institution, dept, period name, date, groups) appear on 1–2 wrapped lines
- Alert text fits in one line or wraps cleanly
- Full Name, Affiliation, E-mail fields + CTA button visible without scrolling

- [ ] **Step 4: Check short-viewport (iPhone SE)**

In DevTools, switch to iPhone SE (375×667). Verify:
- `.jury-sub` (subtitle) is hidden
- Icon is smaller but still legible
- All 3 form fields still visible

- [ ] **Step 5: Verify desktop is unaffected**

In DevTools, switch to 1280×800. Verify:
- Card still looks identical to before
- No regressions on padding, icon size, or font sizes

- [ ] **Step 6: Commit**

```bash
git add src/jury/steps/IdentityStep.jsx
git commit -m "feat(jury): compact identity step meta row for portrait mode"
```

---

## Acceptance Check

- [ ] Portrait 390×844: no scroll needed to see all 3 form fields + CTA
- [ ] Portrait 375×667: no scroll needed, subtitle hidden, form readable
- [ ] Desktop 1280×800: visually identical to before
- [ ] `npm run build` passes
- [ ] Dark theme glow/blur/border language preserved
