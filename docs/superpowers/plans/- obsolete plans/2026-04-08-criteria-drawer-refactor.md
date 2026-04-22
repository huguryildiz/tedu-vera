# Criteria Drawer Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline `<Drawer>` block in `CriteriaPage.jsx` with `EditCriteriaDrawer`, and restructure the footer out of `CriteriaManager` into a proper `fs-drawer-footer` outside `fs-drawer-body`.

**Architecture:** `CriteriaManager` lifts its save-state up via an optional `onSaveState` callback (fired via `useEffect`). `EditCriteriaDrawer` holds that state and renders the `fs-drawer-footer` after `fs-drawer-body`. `CriteriaPage` switches from the inline drawer to `<EditCriteriaDrawer>`.

**Tech Stack:** React 18, `@dnd-kit/core`, Vite, Vitest

---

## File Map

| File | Change |
|---|---|
| `src/admin/criteria/CriteriaManager.jsx` | Remove footer block; add `onSaveState` prop + `useEffect` |
| `src/admin/drawers/EditCriteriaDrawer.jsx` | Add `saveState`, pass `onSaveState`/`onClose`, render `fs-drawer-footer` |
| `src/admin/pages/CriteriaPage.jsx` | Delete inline drawer (lines 349-389); swap to `<EditCriteriaDrawer>` |
| `src/styles/pages/criteria.css` | Remove `.criteria-manager-footer` sticky-hack rule (line 723) |

---

## Task 1: Remove footer from CriteriaManager and add `onSaveState` callback

**Files:**

- Modify: `src/admin/criteria/CriteriaManager.jsx`

- [ ] **Step 1: Add `onSaveState` prop and wire `useEffect`**

  In `CriteriaManager.jsx`, update the props destructuring (line 55) and add a `useEffect` that fires whenever the save-relevant values change. Place the `useEffect` right after the `useCriteriaForm` call (after line 95).

  Change the props signature from:

  ```jsx
  export default function CriteriaManager({
    template = [],
    outcomeConfig = [],
    onSave,
    onClose,
    onDirtyChange,
    disabled = false,
    isLocked = false,
    saveDisabled = false,
  }) {
  ```

  To:

  ```jsx
  export default function CriteriaManager({
    template = [],
    outcomeConfig = [],
    onSave,
    onClose,
    onSaveState,
    onDirtyChange,
    disabled = false,
    isLocked = false,
    saveDisabled = false,
  }) {
  ```

  Then add this `useEffect` immediately after the `useCriteriaForm` destructure block (after the closing `}` at line 95), before `const rowIds = ...`:

  ```jsx
  useEffect(() => {
    onSaveState?.({
      saving,
      canSave,
      handleSave,
      saveBlockReasons,
      totalOk,
      activeRowsCount: activeRows.length,
      totalMax,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving, canSave, handleSave, saveBlockReasons, totalOk, activeRows.length, totalMax]);
  ```

  Also add `useEffect` to the existing React import at line 21 — change:

  ```jsx
  import { useId } from "react";
  ```

  To:

  ```jsx
  import { useEffect, useId } from "react";
  ```

- [ ] **Step 2: Remove the `criteria-manager-footer` div block**

  Delete the entire `<div className="criteria-manager-footer">` block (lines 190–216 in the current file). The block to remove is:

  ```jsx
      <div className="criteria-manager-footer">
        <div className="crt-footer-meta">
          {totalOk && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          )}
          <span className="crt-footer-count">{activeRows.length}</span> criteria &middot; <span className="crt-footer-count">{totalMax}</span> pts
        </div>
        <button
          type="button"
          className="crt-cancel-btn"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="crt-save-btn"
          onClick={handleSave}
          disabled={!canSave || saveDisabled}
        >
          <AsyncButtonContent loading={saving} loadingText="Saving…">Save Criteria</AsyncButtonContent>
        </button>
      </div>
  ```

  After removing this block, also remove the `AsyncButtonContent` import since it will no longer be used in this file:

  ```jsx
  import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
  ```

- [ ] **Step 3: Verify the component still renders without errors**

  Run dev server and navigate to Admin → Criteria. The drawer should open (via the still-present inline drawer in `CriteriaPage.jsx`) and show the criteria list. The footer will be gone from the body — that is expected at this stage.

  ```bash
  npm run dev
  ```

  Visually confirm no console errors and the drawer opens.

- [ ] **Step 4: Run existing tests**

  ```bash
  npm test -- --run src/admin/__tests__/CriteriaManager.test.jsx
  ```

  Expected: all tests pass. The tests do not interact with the footer (it was never tested directly), so removing it does not break them.

---

## Task 2: Update `EditCriteriaDrawer` to own the footer

**Files:**

- Modify: `src/admin/drawers/EditCriteriaDrawer.jsx`

- [ ] **Step 1: Add imports for `useState`, `AsyncButtonContent`, and `AlertCard`**

  Replace the existing import block at the top of `EditCriteriaDrawer.jsx`:

  ```jsx
  import Drawer from "@/shared/ui/Drawer";
  import CriteriaManager from "../criteria/CriteriaManager";
  ```

  With:

  ```jsx
  import { useState } from "react";
  import AlertCard from "@/shared/ui/AlertCard";
  import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
  import Drawer from "@/shared/ui/Drawer";
  import CriteriaManager from "../criteria/CriteriaManager";
  ```

- [ ] **Step 2: Add `saveState` local state and wire `onSaveState` into `CriteriaManager`**

  In the component body, add the `saveState` state immediately before the `handleSave` function:

  ```jsx
  const [saveState, setSaveState] = useState({
    saving: false,
    canSave: false,
    handleSave: null,
    saveBlockReasons: [],
    totalOk: false,
    activeRowsCount: 0,
    totalMax: 0,
  });
  ```

  Then pass `onSaveState` and `onClose` to `<CriteriaManager>`. The current `<CriteriaManager>` block inside `fs-drawer-body` is:

  ```jsx
  <CriteriaManager
    template={template}
    outcomeConfig={outcomeConfig}
    onSave={handleSave}
    onDirtyChange={onDirtyChange}
    disabled={disabled}
    isLocked={isLocked}
  />
  ```

  Change it to:

  ```jsx
  <CriteriaManager
    template={template}
    outcomeConfig={outcomeConfig}
    onSave={handleSave}
    onClose={onClose}
    onSaveState={setSaveState}
    onDirtyChange={onDirtyChange}
    disabled={disabled}
    isLocked={isLocked}
  />
  ```

- [ ] **Step 3: Add `fs-drawer-footer` after `fs-drawer-body`**

  After the closing `</div>` of `fs-drawer-body` (currently the last element before `</Drawer>`), add:

  ```jsx
      {saveState.saveBlockReasons.length > 0 && (
        <div style={{ padding: "0 20px 8px" }}>
          <AlertCard variant="error">
            {saveState.saveBlockReasons.length === 1
              ? saveState.saveBlockReasons[0]
              : (
                <ul className="list-disc text-xs text-muted-foreground" style={{ margin: 0, paddingLeft: "1.2rem" }}>
                  {saveState.saveBlockReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )
            }
          </AlertCard>
        </div>
      )}

      <div className="fs-drawer-footer">
        <div className="crt-footer-meta">
          {saveState.totalOk && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          )}
          <span className="crt-footer-count">{saveState.activeRowsCount}</span> criteria
          {" · "}
          <span className="crt-footer-count">{saveState.totalMax}</span> pts
        </div>
        <button
          type="button"
          className="crt-cancel-btn"
          onClick={onClose}
          disabled={saveState.saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="crt-save-btn"
          onClick={() => saveState.handleSave?.()}
          disabled={!saveState.canSave || disabled}
        >
          <AsyncButtonContent loading={saveState.saving} loadingText="Saving…">
            Save Criteria
          </AsyncButtonContent>
        </button>
      </div>
  ```

  The full final structure of the JSX return should be:

  ```jsx
  return (
    <Drawer open={open} onClose={onClose} id="drawer-edit-criteria">
      <div className="fs-drawer-header">
        {/* ... header content unchanged ... */}
      </div>

      <div className="fs-drawer-body">
        <CriteriaManager ... />
      </div>

      {saveState.saveBlockReasons.length > 0 && (
        <div style={{ padding: "0 20px 8px" }}>
          <AlertCard variant="error">...</AlertCard>
        </div>
      )}

      <div className="fs-drawer-footer">
        {/* meta + Cancel + Save Criteria */}
      </div>
    </Drawer>
  );
  ```

- [ ] **Step 4: Run dev server and smoke-test the drawer**

  ```bash
  npm run dev
  ```

  Navigate to Admin → Criteria → open a period → click the edit button. Verify:

  - Drawer opens with header, scrollable body, and footer
  - Footer shows criteria count and pts
  - Cancel closes the drawer
  - Save Criteria button is disabled when criteria weights don't sum to 100
  - Save Criteria button triggers save and closes on success

---

## Task 3: Replace inline drawer block in `CriteriaPage.jsx`

**Files:**

- Modify: `src/admin/pages/CriteriaPage.jsx`

- [ ] **Step 1: Swap imports**

  At the top of `CriteriaPage.jsx`, remove the two old imports:

  ```jsx
  import CriteriaManager from "../criteria/CriteriaManager";
  import Drawer from "@/shared/ui/Drawer";
  ```

  Add the new one:

  ```jsx
  import EditCriteriaDrawer from "../drawers/EditCriteriaDrawer";
  ```

  The final import block should look like:

  ```jsx
  import { useCallback, useEffect, useRef, useState } from "react";
  import { useAdminContext } from "../hooks/useAdminContext";
  import { useToast } from "@/shared/hooks/useToast";
  import { useManagePeriods } from "../hooks/useManagePeriods";
  import ConfirmDialog from "@/shared/ui/ConfirmDialog";
  import EditCriteriaDrawer from "../drawers/EditCriteriaDrawer";
  import FbAlert from "@/shared/ui/FbAlert";
  import "../../styles/pages/criteria.css";
  ```

- [ ] **Step 2: Replace the inline drawer block**

  Delete lines 349–389 (the `{/* CriteriaManager drawer */}` comment through the closing `</Drawer>` tag):

  ```jsx
        {/* CriteriaManager drawer */}
        <Drawer open={editorOpen} onClose={closeEditor} id="drawer-edit-criteria">
          <div className="fs-drawer-header">
            <div className="fs-drawer-header-row">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="crt-drawer-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
                  </svg>
                </div>
                <div>
                  <div className="crt-drawer-title">Evaluation Criteria</div>
                  <div className="crt-drawer-subtitle">
                    Scoring weights and rubric configuration
                    {periods.viewPeriodLabel && periods.viewPeriodLabel !== "—" && (
                      <span className="crt-semester-tag">{periods.viewPeriodLabel}</span>
                    )}
                  </div>
                </div>
              </div>
              <button className="fs-close" type="button" onClick={closeEditor} aria-label="Close" style={{ width: 30, height: 30, borderRadius: 7 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
          <div className="fs-drawer-body">
            <CriteriaManager
              template={criteriaConfig}
              outcomeConfig={periods.outcomeConfig || []}
              onSave={async (newTemplate) => {
                const result = await handleSave(newTemplate);
                if (result.ok) closeEditor();
                return result;
              }}
              onClose={closeEditor}
              onDirtyChange={onDirtyChange}
              disabled={loadingCount > 0}
              isLocked={isLocked}
            />
          </div>
        </Drawer>
  ```

  Replace with:

  ```jsx
        <EditCriteriaDrawer
          open={editorOpen}
          onClose={closeEditor}
          period={{ id: periods.viewPeriodId, name: periods.viewPeriodLabel }}
          template={criteriaConfig}
          outcomeConfig={periods.outcomeConfig || []}
          onSave={handleSave}
          onDirtyChange={onDirtyChange}
          disabled={loadingCount > 0}
          isLocked={isLocked}
        />
  ```

  Note: `EditCriteriaDrawer.handleSave` already calls `onClose()` on success, so the inline `if (result.ok) closeEditor()` logic is not needed here — `handleSave` from the page is passed directly.

- [ ] **Step 3: Run dev server — full end-to-end verification**

  ```bash
  npm run dev
  ```

  Verify:

  1. Criteria page loads without errors
  2. Clicking edit on a period opens the `EditCriteriaDrawer` (same visual as before)
  3. Footer appears outside the scroll area — sticky at the bottom
  4. Criteria count and pts update live as criteria are added/removed/weights changed
  5. Save works and drawer closes
  6. Cancel closes the drawer without saving

- [ ] **Step 4: Run all tests**

  ```bash
  npm test -- --run
  ```

  Expected: all tests pass. No test references the inline drawer block in `CriteriaPage`.

---

## Task 4: Remove `.criteria-manager-footer` CSS rule

**Files:**

- Modify: `src/styles/pages/criteria.css`

- [ ] **Step 1: Delete the sticky-hack CSS rule**

  At line 722–723 in `criteria.css`, remove this entire block (comment + rule):

  ```css
  /* CriteriaManager footer — sticky bar */
  .criteria-manager-footer{position:sticky;bottom:0;margin:16px -28px -28px;padding:14px 28px;border-top:1px solid var(--border);background:var(--bg-card);box-shadow:0 -1px 4px rgba(0,0,0,0.03);display:flex;align-items:center;justify-content:space-between;gap:12px;z-index:2}
  ```

  The `.crt-footer-meta`, `.crt-save-btn`, and `.crt-cancel-btn` rules that follow (lines 725–732) are **kept** — they are now used inside `fs-drawer-footer` in `EditCriteriaDrawer`.

- [ ] **Step 2: Run dev server — visual check**

  ```bash
  npm run dev
  ```

  Open the Criteria drawer and confirm:

  - Footer is still styled correctly (buttons, meta text)
  - No visual regression in the drawer body or footer layout
  - Scrolling the body does not move the footer (it's pinned by `fs-drawer-footer` CSS, not the old sticky hack)

- [ ] **Step 3: Run all tests one final time**

  ```bash
  npm test -- --run
  ```

  Expected: all tests pass.
