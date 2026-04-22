# Floating UI Layering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all floating panel layering issues in VERA by introducing a centralized z-index CSS variable scale and porting every DOM-bound dropdown/popover/menu to `document.body` via React portals and a shared `useFloating` hook.

**Architecture:** A new `useFloating` hook encapsulates position calculation (`getBoundingClientRect` → `position: fixed`), outside-click/escape/scroll/resize listeners, and viewport collision flipping. Each floating component renders its panel through `createPortal(panel, document.body)` and spreads `floatingStyle` from the hook. All z-index values are replaced with `--z-*` CSS custom properties defined once in `variables.css`.

**Tech Stack:** React 18 (useRef, useLayoutEffect, useEffect, useState), ReactDOM.createPortal, CSS custom properties.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/styles/variables.css` | Modify | Add `--z-*` custom property scale |
| `src/styles/layout.css` | Modify | Replace hardcoded z-index → `var(--z-*)` |
| `src/styles/components.css` | Modify | Replace hardcoded z-index → `var(--z-*)`; `.filter-dropdown-menu` → `position: fixed` |
| `src/styles/modals.css` | Modify | Replace hardcoded z-index → `var(--z-*)` |
| `src/styles/drawers.css` | Modify | Replace hardcoded z-index → `var(--z-*)` |
| `src/styles/auth.css` | Modify | Replace hardcoded z-index → `var(--z-*)` |
| `src/styles/charts.css` | Modify | Replace hardcoded z-index → `var(--z-*)` |
| `src/shared/hooks/useFloating.js` | **Create** | Shared positioning hook for all floating panels |
| `src/shared/ui/CustomSelect.jsx` | Modify | Portal + useFloating migration |
| `src/shared/ui/GroupedCombobox.jsx` | Modify | Portal + useFloating migration |
| `src/auth/components/TenantSearchDropdown.jsx` | Modify | Portal + useFloating migration |
| `src/admin/layout/AdminHeader.jsx` | Modify | Period selector dropdown → portal + useFloating |
| `src/admin/components/UserAvatarMenu.jsx` | Modify | Replace inline positioning with useFloating |
| `src/shared/ui/FloatingMenu.jsx` | **Create** | Reusable action menu component using useFloating |
| `src/admin/pages/JurorsPage.jsx` | Modify | Action menu → FloatingMenu |
| `src/admin/pages/ProjectsPage.jsx` | Modify | Action menu → FloatingMenu (if pattern found) |

---

### Task 1: Z-Index CSS Custom Property Scale

**Files:**
- Modify: `src/styles/variables.css`
- Modify: `src/styles/layout.css`
- Modify: `src/styles/components.css`
- Modify: `src/styles/modals.css`
- Modify: `src/styles/drawers.css`
- Modify: `src/styles/auth.css`
- Modify: `src/styles/charts.css`

- [ ] **Step 1: Add `--z-*` scale to `variables.css`**

Open `src/styles/variables.css`. Find the `:root {` block and append after the last existing variable (before the closing `}`):

```css
/* ── Floating UI Z-Index Scale ── */
--z-base:              1;   /* chart tooltips, base content */
--z-sticky:           50;   /* sidebar, demo banner, sticky headers */
--z-sidebar-menu:     70;   /* sidebar tenant/account popup menus */
--z-dropdown:        200;   /* dropdown, popover, select panel, filter menu */
--z-tooltip:         250;   /* tooltip — always above dropdowns */
--z-modal-overlay:   300;   /* drawer/modal backdrop */
--z-modal:           310;   /* drawer/modal content */
--z-modal-dropdown:  350;   /* dropdown opened inside a modal/drawer */
--z-toast:           400;   /* toast notifications, critical alerts */
```

- [ ] **Step 2: Update `src/styles/layout.css`**

Replace these hardcoded z-index values (use your editor's search):

| Selector | Old value | New value |
|----------|-----------|-----------|
| `.sidebar` (desktop) | `z-index: 50` | `z-index: var(--z-sticky)` |
| `.demo-banner` | `z-index: 50` | `z-index: var(--z-sticky)` |
| `.sb-tenant-menu` | `z-index: 60` | `z-index: var(--z-sidebar-menu)` |
| `.sb-account-menu` | `z-index: 70` | `z-index: var(--z-sidebar-menu)` |
| `.dropdown-menu` (header period selector) | `z-index: 100` | `z-index: var(--z-dropdown)` |
| `.mobile-overlay` | `z-index: 149` | `z-index: var(--z-sticky)` |
| `.sidebar` (mobile `@media`) | `z-index: 200` | `z-index: var(--z-dropdown)` |
| `.outcome-popover` analytics | `z-index: 280` or `z-420 !important` | `z-index: var(--z-dropdown)` |

Also remove any `!important` on z-index lines in this file — the portal + fixed approach makes them unnecessary.

- [ ] **Step 3: Update `src/styles/components.css`**

| Selector | Old value | New value |
|----------|-----------|-----------|
| `.filter-dropdown-menu` | `z-index: 120` | `z-index: var(--z-dropdown)` |
| `.filter-dropdown-menu` | `position: absolute` | `position: fixed` |
| `.custom-select-menu` | `z-index: 320` | `z-index: var(--z-modal-dropdown)` |
| `.ph-avatar-menu` | `z-index: 9999` | `z-index: var(--z-dropdown)` |
| `.modal-overlay` (if present) | `z-index: 300` | `z-index: var(--z-modal-overlay)` |
| `.toast-container` | `z-index: 400` | `z-index: var(--z-toast)` (already 400, update to var) |
| `.col-info-popover` | `z-index: 200` | `z-index: var(--z-dropdown)` |

- [ ] **Step 4: Update `src/styles/modals.css`**

| Selector | Old value | New value |
|----------|-----------|-----------|
| `.fs-modal-wrap` | `z-index: 301` | `z-index: var(--z-modal)` |
| `.compare-select-menu` | `z-index: 320` | `z-index: var(--z-modal-dropdown)` |

- [ ] **Step 5: Update `src/styles/drawers.css`**

| Selector | Old value | New value |
|----------|-----------|-----------|
| `.fs-overlay` | `z-index: 300` | `z-index: var(--z-modal-overlay)` |
| `.fs-drawer` | `z-index: 301` | `z-index: var(--z-modal)` |
| `.fs-modal-wrap` (duplicate) | `z-index: 301` | `z-index: var(--z-modal)` |
| `.crud-overlay` | `z-index: 200` | `z-index: var(--z-dropdown)` |
| `.crud-drawer` | `z-index: 201` | `z-index: var(--z-modal)` |
| `.confirm-modal` | `z-index: 202` | `z-index: var(--z-modal)` |

- [ ] **Step 6: Update `src/styles/auth.css`**

| Selector | Old value | New value |
|----------|-----------|-----------|
| `.grouped-cb-dropdown` | `z-index: 50` | `z-index: var(--z-dropdown)` |

- [ ] **Step 7: Update `src/styles/charts.css`**

| Selector | Old value | New value |
|----------|-----------|-----------|
| `.recharts-tooltip-wrapper` | `z-index: 10` | `z-index: var(--z-base)` |

- [ ] **Step 8: Verify no hardcoded z-index remains**

```bash
grep -rn "z-index:[[:space:]]*[0-9]" src/styles/ --include="*.css"
```

Expected: zero results (all values should now be `var(--z-*)`).

- [ ] **Step 9: Start dev server and verify no visual regressions**

```bash
npm run dev
```

Open the app. Check: sidebar visible, demo banner visible, modals/drawers open correctly, toast appears on top. No elements mysteriously hidden behind others.

- [ ] **Step 10: Commit**

```bash
git add src/styles/variables.css src/styles/layout.css src/styles/components.css src/styles/modals.css src/styles/drawers.css src/styles/auth.css src/styles/charts.css
git commit -m "refactor(styles): centralize z-index as CSS custom property scale"
```

---

### Task 2: Create `useFloating` Hook

**Files:**
- Create: `src/shared/hooks/useFloating.js`

- [ ] **Step 1: Create the file**

Create `src/shared/hooks/useFloating.js` with the following content:

```js
import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';

/**
 * useFloating — shared positioning hook for all floating panels in VERA.
 *
 * @param {object} options
 * @param {React.RefObject} options.triggerRef   - ref attached to the element that opens the panel
 * @param {boolean}         options.isOpen       - controlled open state
 * @param {function}        options.onClose      - called when the panel should close
 * @param {'bottom-start'|'bottom-end'|'top-start'|'top-end'} [options.placement='bottom-start']
 * @param {number}          [options.offset=4]   - gap between trigger and panel in px
 * @param {boolean}         [options.closeOnScroll=true]
 *
 * @returns {{ floatingRef: React.RefObject, floatingStyle: object, updatePosition: function }}
 */
export function useFloating({
  triggerRef,
  isOpen,
  onClose,
  placement = 'bottom-start',
  offset = 4,
  closeOnScroll = true,
}) {
  const floatingRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: placement });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !floatingRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const panel = floatingRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Determine vertical side
    let vertical = placement.startsWith('top') ? 'top' : 'bottom';
    // Flip if insufficient space
    if (vertical === 'bottom' && trigger.bottom + offset + panel.height > vh) {
      vertical = 'top';
    } else if (vertical === 'top' && trigger.top - offset - panel.height < 0) {
      vertical = 'bottom';
    }

    // Determine horizontal alignment
    let horizontal = placement.endsWith('end') ? 'end' : 'start';
    // Flip if overflows right
    if (horizontal === 'start' && trigger.left + panel.width > vw) {
      horizontal = 'end';
    } else if (horizontal === 'end' && trigger.right - panel.width < 0) {
      horizontal = 'start';
    }

    const top =
      vertical === 'bottom'
        ? trigger.bottom + offset
        : trigger.top - panel.height - offset;

    const left =
      horizontal === 'start'
        ? trigger.left
        : trigger.right - panel.width;

    setCoords({ top, left, placement: `${vertical}-${horizontal}` });
  }, [triggerRef, placement, offset]);

  // Position synchronously before paint when opening
  useLayoutEffect(() => {
    if (isOpen) {
      // First render: panel has no size yet; run once in next frame for accurate rect
      requestAnimationFrame(updatePosition);
    }
  }, [isOpen, updatePosition]);

  // Resize listener
  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => updatePosition();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen, updatePosition]);

  // Scroll close
  useEffect(() => {
    if (!isOpen || !closeOnScroll) return;
    const onScroll = () => onClose();
    window.addEventListener('scroll', onScroll, true); // capture = catches all scroll events
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [isOpen, closeOnScroll, onClose]);

  // Outside click
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e) => {
      if (
        floatingRef.current && !floatingRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen, onClose, triggerRef]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const floatingStyle = {
    position: 'fixed',
    top: coords.top,
    left: coords.left,
    zIndex: 'var(--z-dropdown)',
  };

  return { floatingRef, floatingStyle, updatePosition, actualPlacement: coords.placement };
}
```

- [ ] **Step 2: Verify the file was created**

```bash
cat src/shared/hooks/useFloating.js | head -5
```

Expected: first 5 lines of the file.

- [ ] **Step 3: Commit**

```bash
git add src/shared/hooks/useFloating.js
git commit -m "feat(hooks): add useFloating shared positioning hook"
```

---

### Task 3: Migrate `CustomSelect.jsx`

**Files:**
- Modify: `src/shared/ui/CustomSelect.jsx`

Current state: `position: absolute` `.filter-dropdown-menu` inside a `position: relative` wrapper. Has its own outside-click + escape `useEffect`.

- [ ] **Step 1: Read the current file**

```bash
cat -n src/shared/ui/CustomSelect.jsx
```

Understand: where `rootRef` is attached, where `open` state is toggled, where `.filter-dropdown-menu` div is rendered.

- [ ] **Step 2: Apply migration**

Replace the entire file with the portaled version. Key changes:
1. Import `createPortal` from `react-dom` and `useFloating` from the hook
2. Rename `rootRef` → `triggerRef`, attach to the trigger button
3. Call `useFloating({ triggerRef, isOpen: open, onClose: () => setOpen(false) })`
4. Remove the manual `useEffect` blocks for outside-click and escape (hook handles them)
5. Wrap `.filter-dropdown-menu` with `createPortal(..., document.body)` and spread `floatingStyle`
6. Remove `position: relative` from wrapper (no longer needed)

The complete updated file:

```jsx
import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useFloating } from '../hooks/useFloating';

export default function CustomSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  menuClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);

  const handleClose = useCallback(() => setOpen(false), []);

  const { floatingRef, floatingStyle } = useFloating({
    triggerRef,
    isOpen: open,
    onClose: handleClose,
    placement: 'bottom-start',
    offset: 4,
  });

  const selected = options.find((o) => o.value === value);

  const handleSelect = (opt) => {
    onChange(opt.value);
    setOpen(false);
  };

  return (
    <div className={`custom-select-wrapper ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`custom-select-trigger ${open ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="custom-select-value">
          {selected ? selected.label : <span className="custom-select-placeholder">{placeholder}</span>}
        </span>
        <ChevronDown size={14} className={`custom-select-chevron ${open ? 'rotated' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={floatingRef}
          className={`filter-dropdown-menu custom-select-menu ${menuClassName}`}
          style={floatingStyle}
          role="listbox"
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`filter-dropdown-item ${opt.value === value ? 'selected' : ''}`}
              role="option"
              aria-selected={opt.value === value}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur before click registers
                handleSelect(opt);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
```

> Note: If the existing CustomSelect has additional props (grouping, search, icons, render functions), preserve them exactly — only change the portal/hook wiring and remove the manual listener useEffects.

- [ ] **Step 3: Test in dev**

Open `npm run dev`. Find a page with a CustomSelect (e.g. Admin Overview filters). Click the trigger — panel should open above sibling cards without being clipped. Scroll the page — panel should close. Press Escape — panel should close. Click outside — panel should close.

- [ ] **Step 4: Commit**

```bash
git add src/shared/ui/CustomSelect.jsx
git commit -m "feat(ui): migrate CustomSelect to portal + useFloating"
```

---

### Task 4: Migrate `GroupedCombobox.jsx`

**Files:**
- Modify: `src/shared/ui/GroupedCombobox.jsx`

Current state: `wrapRef` for outside-click + keyboard scroll-into-view, `.grouped-cb-dropdown` is an absolute-positioned div inside the wrapper.

- [ ] **Step 1: Read the current file**

```bash
cat -n src/shared/ui/GroupedCombobox.jsx
```

Note: where `wrapRef` and `listRef` are used, where the dropdown div is rendered, any existing outside-click `useEffect`.

- [ ] **Step 2: Apply migration**

Key changes:
1. Add `import { createPortal } from 'react-dom'`
2. Add `import { useFloating } from '../hooks/useFloating'`
3. Add `triggerRef` ref (attach to the input wrapper / trigger button — the same element that `wrapRef` was on, or the input element itself)
4. Keep `listRef` for keyboard scroll-into-view (this is a different concern from floating ref)
5. Call `useFloating({ triggerRef, isOpen: isDropdownOpen, onClose: closeDropdown, placement: 'bottom-start' })`
6. Assign `floatingRef` from the hook to the `.grouped-cb-dropdown` div
7. Wrap `.grouped-cb-dropdown` in `createPortal(..., document.body)` + spread `floatingStyle`
8. Remove manual outside-click `useEffect` (hook handles it)

Pattern (partial — adapt to actual file structure):

```jsx
import { useFloating } from '../hooks/useFloating';
import { createPortal } from 'react-dom';

// inside component:
const triggerRef = useRef(null);
const { floatingRef, floatingStyle } = useFloating({
  triggerRef,
  isOpen: open,   // whatever the open state var is named
  onClose: () => setOpen(false),
  placement: 'bottom-start',
  offset: 4,
});

// dropdown render (replace existing absolute div):
{open && createPortal(
  <div
    ref={floatingRef}
    className="grouped-cb-dropdown"
    style={floatingStyle}
  >
    {/* existing dropdown content unchanged */}
  </div>,
  document.body
)}
```

Attach `triggerRef` to the input wrapper element (the element `wrapRef` was on, or the input itself):

```jsx
<div ref={triggerRef} className="grouped-cb-wrap">
  {/* existing input */}
</div>
```

- [ ] **Step 3: Test keyboard navigation**

In dev, open a GroupedCombobox. Type to filter. Use arrow keys to navigate — items should scroll into view inside the portaled panel. Enter should select. Escape should close.

- [ ] **Step 4: Commit**

```bash
git add src/shared/ui/GroupedCombobox.jsx
git commit -m "feat(ui): migrate GroupedCombobox to portal + useFloating"
```

---

### Task 5: Migrate `TenantSearchDropdown.jsx`

**Files:**
- Modify: `src/auth/components/TenantSearchDropdown.jsx`

Current state: `wrapRef` for outside-click, renders `.tenant-dropdown-popover` conditionally inside wrapper div.

- [ ] **Step 1: Read the current file**

```bash
cat -n src/auth/components/TenantSearchDropdown.jsx
```

Note: the trigger element (button or input), the open state variable, where `.tenant-dropdown-popover` is rendered.

- [ ] **Step 2: Apply migration**

```jsx
import { useFloating } from '../hooks/useFloating';  // adjust relative path
import { createPortal } from 'react-dom';

// inside component:
const triggerRef = useRef(null);
const { floatingRef, floatingStyle } = useFloating({
  triggerRef,
  isOpen: open,        // the state that controls visibility
  onClose: () => setOpen(false),
  placement: 'bottom-start',
  offset: 4,
});

// Attach triggerRef to the input or button that opens the dropdown.
// Remove the old wrapRef and its outside-click useEffect.

// Portaled dropdown:
{open && createPortal(
  <div
    ref={floatingRef}
    className="tenant-dropdown-popover"
    style={floatingStyle}
  >
    {/* existing content unchanged */}
  </div>,
  document.body
)}
```

- [ ] **Step 3: Test in dev**

Go to the login/register page or wherever this component appears. Open the dropdown — it should appear correctly positioned. Outside-click and Escape should close it.

- [ ] **Step 4: Commit**

```bash
git add src/auth/components/TenantSearchDropdown.jsx
git commit -m "feat(auth): migrate TenantSearchDropdown to portal + useFloating"
```

---

### Task 6: Migrate `AdminHeader.jsx` Period Selector

**Files:**
- Modify: `src/admin/layout/AdminHeader.jsx`

Current state: `.dropdown` wrapper div with `dropdownRef` and `isOpen` state, `.dropdown-menu` rendered inside with `z-index: 100` in CSS (now `var(--z-dropdown)` after Task 1).

- [ ] **Step 1: Read the relevant section**

```bash
sed -n '80,160p' src/admin/layout/AdminHeader.jsx
```

Note: the trigger button, the open state, where `.dropdown-menu` is rendered, any existing outside-click useEffect.

- [ ] **Step 2: Apply migration**

```jsx
import { useFloating } from '../../shared/hooks/useFloating';
import { createPortal } from 'react-dom';

// inside the component that renders the period selector:
const periodTriggerRef = useRef(null);
const { floatingRef: periodFloatingRef, floatingStyle: periodFloatingStyle } = useFloating({
  triggerRef: periodTriggerRef,
  isOpen: dropdownOpen,    // existing open state
  onClose: () => setDropdownOpen(false),
  placement: 'bottom-end',  // period selector is typically right-aligned
  offset: 4,
});

// Trigger button:
<button ref={periodTriggerRef} onClick={() => setDropdownOpen(prev => !prev)} ...>
  {/* existing content */}
</button>

// Portaled menu:
{dropdownOpen && createPortal(
  <div
    ref={periodFloatingRef}
    className="dropdown-menu"
    style={periodFloatingStyle}
  >
    {/* existing items unchanged */}
  </div>,
  document.body
)}
```

Remove the old manual `useEffect` for outside-click/escape if present.

- [ ] **Step 3: Test in dev**

Open the admin panel header period selector. It should open above the header's stacking context. Escape and outside-click should close it.

- [ ] **Step 4: Commit**

```bash
git add src/admin/layout/AdminHeader.jsx
git commit -m "feat(admin): migrate header period selector to portal + useFloating"
```

---

### Task 7: Refactor `UserAvatarMenu.jsx` to Use `useFloating`

**Files:**
- Modify: `src/admin/components/UserAvatarMenu.jsx`

Current state: already uses `createPortal` + `useLayoutEffect` for positioning, but has its own positioning logic (not using the shared hook). This task removes the duplication.

- [ ] **Step 1: Read the file**

```bash
cat -n src/admin/components/UserAvatarMenu.jsx
```

Identify: the `useLayoutEffect` that sets `top/left`, the `useEffect` for outside-click, the `useEffect` for escape.

- [ ] **Step 2: Apply migration**

Replace the bespoke positioning logic with `useFloating`. The portal call stays, but now uses `floatingStyle` from the hook.

Before (existing pattern, approximately):
```jsx
const menuRef = useRef(null);
const triggerRef = useRef(null);
const [pos, setPos] = useState({ top: 0, left: 0 });

useLayoutEffect(() => {
  if (open && triggerRef.current) {
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.right - MENU_WIDTH });
  }
}, [open]);

useEffect(() => { /* outside click */ }, [open]);
useEffect(() => { /* escape */ }, [open]);
```

After:
```jsx
import { useFloating } from '../../shared/hooks/useFloating';

const triggerRef = useRef(null);
const { floatingRef, floatingStyle } = useFloating({
  triggerRef,
  isOpen: open,
  onClose: () => setOpen(false),
  placement: 'bottom-end',
  offset: 4,
});

// Remove the three useEffect/useLayoutEffect blocks above.

// In JSX — portal stays, but use floatingRef and floatingStyle:
{open && createPortal(
  <div ref={floatingRef} className="ph-avatar-menu" style={floatingStyle}>
    {/* existing menu content unchanged */}
  </div>,
  document.body
)}
```

- [ ] **Step 3: Test in dev**

Click the avatar in the admin header. Menu should appear bottom-right of the avatar. Outside-click and Escape close it.

- [ ] **Step 4: Commit**

```bash
git add src/admin/components/UserAvatarMenu.jsx
git commit -m "refactor(admin): replace bespoke UserAvatarMenu positioning with useFloating"
```

---

### Task 8: Create `FloatingMenu` Component and Migrate Action Menus

**Files:**
- Create: `src/shared/ui/FloatingMenu.jsx`
- Modify: `src/admin/pages/JurorsPage.jsx`
- Modify: any other page with inline action menus (ProjectsPage, PeriodsPage — check during step)

- [ ] **Step 1: Find all inline action menus**

```bash
grep -rn "juror-action-menu\|action-menu\|row-menu\|openMenuId\|actionMenuId" src/admin/ --include="*.jsx" -l
```

Note which files contain inline action menus that need migration.

- [ ] **Step 2: Create `FloatingMenu.jsx`**

Create `src/shared/ui/FloatingMenu.jsx`:

```jsx
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFloating } from '../hooks/useFloating';

/**
 * FloatingMenu — reusable action menu for table rows and cards.
 *
 * Props:
 *   trigger: ReactNode — the button that opens the menu (e.g. MoreVertical icon button)
 *   isOpen: boolean
 *   onClose: () => void
 *   children: ReactNode — menu items
 *   placement: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' — default 'bottom-end'
 *   menuClassName: string
 */
export default function FloatingMenu({
  trigger,
  isOpen,
  onClose,
  children,
  placement = 'bottom-end',
  menuClassName = '',
}) {
  const triggerRef = useRef(null);
  const { floatingRef, floatingStyle } = useFloating({
    triggerRef,
    isOpen,
    onClose,
    placement,
    offset: 4,
  });

  return (
    <>
      <span ref={triggerRef}>{trigger}</span>
      {isOpen && createPortal(
        <div
          ref={floatingRef}
          className={`floating-menu ${menuClassName}`}
          style={floatingStyle}
        >
          {children}
        </div>,
        document.body
      )}
    </>
  );
}
```

- [ ] **Step 3: Add `.floating-menu` CSS to `components.css`**

In `src/styles/components.css`, find the `.filter-dropdown-menu` block and add after it:

```css
/* ── Floating Action Menu ── */
.floating-menu {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  padding: 4px 0;
  min-width: 160px;
  overflow: hidden;
}

.floating-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 13px;
  color: var(--text-primary, #111827);
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.floating-menu-item:hover {
  background: var(--bg-hover, #f3f4f6);
}

.floating-menu-item.danger {
  color: var(--color-danger, #ef4444);
}

.floating-menu-item.danger:hover {
  background: var(--color-danger-bg, #fef2f2);
}

.floating-menu-divider {
  height: 1px;
  background: var(--border-color, #e5e7eb);
  margin: 4px 0;
}
```

- [ ] **Step 4: Migrate `JurorsPage.jsx` action menu**

Read the action menu section:

```bash
sed -n '800,870p' src/admin/pages/JurorsPage.jsx
```

Replace the inline action menu render with `FloatingMenu`. The existing `openMenuId` state and toggle button are kept — only the rendering changes.

Before (pattern currently in the file):
```jsx
<div style={{ position: 'relative' }}>
  <button onClick={() => setOpenMenuId(openMenuId === jid ? null : jid)}>
    {/* icon */}
  </button>
  {openMenuId === jid && (
    <div className="juror-action-menu open">
      <button onClick={...}>Edit</button>
      <button onClick={...}>Reset PIN</button>
      <button onClick={...}>Delete</button>
    </div>
  )}
</div>
```

After:
```jsx
import FloatingMenu from '../../shared/ui/FloatingMenu';

<FloatingMenu
  isOpen={openMenuId === jid}
  onClose={() => setOpenMenuId(null)}
  trigger={
    <button
      className="icon-btn"
      onClick={() => setOpenMenuId(openMenuId === jid ? null : jid)}
      aria-label="Actions"
    >
      <MoreVertical size={15} />
    </button>
  }
>
  <div className="floating-menu-item" onMouseDown={() => { setOpenMenuId(null); handleEdit(juror); }}>
    <Pencil size={13} /> Edit
  </div>
  <div className="floating-menu-item" onMouseDown={() => { setOpenMenuId(null); handleResetPin(juror); }}>
    <KeyRound size={13} /> Reset PIN
  </div>
  <div className="floating-menu-divider" />
  <div className="floating-menu-item danger" onMouseDown={() => { setOpenMenuId(null); handleDelete(juror); }}>
    <Trash2 size={13} /> Delete
  </div>
</FloatingMenu>
```

> Adapt action names and handlers to match the actual file. Replace any raw SVG `<svg>` elements with Lucide components (`MoreVertical`, `Pencil`, `KeyRound`, `Trash2` from `lucide-react`).

- [ ] **Step 5: Migrate other action menus found in Step 1**

For each file found, apply the same `FloatingMenu` pattern. Keep existing handlers exactly as-is — only change the rendering layer.

- [ ] **Step 6: Test in dev**

Navigate to the Jurors admin page. Click the action button on any row — the menu should appear above all card content, not clipped. Click an action — it should trigger and menu should close. Click outside — menu should close.

- [ ] **Step 7: Commit**

```bash
git add src/shared/ui/FloatingMenu.jsx src/styles/components.css src/admin/pages/JurorsPage.jsx
# add any other modified page files
git commit -m "feat(ui): add FloatingMenu component, migrate admin action menus to portal"
```

---

### Task 9: Final Verification

**Files:** None created/modified — this is a verification pass.

- [ ] **Step 1: Grep for remaining hardcoded z-index in JS/JSX**

```bash
grep -rn "zIndex.*[0-9]\|z-index.*[0-9]" src/ --include="*.jsx" --include="*.js" --include="*.tsx" --include="*.ts"
```

Expected: zero results (or only inside `useFloating.js` where `'var(--z-dropdown)'` is the string value — that is acceptable).

- [ ] **Step 2: Grep for remaining hardcoded z-index in CSS**

```bash
grep -rn "z-index:[[:space:]]*[0-9]" src/styles/ --include="*.css"
```

Expected: zero results.

- [ ] **Step 3: Grep for remaining `position: absolute` in dropdown CSS**

```bash
grep -rn "filter-dropdown-menu\|grouped-cb-dropdown\|tenant-dropdown-popover" src/styles/ --include="*.css"
```

Verify these no longer use `position: absolute` (should be `position: fixed` or removed entirely since portaled elements use inline `style`).

- [ ] **Step 4: Manual test checklist**

With `npm run dev` running:

1. Admin overview → click any CustomSelect filter → panel appears above neighboring cards, not clipped
2. Open a Drawer → click a CustomSelect inside it → panel appears above the drawer overlay
3. Scroll the page while a dropdown is open → dropdown closes
4. Open a dropdown near the viewport bottom → panel flips upward
5. Open a dropdown near the viewport right edge → panel flips leftward
6. Mobile portrait: open a filter menu → panel appears without being clipped
7. Press Escape with any dropdown open → it closes
8. Trigger a toast notification with a dropdown open → toast appears above dropdown
9. Sidebar tenant/account menus → still appear correctly
10. Dark mode → all dropdowns maintain correct dark styling

- [ ] **Step 5: Run unit tests**

```bash
npm test -- --run
```

Expected: all tests pass (no component structural changes that would break snapshots).

- [ ] **Step 6: Run build**

```bash
npm run build
```

Expected: zero errors.

---

## Acceptance Criteria Checklist

- [ ] Dropdown panels never appear behind neighboring cards
- [ ] Parent `overflow:hidden` does not clip any floating panel
- [ ] Drawer/modal-internal dropdowns open above the modal overlay (z-index 350 > 310)
- [ ] Panels flip direction when near viewport edges
- [ ] Works on desktop and mobile portrait/landscape
- [ ] Dark mode visual language intact
- [ ] Modal/drawer/toast layer order preserved
- [ ] Zero hardcoded `z-index` numbers remain in any CSS or JS file
