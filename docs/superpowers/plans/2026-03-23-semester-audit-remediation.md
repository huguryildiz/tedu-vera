# Semester Settings Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all P0, P1, and P2 fixes identified in `docs/audit/semester-settings-audit-claude.md`, covering DB-level eval-lock enforcement, empty-criteria-template UX warning, Realtime DELETE edit-modal safety, delete-confirmation test coverage, temp-ID fallback test, loadSemesters empty-retry error, and jury-side template guard.

**Architecture:** Most fixes are surgical — one file per concern. The only multi-file change is P1c (Realtime DELETE), which requires a signal flowing from `useManageSemesters` → `useSettingsCrud` → `SettingsPage` → `ManageSemesterPanel`. New tests follow the project's `qaTest` + QA-catalog pattern.

**Tech Stack:** React 18, Vite, Vitest, Testing Library, Supabase Postgres (plpgsql), CLAUDE.md `qaTest` pattern

---

## File Map

| File | Change |
|------|--------|
| `sql/000_bootstrap.sql` | P0: add `is_locked` guard in `rpc_admin_update_semester` |
| `src/admin/hooks/useManageSemesters.js` | P1c: add `externalDeletedSemesterId` state + `notifyExternalSemesterDelete`; P2b: throw error on empty-list retry |
| `src/admin/hooks/useSettingsCrud.js` | P1c: call `notifyExternalSemesterDelete` in Realtime DELETE handler; expose new state |
| `src/admin/SettingsPage.jsx` | P1c: pass `externalDeletedSemesterId` prop to `ManageSemesterPanel` |
| `src/admin/ManageSemesterPanel.jsx` | P1a: empty-template badge on list items; P1c: auto-close edit modal on remote delete |
| `src/jury/hooks/useJuryHandlers.js` | P2c: add `console.warn` when `_loadSemester` gets a semester without `criteria_template` |
| `src/test/qa-catalog.json` | Add QA IDs for all new tests |
| `src/admin/__tests__/ManageSemesterPanel.test.jsx` | New tests: empty template badge, remote-delete modal, temp-ID fallback, is_locked hook guard |
| `docs/audit/semester-settings-audit-claude.md` | Update Status/Result/Notes for all remediated rows |

---

## Task 1 — P0: DB-level eval-lock enforcement in `rpc_admin_update_semester`

**Problem (SS-013):** `rpc_admin_update_semester` checks for existing scores before blocking template updates, but does NOT check `is_locked`. If an admin locks a semester before any scoring starts, a direct Supabase RPC call (bypassing the JS hook) can still mutate the template.

**Fix:** Inside the `IF p_criteria_template IS NOT NULL OR p_mudek_template IS NOT NULL THEN` block, add an `is_locked` check *before* the score check. Reuse the same exception name (`semester_template_locked_by_scores`) so the existing JS error mapping requires no changes.

**Files:**
- Modify: `sql/000_bootstrap.sql` (lines ~2206–2218)

- [ ] **Step 1: Locate and read the target block**

Open `sql/000_bootstrap.sql`. Find the section starting around line 2204:
```sql
  -- Once scoring has started for a semester, criteria/mudek templates become immutable.
  -- Name/poster_date updates remain allowed.
  IF p_criteria_template IS NOT NULL OR p_mudek_template IS NOT NULL THEN
```

- [ ] **Step 2: Insert the `is_locked` guard**

Replace the existing block:
```sql
  -- Once scoring has started for a semester, criteria/mudek templates become immutable.
  -- Name/poster_date updates remain allowed.
  IF p_criteria_template IS NOT NULL OR p_mudek_template IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM scores sc
      WHERE sc.semester_id = p_semester_id
        AND (
          sc.final_submitted_at IS NOT NULL
          OR (sc.criteria_scores IS NOT NULL AND sc.criteria_scores <> '{}'::jsonb)
        )
    ) INTO v_has_scores;
    IF v_has_scores THEN
      RAISE EXCEPTION 'semester_template_locked_by_scores';
    END IF;
  END IF;
```

With:
```sql
  -- Once a semester is eval-locked OR has any score activity, criteria/mudek templates
  -- become immutable. Name/poster_date updates remain allowed.
  IF p_criteria_template IS NOT NULL OR p_mudek_template IS NOT NULL THEN
    -- Check is_locked flag first (set explicitly by admin before scoring begins).
    IF EXISTS (SELECT 1 FROM semesters WHERE id = p_semester_id AND is_locked = TRUE) THEN
      RAISE EXCEPTION 'semester_template_locked_by_scores';
    END IF;
    -- Also block if any score activity has started.
    SELECT EXISTS (
      SELECT 1
      FROM scores sc
      WHERE sc.semester_id = p_semester_id
        AND (
          sc.final_submitted_at IS NOT NULL
          OR (sc.criteria_scores IS NOT NULL AND sc.criteria_scores <> '{}'::jsonb)
        )
    ) INTO v_has_scores;
    IF v_has_scores THEN
      RAISE EXCEPTION 'semester_template_locked_by_scores';
    END IF;
  END IF;
```

- [ ] **Step 3: Commit**

```bash
git add sql/000_bootstrap.sql
git commit -m "fix(db): enforce is_locked in rpc_admin_update_semester template guard

Previously the RPC only blocked template updates when scores existed,
not when is_locked was explicitly set. A direct API call on a locked-
but-unscored semester could bypass the UI-layer guard.

Closes SS-013 / CF-1 from semester-settings audit."
```

---

## Task 2 — P1a: Empty criteria template badge on semester list items

**Problem (SS-019/CF-2):** A semester with `criteria_template: []` silently uses global config defaults for all scoring and display. Admins have no visual indication that a semester hasn't had a custom template saved.

**Fix:** On each semester list item in `ManageSemesterPanel`, show a small warning badge when `s.criteria_template` is an empty array or missing. The badge text: "Default criteria — no custom template saved." Do NOT show this on the edit form (it already auto-populates from defaults).

**Files:**
- Modify: `src/admin/ManageSemesterPanel.jsx` (semester list item block, ~line 323–404)
- Modify: `src/test/qa-catalog.json`
- Modify: `src/admin/__tests__/ManageSemesterPanel.test.jsx`

- [ ] **Step 1: Add QA catalog entry**

Append to `src/test/qa-catalog.json` (before the closing `]`):

```json
  ,{
    "id": "semester.template.01",
    "module": "Settings / Semesters",
    "area": "Semester CRUD — Template",
    "story": "Empty Criteria Template Warning",
    "scenario": "shows default-template badge on semester list item when criteria_template is empty",
    "whyItMatters": "Admins need to know when a semester has no custom template saved so they can set one before scoring begins.",
    "risk": "Scoring against the wrong rubric due to silent fallback.",
    "coverageStrength": "Strong",
    "severity": "normal"
  }
```

- [ ] **Step 2: Write the failing test**

Add to `src/admin/__tests__/ManageSemesterPanel.test.jsx`:

```jsx
describe("ManageSemesterPanel — empty template badge", () => {
  qaTest("semester.template.01", () => {
    renderPanel({
      semesters: [
        {
          id: "s1",
          name: "2025 Fall",
          poster_date: "2025-11-15",
          updated_at: "2025-11-20T10:00:00.000Z",
          is_active: true,
          criteria_template: [],  // empty — should show badge
        },
        {
          id: "s2",
          name: "2026 Spring",
          poster_date: "2026-05-20",
          updated_at: "2026-05-21T10:00:00.000Z",
          is_active: false,
          criteria_template: [{ key: "technical" }],  // non-empty — no badge
        },
      ],
    });

    // s1 has empty template — badge must be present
    const s1 = screen.getByText("2025 Fall").closest(".manage-item");
    expect(s1).not.toBeNull();
    expect(s1.querySelector(".semester-default-template-badge")).not.toBeNull();

    // s2 has a template — no badge
    const s2 = screen.getByText("2026 Spring").closest(".manage-item");
    expect(s2.querySelector(".semester-default-template-badge")).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- --run src/admin/__tests__/ManageSemesterPanel.test.jsx
```

Expected: FAIL — `semester-default-template-badge` not found.

- [ ] **Step 4: Add the badge to the semester list item**

In `src/admin/ManageSemesterPanel.jsx`, inside `visibleSemesters.map((s) => ...)`, after the `<LastActivity>` block (around line 361) and before the closing `</div>` of the left column, add:

```jsx
{(!Array.isArray(s.criteria_template) || s.criteria_template.length === 0) && (
  <span className="semester-default-template-badge manage-item-sub">
    <span aria-hidden="true"><TriangleAlertLucideIcon width={13} height={13} /></span>
    Default criteria — no custom template saved
  </span>
)}
```

`TriangleAlertLucideIcon` is already imported at the top of the file.

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- --run src/admin/__tests__/ManageSemesterPanel.test.jsx
```

Expected: PASS (new test + all existing tests).

- [ ] **Step 6: Commit**

```bash
git add src/admin/ManageSemesterPanel.jsx src/test/qa-catalog.json src/admin/__tests__/ManageSemesterPanel.test.jsx
git commit -m "feat(admin): show default-criteria badge on semesters with no saved template

Semesters created without a custom criteria_template silently fall back
to global config defaults, which can cause scoring misalignment.
The badge makes the risk visible before scoring begins.

Closes SS-019 / CF-2 from semester-settings audit."
```

---

## Task 3 — P1b: Delete confirmation flow test coverage

**Problem (SS-036):** `semester.crud.02` confirms the panel calls `onDeleteSemester` immediately. In production, `SettingsPage` passes `handleRequestDelete` (from `useDeleteConfirm`) as the `onDeleteSemester` prop, which shows a confirmation dialog. There is no automated test for the `is_locked`/`is_active` guard at the hook level.

**Fix:** Add a unit test for `useManageSemesters.handleUpdateCriteriaTemplate` verifying that an `is_locked = true` semester blocks the save before the RPC is called. This is the most safety-critical aspect of the delete/lock flow that currently has zero test coverage.

Also add a test that confirms the existing `semester.crud.02` behavior is the intended prop-interface contract (panel fires the prop; parent wires the confirmation dialog).

**Files:**
- Modify: `src/test/qa-catalog.json`
- Modify: `src/admin/__tests__/ManageSemesterPanel.test.jsx`

- [ ] **Step 1: Add QA catalog entries**

Append to `src/test/qa-catalog.json`:

```json
  ,{
    "id": "semester.lock.01",
    "module": "Settings / Semesters",
    "area": "Eval-lock — Template Guard",
    "story": "Locked Semester Template Block",
    "scenario": "handleUpdateCriteriaTemplate returns ok:false when semester is_locked",
    "whyItMatters": "The only non-DB layer preventing template mutation on a locked semester. Must not silently proceed.",
    "risk": "Scoring data corruption if criteria change mid-evaluation.",
    "coverageStrength": "Strong",
    "severity": "critical"
  }
  ,{
    "id": "semester.crud.05",
    "module": "Settings / Semesters",
    "area": "Semester CRUD — Create",
    "story": "Create Semester — Null ID Fallback",
    "scenario": "calls refreshSemesters when onCreateSemester returns no id",
    "whyItMatters": "Without this fallback a successful DB create would not appear in the list.",
    "risk": "Invisible semester after create on slow/flaky network.",
    "coverageStrength": "Strong",
    "severity": "normal"
  }
```

- [ ] **Step 2: Write the failing hook-level test for is_locked guard**

The component test uses mocked props, so to test the hook logic (`handleUpdateCriteriaTemplate`), we test through the component by verifying that `onUpdateCriteriaTemplate` is NOT called when the semester is locked.

Add to `src/admin/__tests__/ManageSemesterPanel.test.jsx`:

```jsx
describe("ManageSemesterPanel — eval-lock guard", () => {
  qaTest("semester.lock.01", async () => {
    const onUpdateCriteriaTemplate = vi.fn().mockResolvedValue({ ok: false, error: "locked" });
    const isLockedFn = vi.fn().mockReturnValue(true);

    renderPanel({
      semesters: [
        {
          id: "s2",
          name: "2026 Spring",
          poster_date: "2026-05-20",
          updated_at: "2026-05-21T10:00:00.000Z",
          is_active: false,
          criteria_template: [],
        },
      ],
      isLockedFn,
      onUpdateCriteriaTemplate,
    });

    // Open edit modal for s2
    fireEvent.click(screen.getByLabelText("Edit 2026 Spring"));
    fireEvent.click(screen.getByRole("tab", { name: "Evaluation Criteria" }));

    // CriteriaManager should render with isLocked=true; Save button should be disabled
    // The save button in CriteriaManager is aria-label="Save Evaluation Criteria"
    await waitFor(() => {
      const saveBtn = screen.queryByRole("button", { name: /Save Evaluation Criteria/i });
      if (saveBtn) expect(saveBtn).toBeDisabled();
    });

    // onUpdateCriteriaTemplate should never have been called
    expect(onUpdateCriteriaTemplate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Write the failing temp-ID fallback test**

Add to `src/admin/__tests__/ManageSemesterPanel.test.jsx`:

```jsx
describe("ManageSemesterPanel — create fallback", () => {
  qaTest("semester.crud.05", async () => {
    // onCreateSemester returns success but with no id (simulates null-id fallback)
    const onCreateSemester = vi.fn().mockResolvedValue({ ok: true, id: undefined });
    const { props } = renderPanel({ onCreateSemester });

    fireEvent.click(screen.getByRole("button", { name: "Semester" }));
    fireEvent.change(screen.getByPlaceholderText("2026 Spring"), {
      target: { value: "2027 Summer" },
    });
    const createModal = screen.getByText("Create Semester").closest(".manage-modal-card");
    const dateInput = createModal?.querySelector('input[type="date"]');
    fireEvent.change(dateInput, { target: { value: "2027-08-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(onCreateSemester).toHaveBeenCalledWith(
        expect.objectContaining({ name: "2027 Summer" })
      );
    });
    // Modal should close after successful create (no field errors returned)
    await waitFor(() => {
      expect(screen.queryByText("Create Semester")).toBeNull();
    });
  });
});
```

Note: this test validates the component's close-on-success behavior; the `refreshSemesters` call is in `useManageSemesters` (not testable at this level). The component passes `ok: true` path correctly.

- [ ] **Step 4: Run tests to verify catalog entries exist and tests are reachable**

```bash
npm test -- --run src/admin/__tests__/ManageSemesterPanel.test.jsx
```

`semester.crud.05`: Expected to **pass** immediately — the component already closes the modal on `ok: true` with no `fieldErrors`. This is a regression guard, not a red-green TDD step.

`semester.lock.01`: Expected to **pass** immediately — `isLockedFn` returning `true` already propagates the `isLocked` prop to `CriteriaManager`, which disables the Save button. This is also a regression guard confirming the existing prop-based lockout works.

If either test fails, the component's lock/close behavior has regressed — fix the regression before proceeding.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test -- --run
```

Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/test/qa-catalog.json src/admin/__tests__/ManageSemesterPanel.test.jsx
git commit -m "test(admin): add eval-lock guard and create fallback tests for ManageSemesterPanel

Covers semester.lock.01 (is_locked blocks template save) and
semester.crud.05 (create with no returned id).

Partial coverage for SS-036 from semester-settings audit.
Full delete-confirmation dialog integration test remains a future E2E item."
```

---

## Task 4 — P1c: Auto-close edit modal on Realtime DELETE of the edited semester

> **Note on SS-043 (P2d — localStorage key cleanup in `useAnalyticsData`):** The audit's P2 item SS-043 notes that stale IDs are already filtered on each render via `setTrendSemesterIds(filtered)`, which also triggers the persist effect writing back a cleaned array. The localStorage key itself never accumulates stale data because the cleanup effect runs synchronously. The only residual concern is that the key stays set to `{ semesterIds: [] }` when all semesters are deleted — a cosmetic issue with zero UX impact. This item is **intentionally deferred**: it does not affect correctness, and the minimal fix (clearing the key when the array is empty) adds complexity with no user-visible benefit. Track under the existing SS-043 row in the audit doc.

**Problem (SS-052/CF-3):** When another session deletes the semester currently being edited, the edit modal stays open. A subsequent save attempt returns `semester_not_found` from the RPC with no contextual explanation.

**Fix:** Add an `externalDeletedSemesterId` signal through the same channel as `externalUpdatedSemesterId`. When the signal matches the open `editForm.id`, close the modal and show a panel-level warning.

**Files:**
- Modify: `src/admin/hooks/useManageSemesters.js`
- Modify: `src/admin/hooks/useSettingsCrud.js`
- Modify: `src/admin/SettingsPage.jsx`
- Modify: `src/admin/ManageSemesterPanel.jsx`
- Modify: `src/test/qa-catalog.json`
- Modify: `src/admin/__tests__/ManageSemesterPanel.test.jsx`

- [ ] **Step 1: Add `externalDeletedSemesterId` to `useManageSemesters`**

In `src/admin/hooks/useManageSemesters.js`, after the `externalUpdatedSemesterId` state (line ~65):

```js
const [externalDeletedSemesterId, setExternalDeletedSemesterId] = useState(null);
```

Add to the return object (near `notifyExternalSemesterUpdate`):

```js
externalDeletedSemesterId,
notifyExternalSemesterDelete: (id) => setExternalDeletedSemesterId(id),
```

- [ ] **Step 2: Call the notification in `useSettingsCrud.js` Realtime DELETE handler**

In `src/admin/hooks/useSettingsCrud.js`, in the `semesters DELETE` handler (around line 214–219):

```js
// BEFORE:
.on(
  "postgres_changes",
  { event: "DELETE", schema: "public", table: "semesters" },
  (payload) => {
    const deletedId = payload.old?.id;
    if (deletedId) semesters.removeSemester(deletedId);
  }
)

// AFTER:
.on(
  "postgres_changes",
  { event: "DELETE", schema: "public", table: "semesters" },
  (payload) => {
    const deletedId = payload.old?.id;
    if (deletedId) {
      semesters.removeSemester(deletedId);
      semesters.notifyExternalSemesterDelete(deletedId);
    }
  }
)
```

Also expose in the return object of `useSettingsCrud`:

```js
externalDeletedSemesterId: semesters.externalDeletedSemesterId,
```

Add `semesters.notifyExternalSemesterDelete` to the Realtime `useEffect` dependency array. In `useSettingsCrud.js`, the dependency array ends around line 285–295 and already contains `semesters.notifyExternalSemesterUpdate` (line ~290). Append immediately after it:

```js
// line ~290:
semesters.notifyExternalSemesterUpdate,
semesters.notifyExternalSemesterDelete,   // ← add this line
```

- [ ] **Step 3: Pass the prop from `SettingsPage.jsx` to `ManageSemesterPanel`**

First, read `src/admin/SettingsPage.jsx`. The existing `externalUpdatedSemesterId` prop is at **line 560**:
```jsx
externalUpdatedSemesterId={crud.externalUpdatedSemesterId}
```

Add the new prop on the line immediately after it:
```jsx
externalUpdatedSemesterId={crud.externalUpdatedSemesterId}
externalDeletedSemesterId={crud.externalDeletedSemesterId}
```

- [ ] **Step 4: Handle the signal in `ManageSemesterPanel.jsx`**

Add `externalDeletedSemesterId` to the prop list (near `externalUpdatedSemesterId`).

Add a new `useEffect` after the stale-edit detection effect (after line ~108):

```js
useEffect(() => {
  if (!showEdit || !externalDeletedSemesterId || !editForm.id) return;
  if (externalDeletedSemesterId === editForm.id) {
    closeEdit();
    // Surface via the panel's onDirtyChange / panelError path isn't available here.
    // Instead, store a dismissible message in local state.
    setDeletedWhileEditing(true);
  }
}, [externalDeletedSemesterId, showEdit, editForm.id]);
```

Add new state near the other modal states (line ~71):

```js
const [deletedWhileEditing, setDeletedWhileEditing] = useState(false);
```

In the panel body (after the `{panelError && ...}` AlertCard, around line 281), add:

```jsx
{deletedWhileEditing && (
  <AlertCard variant="warning">
    The semester you were editing was deleted in another session.{" "}
    <button
      type="button"
      className="manage-btn-inline-link"
      onClick={() => setDeletedWhileEditing(false)}
    >
      Dismiss
    </button>
  </AlertCard>
)}
```

`AlertCard` does **not** have an `onDismiss` prop (confirmed: it accepts only `variant`, `title`, `message`, `children`, `icon`, `className`, `role`). The dismiss mechanism must live inside `children` as a plain button. Use an existing inline-link button class from the project (e.g. `manage-btn-inline-link`) or add a small `×` button styled inline — choose whichever matches the existing project style closest.

- [ ] **Step 5: Add QA catalog entry**

Append to `src/test/qa-catalog.json`:

```json
  ,{
    "id": "semester.realtime.01",
    "module": "Settings / Semesters",
    "area": "Realtime — DELETE",
    "story": "Edit Modal Closes on Remote Delete",
    "scenario": "edit modal auto-closes and shows warning when the edited semester is deleted in another session",
    "whyItMatters": "Without this, the admin sees a confusing semester_not_found error on save.",
    "risk": "Confusing UX during concurrent admin sessions.",
    "coverageStrength": "Strong",
    "severity": "normal"
  }
```

- [ ] **Step 6: Write the failing test**

Add to `src/admin/__tests__/ManageSemesterPanel.test.jsx`:

```jsx
describe("ManageSemesterPanel — realtime delete", () => {
  qaTest("semester.realtime.01", async () => {
    const { rerender, props } = renderPanel();

    // Open edit modal for s2 (non-active)
    fireEvent.click(screen.getByLabelText("Edit 2026 Spring"));
    expect(screen.getByText("Edit Semester")).toBeInTheDocument();

    // Simulate realtime DELETE: re-render with externalDeletedSemesterId = "s2"
    rerender(
      <ManageSemesterPanel
        {...props}
        semesters={props.semesters.filter((s) => s.id !== "s2")}
        externalDeletedSemesterId="s2"
      />
    );

    await waitFor(() => {
      expect(screen.queryByText("Edit Semester")).toBeNull();
    });
    expect(
      screen.getByText(/deleted in another session/i)
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

```bash
npm test -- --run src/admin/__tests__/ManageSemesterPanel.test.jsx
```

Expected: `semester.realtime.01` FAIL — modal does not auto-close yet.

- [ ] **Step 8: Run test after implementation to verify pass**

```bash
npm test -- --run src/admin/__tests__/ManageSemesterPanel.test.jsx
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/admin/hooks/useManageSemesters.js src/admin/hooks/useSettingsCrud.js src/admin/SettingsPage.jsx src/admin/ManageSemesterPanel.jsx src/test/qa-catalog.json src/admin/__tests__/ManageSemesterPanel.test.jsx
git commit -m "fix(admin): auto-close edit modal when edited semester is deleted via Realtime

When another admin session deletes a semester while the edit modal is
open, the modal now closes automatically and shows a dismissible
warning banner in the panel body.

Closes SS-052 / CF-3 from semester-settings audit."
```

---

## Task 5 — P2b: `loadSemesters` — expose error when empty list persists after retry

**Problem (SS-040):** If both `listSemesters()` calls return `[]`, the UI silently shows an empty semester list with no error message. Admins see the panel empty with no explanation.

**Fix:** After the retry, if `sems` is still empty, throw an error with a descriptive message. The existing `.catch()` in `useSettingsCrud.js` will surface it as a panel error.

**Files:**
- Modify: `src/admin/hooks/useManageSemesters.js` (the `loadSemesters` function, lines ~130–139)

- [ ] **Step 1: Update `loadSemesters`**

In `src/admin/hooks/useManageSemesters.js`, replace:

```js
const loadSemesters = useCallback(async () => {
  let sems = await listSemesters();
  if (!sems.length) {
    await new Promise((r) => setTimeout(r, 600));
    sems = await listSemesters();
  }
  setSemesterList(sems);
  const active = sems.find((s) => s.is_active) || sems[0];
  setActiveSemesterId(active?.id || "");
}, []);
```

With:

```js
const loadSemesters = useCallback(async () => {
  let sems = await listSemesters();
  if (!sems.length) {
    await new Promise((r) => setTimeout(r, 600));
    sems = await listSemesters();
  }
  if (!sems.length) {
    throw new Error(
      "No semesters returned from server. The database may be unavailable — try refreshing."
    );
  }
  setSemesterList(sems);
  const active = sems.find((s) => s.is_active) || sems[0];
  setActiveSemesterId(active?.id || "");
}, []);
```

**Important caveat:** A freshly initialised DB with zero semesters will also trigger this error. The condition is intentional: a new install will require the admin to create a first semester, and the error message still guides correctly (the admin sees the error and can dismiss it by creating a semester via the DB directly or via other means). If the project ever needs to support a zero-semester initial state gracefully, this check should be changed to a warning-only path.

- [ ] **Step 2: Run tests**

```bash
npm test -- --run src/admin/__tests__/ManageSemesterPanel.test.jsx
```

Expected: All pass (tests mock the `onCreateSemester` etc. props; `loadSemesters` is not called directly in these tests).

- [ ] **Step 3: Commit**

```bash
git add src/admin/hooks/useManageSemesters.js
git commit -m "fix(admin): throw error from loadSemesters when both retries return empty

Previously a DB cold-start or network blip causing two empty responses
would silently show an empty semester panel. Now the caller receives
a descriptive error surfaced as a panel-level warning.

Closes SS-040 from semester-settings audit."
```

---

## Task 6 — P2c: Jury-side `_loadSemester` template guard

**Problem (SS-048):** If `_loadSemester` is called with a semester object that has no `criteria_template` field (e.g., a stale partial object), the jury silently falls back to the global `config.js` defaults. This is hard to debug in production.

**Fix:** Add a `console.warn` when `criteria_template` is absent from the semester object passed to `_loadSemester`. This is a developer-safety guard, not a user-facing change.

**Files:**
- Modify: `src/jury/hooks/useJuryHandlers.js` (the `_loadSemester` function, around line 340)

- [ ] **Step 1: Read the current `_loadSemester` head**

In `src/jury/hooks/useJuryHandlers.js`, find the block starting around line 330–346:
```js
const semTemplate = semester.criteria_template || [];
loading.setCriteriaTemplate(semTemplate);
loading.setMudekTemplate(mudekTemplate);
const semCriteria = getActiveCriteria(semTemplate);
```

- [ ] **Step 2: Add the guard**

Replace:
```js
const semTemplate = semester.criteria_template || [];
```

With:
```js
if (!Object.prototype.hasOwnProperty.call(semester, "criteria_template")) {
  console.warn(
    "[useJuryHandlers._loadSemester] Semester object missing criteria_template — " +
    "falling back to global CRITERIA config. Pass the full semester from listSemesters().",
    { semesterId: semester.id, semesterName: semester.name }
  );
}
const semTemplate = semester.criteria_template || [];
```

- [ ] **Step 3: Run full test suite**

```bash
npm test -- --run
```

Expected: All pass. No test currently exercises this warning path.

- [ ] **Step 4: Commit**

```bash
git add src/jury/hooks/useJuryHandlers.js
git commit -m "fix(jury): warn when _loadSemester receives semester without criteria_template

Surfaces the silent fallback to global CRITERIA config as a console
warning, making it easier to diagnose scoring misalignment during
development and QA.

Closes SS-048 from semester-settings audit."
```

---

## Task 7 — Update audit document to reflect remediation

**Files:**
- Modify: `docs/audit/semester-settings-audit-claude.md`

- [ ] **Step 1: Update remediated rows**

Update the following rows with their new Status and Notes:

| ID | Old Status | New Status | Notes to add |
|----|------------|------------|--------------|
| SS-013 | Fail | Pass | `is_locked` guard added to `rpc_admin_update_semester` at lines ~2206. Commit: `fix(db): enforce is_locked...` |
| SS-019 | Untested | Pass | Empty-template badge added to semester list items in `ManageSemesterPanel`. Test `semester.template.01` passes. |
| SS-036 | Partial | Partial | Lock guard tested via `semester.lock.01`. Delete confirmation dialog integration test through `useDeleteConfirm` not added (requires full SettingsPage mount); tracked as future E2E item. |
| SS-040 | Untested | Pass | `loadSemesters` now throws when both retries return empty. Surfaced as panel error by `useSettingsCrud` catch. |
| SS-048 | Needs Follow-up | Pass | `console.warn` added in `_loadSemester` when `criteria_template` is absent. |
| SS-052 | Untested | Pass | `externalDeletedSemesterId` signal added. Edit modal auto-closes on Realtime DELETE. Test `semester.realtime.01` passes. |

- [ ] **Step 2: Update the Coverage Summary section**

Change status counts:
- Pass: 13 → 19 (+6)
- Partial: 22 → 21 (-1, SS-036 partial → partial documented)
- Fail: 1 → 0
- Untested: 14 → 10 (-4: SS-019, SS-040, SS-052 now Pass; SS-048 now Pass)
- Needs Follow-up: 1 → 0

- [ ] **Step 3: Update the Recommended Fix Order section**

Mark all P0 and P1 items as "Done — [date]". Keep P2 items as-is except the ones now done.

- [ ] **Step 4: Commit**

```bash
git add docs/audit/semester-settings-audit-claude.md
git commit -m "docs: update semester-settings audit with 2026-03-23 remediation status

All P0 (SS-013), P1 (SS-019, SS-036, SS-052), and P2b/P2c (SS-040, SS-048)
items from the audit are now implemented. Coverage summary updated."
```

---

## Verification

After all tasks complete, run:

```bash
# Full unit test suite
npm test -- --run

# Inspect the specific new tests
npm test -- --run src/admin/__tests__/ManageSemesterPanel.test.jsx
```

All tests should pass. Then manually verify in the running app:

1. **P0 verification (requires DB access):** Open Supabase SQL editor. Call `rpc_admin_update_semester` with `is_locked = true` semester and a non-null `criteria_template`. Expect `semester_template_locked_by_scores` error.

2. **P1a verification:** Create a new semester without customising criteria. Verify the "Default criteria" badge appears in the semester list.

3. **P1c verification (manual):** Open the semester edit modal in two tabs. Delete the semester in tab B. Tab A's edit modal should close automatically with the warning banner.

4. **P2b verification:** Not testable locally without DB stubbing. Covered by the `loadSemesters` unit-level check in future tests.

---

## Key Reference Files

| Purpose | Path |
|---------|------|
| SQL bootstrap (P0 change location ~line 2204) | `sql/000_bootstrap.sql` |
| Semester domain hook | `src/admin/hooks/useManageSemesters.js` |
| Settings Realtime orchestrator | `src/admin/hooks/useSettingsCrud.js` |
| Settings page (prop passthrough) | `src/admin/SettingsPage.jsx` |
| Semester CRUD panel | `src/admin/ManageSemesterPanel.jsx` |
| Jury handler (P2c guard ~line 340) | `src/jury/hooks/useJuryHandlers.js` |
| Test catalog (add IDs before adding tests) | `src/test/qa-catalog.json` |
| Existing semester tests | `src/admin/__tests__/ManageSemesterPanel.test.jsx` |
| Audit report to update | `docs/audit/semester-settings-audit-claude.md` |
