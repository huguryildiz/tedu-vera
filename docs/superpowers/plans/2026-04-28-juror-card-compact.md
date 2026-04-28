# Juror Card Compact Mobile Portrait Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the juror mobile portrait card height ~40% (from ~148px to ~88px) by collapsing the three-section card (header + progress-block + footer) into a two-row layout.

**Architecture:** Two files change — `JurorsTable.jsx` (JSX restructure of the mobile card section only) and `JurorsPage.css` (replace old portrait card CSS with new two-row rules). All other code, components, and data flow are untouched.

**Tech Stack:** React JSX, CSS (scoped to `@media (max-width: 768px) and (orientation: portrait)`)

---

## File Map

| File | What changes |
|---|---|
| `src/admin/features/jurors/components/JurorsTable.jsx` | Replace `.jc-header` + `.jc-prog-block` + `.jc-footer` with `.jc-row1` + `.jc-row2`; remove unused `Clock` import |
| `src/admin/features/jurors/JurorsPage.css` | Delete old portrait card CSS classes (lines ~364–479); insert new two-row CSS in the same block |

---

### Task 1: Verify no test selectors break

**Files:**
- Read-only check (no files modified)

- [ ] **Step 1: Grep for old class names in tests**

```bash
grep -rn "jc-footer\|jc-prog-block\|jc-header\|jc-meta-pill\|jc-prog-bar\|jc-prog-fill" \
  src/admin/__tests__/ e2e/ 2>/dev/null
```

Expected: no output. If any matches appear, note the file paths — they'll need updating in Task 2.

---

### Task 2: Restructure mobile card JSX in JurorsTable.jsx

**Files:**
- Modify: `src/admin/features/jurors/components/JurorsTable.jsx:1-18` (imports)
- Modify: `src/admin/features/jurors/components/JurorsTable.jsx:184-249` (mobile card JSX)

- [ ] **Step 1: Remove the unused `Clock` import**

In the `lucide-react` import block at line 1, remove `Clock,` — it was only used in the removed `.jc-footer`.

Before:
```jsx
import {
  SquarePen,
  RotateCcw,
  Lock,
  KeyRound,
  ClipboardList,
  Trash2,
  Clock,
  MoreVertical,
  Pencil,
  Users,
  Upload,
  Search,
  Plus,
  Info,
  XCircle,
  Bell,
} from "lucide-react";
```

After:
```jsx
import {
  SquarePen,
  RotateCcw,
  Lock,
  KeyRound,
  ClipboardList,
  Trash2,
  MoreVertical,
  Pencil,
  Users,
  Upload,
  Search,
  Plus,
  Info,
  XCircle,
  Bell,
} from "lucide-react";
```

- [ ] **Step 2: Replace the mobile card JSX (lines 184–249)**

Replace the entire `{/* Mobile card … */}` `<td className="col-mobile-card">` block:

```jsx
      {/* Mobile card — hidden on desktop, shown at ≤768px portrait */}
      <td className="col-mobile-card">
        <div className="jc">
          <div className="jc-row1">
            <div
              className="jc-avatar"
              style={{ background: jurorAvatarBg(name), color: jurorAvatarFg(name) }}
            >
              {jurorInitials(name)}
            </div>
            <div className="jc-meta">
              <div className="jc-name-row">
                <span className="jc-name">{name}</span>
                <JurorStatusPill status={status} />
              </div>
              {juror.affiliation && (
                <span className="jc-org">{juror.affiliation}</span>
              )}
            </div>
            <FloatingMenu
              isOpen={openMenuId === jid && shouldUseCardLayout}
              onClose={() => setOpenMenuId(null)}
              placement="bottom-end"
              trigger={
                <button
                  className="row-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId((prev) => (prev === jid ? null : jid));
                  }}
                >
                  <MoreVertical size={18} strokeWidth={2} />
                </button>
              }
            >
              {menuItems(true)}
            </FloatingMenu>
          </div>

          <div className="jc-row2">
            <div className="jc-bar">
              {total > 0 && (
                <div
                  className={`jc-bar-fill${scored >= total ? " fill-complete" : " fill-partial"}`}
                  style={{ width: `${Math.min(100, Math.round((scored / total) * 100))}%` }}
                />
              )}
            </div>
            <span className={`jc-frac${total === 0 ? " frac-none" : scored >= total ? " frac-done" : " frac-partial"}`}>
              {scored}/{total}
            </span>
            <span className="jc-last">{lastActive ? formatRelative(lastActive) : "—"}</span>
          </div>
        </div>
      </td>
```

- [ ] **Step 3: Run the build to catch any JSX syntax errors**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors. If there are import errors about `Clock`, double-check Step 1 removed it cleanly.

---

### Task 3: Replace portrait card CSS in JurorsPage.css

**Files:**
- Modify: `src/admin/features/jurors/JurorsPage.css:363-479` (old card rules inside the portrait media query)

- [ ] **Step 1: Delete the old card-specific CSS rules**

Inside the `@media (max-width: 768px) and (orientation: portrait)` block, locate and delete the following sections (keep everything else — table-level rules, `.jc` shell, empty-state overrides):

Delete from `/* ── Header ──` through the end of `.jc-footer-pct.val-amber` — i.e., lines ~363–479 in the current file:

```css
  /* ── Header ── */
  .jc-header { … }
  .jc-avatar { … }
  .jc-meta { … }
  .jc-meta-name { … }
  .jc-meta-org { … }
  .jc-meta .jc-meta-pill { … }

  /* ── Progress block ── */
  .jc-prog-block { … }
  .jc-prog-header { … }
  .jc-prog-nums { … }
  .jc-prog-count.val-done { … }
  .jc-prog-count.val-partial { … }
  .jc-prog-count.val-zero { … }
  .jc-prog-bar { … }
  .jc-prog-fill { … }
  .jc-prog-fill.fill-complete { … }
  .jc-prog-fill.fill-partial { … }

  /* ── Footer ── */
  .jc-footer { … }
  .jc-footer-label { … }
  .jc-footer-time { … }
  .jc-footer-pct { … }
  .jc-footer-pct.val-done { … }
  .jc-footer-pct.val-amber { … }
```

- [ ] **Step 2: Insert new two-row CSS in place of the deleted block**

In the same position (after the `/* Dim non-active cards… */` rule, before `/* ── Empty-state row override ──`), insert:

```css
  /* ── Row 1: avatar + [name + pill] + org + kebab ── */
  .jc-row1 {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 10px 8px;
  }

  .jc-avatar {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: -0.5px;
  }

  .jc-meta {
    flex: 1;
    min-width: 0;
  }

  .jc-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .jc-name {
    font-size: 13px;
    font-weight: 800;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  /* pill sits in .jc-name-row — flex-shrink:0 prevents wrapping */
  .jc-name-row .pill { flex-shrink: 0; }

  .jc-org {
    font-size: 10.5px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }

  /* ── Row 2: progress bar + fraction + last-active ── */
  .jc-row2 {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 10px 8px;
    border-top: 1px solid var(--border);
  }

  .jc-bar {
    flex: 1;
    height: 5px;
    border-radius: 99px;
    background: var(--surface-1);
    overflow: hidden;
  }

  .jc-bar-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.35s ease;
  }
  .jc-bar-fill.fill-complete { background: linear-gradient(90deg, #22c55e, #86efac); }
  .jc-bar-fill.fill-partial  { background: linear-gradient(90deg, #6c63ff, #a78bfa); }

  .jc-frac {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 9.5px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .jc-frac.frac-done    { color: #22c55e; }
  .jc-frac.frac-partial { color: #60a5fa; }
  .jc-frac.frac-none    { color: var(--text-tertiary); }

  .jc-last {
    font-size: 9px;
    color: var(--text-tertiary);
    flex-shrink: 0;
    font-family: var(--font-mono, ui-monospace, monospace);
  }
```

- [ ] **Step 3: Run build to confirm no CSS errors**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean build, no warnings about `jc-*` selectors.

---

### Task 4: Run tests and verify visually

**Files:**
- No changes

- [ ] **Step 1: Run the unit test suite**

```bash
npm test -- --run 2>&1 | tail -20
```

Expected: all tests pass. If any fail referencing old class names, update them to the new names.

- [ ] **Step 2: Check the no-native-select script**

```bash
npm run check:no-native-select 2>&1
```

Expected: passes (we didn't add any `<select>` elements).

- [ ] **Step 3: Open the app and verify on mobile portrait**

With `npm run dev` running, open Chrome DevTools → Device Toolbar → iPhone 14 Pro (390×844) → portrait.

Navigate to `/admin/jurors`. Verify:
- Cards are ~88px tall (visibly much shorter than before)
- All 5 status states show correct pill color and icon when viewing jurors with different states
- Long names truncate with ellipsis when a long pill is present
- Progress bar fills correctly (green for complete, purple for partial, empty bar for 0/N)
- Fraction and last-active timestamp are visible and legible
- Tapping a card selects it (accent border appears)
- Kebab menu opens correctly and all actions work
- Rotate to landscape: the desktop table appears (no portrait cards)

---

### Task 5: Commit

- [ ] **Step 1: Stage the two changed files**

```bash
git add src/admin/features/jurors/components/JurorsTable.jsx \
        src/admin/features/jurors/JurorsPage.css
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(jurors): compact two-row mobile portrait card (~88px, ↓40%)"
```
