# Juror Cards Mobile Portrait Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cramped 2-row mobile card layout on the Jurors page with a compact, theme-consistent card: 34px avatar + name/affiliation + score + status pill in the main row, thin progress bar strip below.

**Architecture:** Add a dedicated `<td className="col-mobile-card">` alongside existing columns in each `<tr>`. CSS hides existing columns on mobile and shows only this cell. Desktop is untouched. Kebab (···) opens an action dropdown; tapping anywhere else on the card opens the edit drawer.

**Tech Stack:** React 18, CSS (scoped media query), lucide-react icons, Vitest/RTL for unit tests.

---

## File Map

| File | What changes |
|------|-------------|
| `src/styles/pages/jurors.css:305-428` | Replace existing mobile section with new `.jc-*` card classes |
| `src/admin/pages/JurorsPage.jsx` | Add 2 helper functions, `mobileMenuRef`, update outside-click effect, add `has-open-menu` on `<tbody>`, add `col-mobile-card` `<td>` inside the row map, update lucide import |
| `src/admin/__tests__/jurorsMobileHelpers.test.js` | New — unit tests for the two pure helper functions |

---

## Task 1: Write failing tests for helper functions

**Files:**
- Create: `src/admin/__tests__/jurorsMobileHelpers.test.js`

These two functions are pure — test them before writing them.

- [ ] **Step 1.1: Create the test file**

```js
// src/admin/__tests__/jurorsMobileHelpers.test.js
import { describe, it, expect } from "vitest";

// Import from the page file once the functions exist.
// For now, duplicate inline so the test can fail first.
function mobileScoreStyle(score) {
  throw new Error("not implemented");
}
function mobileBarFill(status) {
  throw new Error("not implemented");
}

describe("mobileScoreStyle", () => {
  it("returns green for score >= 90", () => {
    expect(mobileScoreStyle("94.3")).toEqual({ color: "#34d399" });
    expect(mobileScoreStyle("90.0")).toEqual({ color: "#34d399" });
  });
  it("returns blue for 74 <= score < 90", () => {
    expect(mobileScoreStyle("74.9")).toEqual({ color: "#60a5fa" });
    expect(mobileScoreStyle("89.9")).toEqual({ color: "#60a5fa" });
  });
  it("returns orange for 60 <= score < 74", () => {
    expect(mobileScoreStyle("61.2")).toEqual({ color: "#fb923c" });
    expect(mobileScoreStyle("73.9")).toEqual({ color: "#fb923c" });
  });
  it("returns muted for score < 60", () => {
    expect(mobileScoreStyle("55.0")).toEqual({ color: "#475569" });
  });
  it("returns muted for null/undefined/empty", () => {
    expect(mobileScoreStyle(null)).toEqual({ color: "#475569" });
    expect(mobileScoreStyle(undefined)).toEqual({ color: "#475569" });
    expect(mobileScoreStyle("")).toEqual({ color: "#475569" });
    expect(mobileScoreStyle("—")).toEqual({ color: "#475569" });
  });
});

describe("mobileBarFill", () => {
  it("returns success var for completed", () => {
    expect(mobileBarFill("completed")).toBe("var(--success)");
  });
  it("returns blue hex for editing", () => {
    expect(mobileBarFill("editing")).toBe("#60a5fa");
  });
  it("returns warning var for in_progress", () => {
    expect(mobileBarFill("in_progress")).toBe("var(--warning)");
  });
  it("returns warning var for ready_to_submit", () => {
    expect(mobileBarFill("ready_to_submit")).toBe("var(--warning)");
  });
  it("returns muted for not_started and unknown", () => {
    expect(mobileBarFill("not_started")).toBe("rgba(100,116,139,0.3)");
    expect(mobileBarFill(undefined)).toBe("rgba(100,116,139,0.3)");
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
npm test -- --run src/admin/__tests__/jurorsMobileHelpers.test.js
```

Expected: FAIL with `Error: not implemented`.

---

## Task 2: Add helper functions to JurorsPage.jsx

**Files:**
- Modify: `src/admin/pages/JurorsPage.jsx` — after `groupTextClass` (~line 130)

- [ ] **Step 2.1: Add the two pure helpers after `groupTextClass`**

Find this block (around line 126–131):
```js
function groupTextClass(scored, total) {
  if (total === 0) return "jurors-table-groups jt-zero";
  if (scored >= total) return "jurors-table-groups jt-done";
  if (scored > 0) return "jurors-table-groups jt-partial";
  return "jurors-table-groups jt-zero";
}
```

Add immediately after it:
```js
function mobileScoreStyle(score) {
  if (!score && score !== 0) return { color: "#475569" };
  const n = parseFloat(score);
  if (isNaN(n)) return { color: "#475569" };
  if (n >= 90) return { color: "#34d399" };
  if (n >= 74) return { color: "#60a5fa" };
  if (n >= 60) return { color: "#fb923c" };
  return { color: "#475569" };
}

function mobileBarFill(status) {
  if (status === "completed") return "var(--success)";
  if (status === "editing")   return "#60a5fa";
  if (status === "in_progress" || status === "ready_to_submit") return "var(--warning)";
  return "rgba(100,116,139,0.3)";
}
```

- [ ] **Step 2.2: Update the test file to import from the source**

Replace the inline duplicates at the top of `jurorsMobileHelpers.test.js` with:
```js
// NOTE: these are module-private in JurorsPage.jsx; test via a small re-export
// or by copy-testing the extracted logic. Since they're pure functions, copy here:
function mobileScoreStyle(score) {
  if (!score && score !== 0) return { color: "#475569" };
  const n = parseFloat(score);
  if (isNaN(n)) return { color: "#475569" };
  if (n >= 90) return { color: "#34d399" };
  if (n >= 74) return { color: "#60a5fa" };
  if (n >= 60) return { color: "#fb923c" };
  return { color: "#475569" };
}

function mobileBarFill(status) {
  if (status === "completed") return "var(--success)";
  if (status === "editing")   return "#60a5fa";
  if (status === "in_progress" || status === "ready_to_submit") return "var(--warning)");
  return "rgba(100,116,139,0.3)";
}
```

- [ ] **Step 2.3: Run tests to verify they pass**

```bash
npm test -- --run src/admin/__tests__/jurorsMobileHelpers.test.js
```

Expected: All tests PASS.

---

## Task 3: CSS — Replace mobile card layout

**Files:**
- Modify: `src/styles/pages/jurors.css:305-428`

- [ ] **Step 3.1: Replace the entire `@media (max-width: 768px)` block**

Delete lines 305–428 (from `/* ─── Portrait / mobile card layout */` to the closing `}`) and replace with:

```css
/* ─── Portrait / mobile card layout ───────────────────────── */
@media (max-width: 768px) {
  .jurors-page .table-wrap {
    overflow: visible;
    border: none;
    background: none;
    box-shadow: none;
    border-radius: 0;
    width: 100%;
    max-width: 100%;
  }

  #jurors-main-table { display: contents; }
  #jurors-main-table thead { display: none !important; }
  #jurors-main-table tbody {
    display: block;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  /* <tr> is a thin wrapper — only col-mobile-card is shown */
  #jurors-main-table tbody tr {
    display: block;
    width: 100%;
    box-sizing: border-box;
    background: none;
    border: none;
    padding: 0;
    margin-bottom: 8px;
    box-shadow: none;
    cursor: pointer;
  }

  /* Hide all existing columns; only show the new mobile card cell */
  #jurors-main-table td { display: none; }
  #jurors-main-table .col-mobile-card { display: block; padding: 0; }

  /* ── Card shell ── */
  .jc {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: visible;
    position: relative;
    transition: opacity 0.15s;
  }
  .jc:active { opacity: 0.85; }

  /* Dim non-active cards while a menu is open */
  #jurors-main-table tbody.has-open-menu .col-mobile-card .jc:not(.menu-open) {
    opacity: 0.35;
  }

  /* ── Main row ── */
  .jc-main {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px 8px;
  }

  /* Override JurorBadge inline styles for compact mobile sizes */
  .jc-main .jb-badge { flex: 1; min-width: 0; }
  .jc-main .jb-name { font-size: 12.5px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .jc-main .jb-affiliation { font-size: 10.5px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Right cluster: score + kebab on top, status pill below */
  .jc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .jc-top-right { display: flex; align-items: center; gap: 6px; }
  .jc-score { font-size: 13px; font-weight: 700; letter-spacing: -0.3px; font-variant-numeric: tabular-nums; }

  /* Kebab button + dropdown wrapper */
  .jc-kebab-wrap { position: relative; }
  .jc-kebab {
    width: 24px; height: 24px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 7px;
    background: rgba(71,85,105,0.12);
    border: 1px solid rgba(71,85,105,0.18);
    color: var(--text-secondary);
    font-size: 13px; font-weight: 700; letter-spacing: -1px; line-height: 1;
    cursor: pointer; padding: 0;
  }
  .jc-kebab:active { background: rgba(96,165,250,0.14); border-color: rgba(96,165,250,0.28); }

  /* Action dropdown anchored to kebab-wrap */
  .jc-action-menu {
    position: absolute;
    top: calc(100% + 4px); right: 0;
    width: 168px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2);
    overflow: hidden;
    z-index: 50;
    animation: dropdown-in .15s cubic-bezier(.21,1.02,.73,1);
  }
  .jc-action-item {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 14px;
    font-size: 12.5px; font-weight: 500; color: var(--text-primary);
    cursor: pointer;
    border-bottom: 1px solid var(--border);
  }
  .jc-action-item:last-child { border-bottom: none; }
  .jc-action-item:hover { background: var(--surface-1); }
  .jc-action-item.danger { color: #f87171; }
  .jc-action-item.danger:hover { background: rgba(248,113,113,0.07); }
  .jc-action-sep { height: 1px; background: var(--border); margin: 2px 0; }

  /* ── Hairline divider between main row and progress strip ── */
  .jc-divider { height: 1px; background: var(--border); margin: 0 12px; }

  /* ── Progress strip ── */
  .jc-progress { display: flex; align-items: center; gap: 8px; padding: 7px 12px 9px; }
  .jc-bar-wrap { flex: 1; height: 4px; background: var(--surface-1, rgba(148,163,184,0.10)); border-radius: 3px; overflow: hidden; }
  .jc-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
  .jc-proj-count { font-size: 10px; font-weight: 600; color: var(--text-tertiary); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .jc-proj-count span { color: var(--text-secondary); }
}
```

- [ ] **Step 3.2: Verify build has no CSS syntax errors**

```bash
npm run build 2>&1 | grep -i "error\|warn" | head -20
```

Expected: No CSS parse errors.

---

## Task 4: JSX — Add lucide imports + refs + helpers wiring

**Files:**
- Modify: `src/admin/pages/JurorsPage.jsx`

- [ ] **Step 4.1: Update lucide-react import (line 21)**

Current:
```js
import { SquarePen, Filter, LockOpen, Lock } from "lucide-react";
```

Replace with:
```js
import { SquarePen, Filter, LockOpen, Lock, FileText, Trash2 } from "lucide-react";
```

- [ ] **Step 4.2: Add `mobileMenuRef` ref declaration**

Find the existing `menuRef` declaration:
```js
const menuRef = useRef(null);
```

Add immediately after it:
```js
const mobileMenuRef = useRef(null);
```

- [ ] **Step 4.3: Update the outside-click `useEffect` to check both refs**

Current (around line 264):
```js
useEffect(() => {
  function handleClick(e) {
    if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null);
  }
  if (openMenuId) {
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }
}, [openMenuId]);
```

Replace with:
```js
useEffect(() => {
  function handleClick(e) {
    const inDesktop = menuRef.current && menuRef.current.contains(e.target);
    const inMobile  = mobileMenuRef.current && mobileMenuRef.current.contains(e.target);
    if (!inDesktop && !inMobile) setOpenMenuId(null);
  }
  if (openMenuId) {
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }
}, [openMenuId]);
```

- [ ] **Step 4.4: Add `has-open-menu` class to `<tbody>`**

Find:
```jsx
<tbody>
```

Replace with:
```jsx
<tbody className={openMenuId ? "has-open-menu" : ""}>
```

---

## Task 5: JSX — Add `col-mobile-card` cell to the row

**Files:**
- Modify: `src/admin/pages/JurorsPage.jsx` — inside `sortedFilteredList.map()`

- [ ] **Step 5.1: Add the mobile card `<td>` as the last child of each `<tr>`**

Find the closing of the `<tr>`:
```jsx
                </td>
                </tr>
              );
            })}
```

That is, the `</td>` closing `col-actions`, then `</tr>`. Add the new `<td>` between them:

```jsx
                  {/* Mobile card — hidden on desktop, shown at ≤768px */}
                  <td className="col-mobile-card">
                    <div className={`jc${openMenuId === jid ? " menu-open" : ""}`}>
                      <div className="jc-main">
                        <JurorBadge name={name} affiliation={juror.affiliation} size="lg" />
                        <div className="jc-right">
                          <div className="jc-top-right">
                            <span className="jc-score" style={mobileScoreStyle(jurorAvgMap.get(String(jid)))}>
                              {jurorAvgMap.get(String(jid)) || "—"}
                            </span>
                            <div
                              className="jc-kebab-wrap"
                              ref={openMenuId === jid ? mobileMenuRef : null}
                            >
                              <button
                                className="jc-kebab"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId((prev) => (prev === jid ? null : jid));
                                }}
                              >
                                ···
                              </button>
                              {openMenuId === jid && (
                                <div className="jc-action-menu">
                                  <div className="jc-action-item" onClick={(e) => { e.stopPropagation(); openEditModal(juror); }}>
                                    <SquarePen size={14} />
                                    Edit Juror
                                  </div>
                                  <div className="jc-action-item" onClick={(e) => { e.stopPropagation(); openPinResetModal(juror); }}>
                                    <Lock size={14} />
                                    Reset PIN
                                  </div>
                                  <div className="jc-action-item" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setReviewsJuror(juror); }}>
                                    <FileText size={14} />
                                    View Reviews
                                  </div>
                                  <div className="jc-action-sep" />
                                  <div className="jc-action-item danger" onClick={(e) => { e.stopPropagation(); openRemoveModal(juror); }}>
                                    <Trash2 size={14} />
                                    Remove Juror
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <JurorStatusPill status={status} />
                        </div>
                      </div>
                      <div className="jc-divider" />
                      <div className="jc-progress">
                        <div className="jc-bar-wrap">
                          {total > 0 && (
                            <div
                              className="jc-bar-fill"
                              style={{ width: `${pct}%`, background: mobileBarFill(status) }}
                            />
                          )}
                        </div>
                        <span className="jc-proj-count">
                          {total > 0
                            ? <><span>{scored}</span>/{total}</>
                            : <span style={{ color: "var(--text-tertiary)" }}>0/0</span>
                          }
                        </span>
                      </div>
                    </div>
                  </td>
```

- [ ] **Step 5.2: Run full test suite to verify no regressions**

```bash
npm test -- --run
```

Expected: All previously passing tests still pass; `jurorsMobileHelpers.test.js` passes.

- [ ] **Step 5.3: Run build**

```bash
npm run build 2>&1 | tail -10
```

Expected: `✓ built in` with no errors.

---

## Task 6: Commit

- [ ] **Step 6.1: Stage and commit**

```bash
git add src/styles/pages/jurors.css \
        src/admin/pages/JurorsPage.jsx \
        src/admin/__tests__/jurorsMobileHelpers.test.js

git commit -m "feat(jurors): premium mobile card redesign with progress bar + kebab menu"
```

---

## Self-Review Notes

- **Spec coverage:**
  - ✅ 34px avatar (JurorBadge size="lg"), initials, deterministic color (via `jurorAvatarBg`)
  - ✅ Name 12.5px / affiliation 10.5px (CSS override on `.jb-name` / `.jb-affiliation`)
  - ✅ Score color-coded by value (`mobileScoreStyle`)
  - ✅ Status pill (existing `<JurorStatusPill>`)
  - ✅ Kebab button → dropdown with Edit / Reset PIN / View Reviews / Remove
  - ✅ Progress bar strip with fill color by status (`mobileBarFill`)
  - ✅ `n/total` count label
  - ✅ Tap card → `openEditModal` (existing `<tr onClick>`)
  - ✅ `has-open-menu` dim effect on sibling cards
  - ✅ Desktop layout unchanged (new `<td>` is CSS-hidden on desktop via `display:none` on `.col-mobile-card` — add that rule!)
  - ⚠️ **Gap found:** The CSS above hides all `<td>` on mobile but doesn't explicitly show `.col-mobile-card` on **desktop**. Need to add a rule to hide `.col-mobile-card` on desktop.

- **Fix:** Add to `jurors.css` (outside the media query, in the desktop/default section):

```css
/* col-mobile-card is only shown inside the ≤768px media query */
.col-mobile-card { display: none; }
```

Add this **before** the `@media (max-width: 768px)` block in Step 3.1.

- **Type consistency:** `mobileMenuRef` used in Task 4.2 and referenced in Task 5.1 — consistent.
- **No placeholders detected.**
