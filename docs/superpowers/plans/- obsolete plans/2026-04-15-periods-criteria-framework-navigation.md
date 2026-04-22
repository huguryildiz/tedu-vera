# Periods — Criteria & Framework Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the period-drawer-based criteria/framework editing with direct navigation to CriteriaPage and OutcomesPage; strip AddEditPeriodDrawer to metadata only.

**Architecture:** Four-file change. The Criteria Set and Framework table cells become `badge + nav-button` combos that call `onCurrentSemesterChange(id)` then `onNavigate()`. AddEditPeriodDrawer loses all scoring-setup sections; a info banner in Add mode teaches the new workflow. FrameworkPickerModal becomes unused and is deleted.

**Tech Stack:** React 18, Lucide icons, project CSS variables.

---

## File Map

| File | Change |
|------|--------|
| `src/styles/pages/periods.css` | Add `.periods-cset-cell`, `.periods-fw-cell` wrappers and `.periods-cset-nav-btn`, `.periods-fw-nav-btn` icon button styles |
| `src/admin/pages/PeriodsPage.jsx` | Redesign both table cells; remove PeriodCriteriaDrawer state/imports/JSX; remove dead API imports and dead code in `handleSavePeriod` |
| `src/admin/drawers/AddEditPeriodDrawer.jsx` | Remove Scoring Setup (add), Framework (edit), Scoring Criteria (edit) sections; remove dead state/props/imports; add Evaluation Settings to Add mode; add info banner |
| `src/admin/modals/FrameworkPickerModal.jsx` | Delete — no longer imported anywhere |

---

### Task 1: CSS — Cell wrapper and nav button styles

**Files:**
- Modify: `src/styles/pages/periods.css`

- [ ] **Step 1: Locate the end of the existing badge blocks in periods.css**

  Open `src/styles/pages/periods.css`. The last badge block ends near the `.dark-mode .periods-cset-badge.muted` rule. Append the new rules immediately after that block.

- [ ] **Step 2: Add cell wrapper and nav button rules**

  Append to `src/styles/pages/periods.css` after the existing badge styles:

  ```css
  /* ─── Criteria Set / Framework — cell wrapper + nav button ─── */
  .periods-cset-cell,
  .periods-fw-cell {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .periods-cset-nav-btn,
  .periods-fw-nav-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border-radius: var(--radius-sm, 5px);
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text-tertiary);
    cursor: pointer;
    transition: background 0.14s, border-color 0.14s, color 0.14s;
  }

  .periods-cset-nav-btn:hover {
    background: rgba(99, 102, 241, 0.10);
    border-color: rgba(99, 102, 241, 0.35);
    color: var(--accent);
  }

  .periods-fw-nav-btn:hover {
    background: rgba(14, 165, 233, 0.10);
    border-color: rgba(14, 165, 233, 0.35);
    color: rgb(14, 165, 233);
  }

  .dark-mode .periods-cset-nav-btn,
  .dark-mode .periods-fw-nav-btn {
    border-color: rgba(255, 255, 255, 0.10);
    background: rgba(255, 255, 255, 0.04);
    color: var(--text-tertiary);
  }

  .dark-mode .periods-cset-nav-btn:hover {
    background: rgba(129, 140, 248, 0.15);
    border-color: rgba(129, 140, 248, 0.40);
    color: rgb(165, 180, 252);
  }

  .dark-mode .periods-fw-nav-btn:hover {
    background: rgba(56, 189, 248, 0.13);
    border-color: rgba(56, 189, 248, 0.38);
    color: rgb(125, 211, 252);
  }
  ```

- [ ] **Step 3: Verify build compiles**

  ```bash
  npm run build 2>&1 | tail -20
  ```

  Expected: no CSS errors.

---

### Task 2: PeriodsPage — Redesign Criteria Set and Framework cells

**Files:**
- Modify: `src/admin/pages/PeriodsPage.jsx`

- [ ] **Step 1: Add `ArrowRight` to the lucide-react import block**

  Current import block starts at line 29. Add `ArrowRight` alongside the existing icons:

  ```js
  import {
    Lock,
    LockOpen,
    Trash2,
    FileEdit,
    Play,
    CheckCircle,
    MoreVertical,
    Pencil,
    Eye,
    CalendarRange,
    Filter,
    Download,
    Plus,
    BadgeCheck,
    X,
    Info,
    ListChecks,
    ArrowRight,
  } from "lucide-react";
  ```

- [ ] **Step 2: Replace the Criteria Set cell (lines ~805–831)**

  Find:
  ```jsx
                  {/* Criteria Set */}
                  <td data-label="Criteria Set">
                    {(() => {
                      const count = periodStats[period.id]?.criteriaCount ?? 0;
                      const cname = period.criteria_name;
                      if (!count && !cname) return <span className="periods-cset-badge muted">—</span>;
                      return (
                        <button
                          className="periods-cset-badge"
                          onClick={async () => {
                            try {
                              const rows = await listPeriodCriteria(period.id);
                              setCriteriaDrawerCriteria(getActiveCriteria(rows));
                            } catch {
                              setCriteriaDrawerCriteria([]);
                            }
                            setCriteriaDrawerPeriod(period);
                            setCriteriaDrawerOpen(true);
                          }}
                          title="View criteria summary"
                        >
                          <ListChecks size={12} strokeWidth={1.75} />
                          {cname || period.name}
                        </button>
                      );
                    })()}
                  </td>
  ```

  Replace with:
  ```jsx
                  {/* Criteria Set */}
                  <td data-label="Criteria Set">
                    {(() => {
                      const count = periodStats[period.id]?.criteriaCount ?? 0;
                      const cname = period.criteria_name;
                      const hasData = count > 0 || !!cname;
                      return (
                        <div className="periods-cset-cell">
                          {hasData ? (
                            <button
                              className="periods-cset-badge"
                              onClick={() => {
                                onCurrentSemesterChange?.(period.id);
                                onNavigate?.("criteria");
                              }}
                            >
                              <ListChecks size={12} strokeWidth={1.75} />
                              {cname || `${count} criteria`}
                            </button>
                          ) : (
                            <span className="periods-cset-badge muted">Not set</span>
                          )}
                          <button
                            className="periods-cset-nav-btn"
                            onClick={() => {
                              onCurrentSemesterChange?.(period.id);
                              onNavigate?.("criteria");
                            }}
                            title={hasData ? "Go to Criteria page" : "Configure criteria"}
                          >
                            {hasData
                              ? <ArrowRight size={12} strokeWidth={2.25} />
                              : <Plus size={12} strokeWidth={2.25} />}
                          </button>
                        </div>
                      );
                    })()}
                  </td>
  ```

- [ ] **Step 3: Replace the Framework cell (lines ~833–849)**

  Find:
  ```jsx
                  {/* Framework */}
                  <td data-label="Framework">
                    {(() => {
                      const fw = frameworks.find((f) => f.id === period.framework_id);
                      return fw ? (
                        <button
                          className="periods-fw-badge clickable"
                          onClick={() => onNavigate?.("outcomes")}
                          title="Go to Outcome Mapping"
                        >
                          <BadgeCheck size={11} strokeWidth={2} /> {fw.name}
                        </button>
                      ) : (
                        <span className="periods-fw-badge none">—</span>
                      );
                    })()}
                  </td>
  ```

  Replace with:
  ```jsx
                  {/* Framework */}
                  <td data-label="Framework">
                    {(() => {
                      const fw = frameworks.find((f) => f.id === period.framework_id);
                      return (
                        <div className="periods-fw-cell">
                          {fw ? (
                            <button
                              className="periods-fw-badge clickable"
                              onClick={() => {
                                onCurrentSemesterChange?.(period.id);
                                onNavigate?.("outcomes");
                              }}
                            >
                              <BadgeCheck size={11} strokeWidth={2} /> {fw.name}
                            </button>
                          ) : (
                            <span className="periods-fw-badge none">Not set</span>
                          )}
                          <button
                            className="periods-fw-nav-btn"
                            onClick={() => {
                              onCurrentSemesterChange?.(period.id);
                              onNavigate?.("outcomes");
                            }}
                            title={fw ? "Go to Outcomes page" : "Configure framework"}
                          >
                            {fw
                              ? <ArrowRight size={12} strokeWidth={2.25} />
                              : <Plus size={12} strokeWidth={2.25} />}
                          </button>
                        </div>
                      );
                    })()}
                  </td>
  ```

- [ ] **Step 4: Verify the app renders without errors**

  ```bash
  npm run dev
  ```

  Open `http://localhost:5173`, navigate to Periods page, verify both columns show the badge + button layout for configured periods and "Not set" + "+" for unconfigured ones.

---

### Task 3: PeriodsPage — Remove PeriodCriteriaDrawer, dead imports, dead handleSavePeriod code

**Files:**
- Modify: `src/admin/pages/PeriodsPage.jsx`

- [ ] **Step 1: Remove `PeriodCriteriaDrawer` import**

  Find and remove:
  ```js
  import PeriodCriteriaDrawer from "../drawers/PeriodCriteriaDrawer";
  ```

- [ ] **Step 2: Remove dead API imports**

  In the `@/shared/api` import block, remove `listPeriodCriteria`, `savePeriodCriteria`, `cloneFramework`, `assignFrameworkToPeriod`, `freezePeriodSnapshot`. The block should become:

  ```js
  import {
    setEvalLock,
    deletePeriod,
    listPeriodStats,
    requestPeriodUnlock,
    listUnlockRequests,
  } from "@/shared/api";
  ```

- [ ] **Step 3: Remove `getActiveCriteria` import**

  Find and remove:
  ```js
  import { getActiveCriteria } from "@/shared/criteria/criteriaHelpers";
  ```

- [ ] **Step 4: Remove the criteria drawer state variables (~lines 253–256)**

  Find and remove:
  ```js
    // Criteria summary drawer
    const [criteriaDrawerOpen, setCriteriaDrawerOpen] = useState(false);
    const [criteriaDrawerPeriod, setCriteriaDrawerPeriod] = useState(null);
    const [criteriaDrawerCriteria, setCriteriaDrawerCriteria] = useState([]);
  ```

- [ ] **Step 5: Clean up `handleSavePeriod` — remove framework block (edit mode)**

  Find in the edit branch of `handleSavePeriod` (~lines 440–457):
  ```js
      // If a new framework was selected (or framework changed), clone + assign + freeze
      if (data.frameworkId && data.frameworkId !== periodDrawerTarget.framework_id) {
        try {
          const sourceFramework = frameworks.find((f) => f.id === data.frameworkId);
          const autoName = sourceFramework?.name || "Custom Framework";
          const { id: clonedId } = await cloneFramework(data.frameworkId, autoName, organizationId);
          await assignFrameworkToPeriod(periodDrawerTarget.id, clonedId);
          periods.applyPeriodPatch({ id: periodDrawerTarget.id, framework_id: clonedId });
          try {
            await freezePeriodSnapshot(periodDrawerTarget.id);
          } catch {
            // Non-fatal: jury flow will freeze lazily on first load
          }
        } catch {
          // Non-fatal: period was updated, framework assignment failed
          // User can assign from Outcomes page
        }
      }
  ```

  Delete the entire block. The edit branch should then end with the `throw` for name errors:
  ```js
      const result = await periods.handleUpdatePeriod({
        id: periodDrawerTarget.id,
        name: data.name,
        description: data.description,
        start_date: data.start_date,
        end_date: data.end_date,
        is_locked: data.is_locked,
        is_visible: data.is_visible,
      });
      if (result && !result.ok && result.fieldErrors?.name) {
        throw new Error(result.fieldErrors.name);
      }
  ```

- [ ] **Step 6: Clean up `handleSavePeriod` — remove criteria copy block (create mode)**

  Find in the create (`else`) branch (~lines 470–479):
  ```js
      if (result?.ok && result?.id && data.copyCriteriaFromPeriodId) {
        try {
          const sourceRows = await listPeriodCriteria(data.copyCriteriaFromPeriodId);
          if (sourceRows.length > 0) {
            await savePeriodCriteria(result.id, sourceRows);
          }
        } catch {
          // Criteria copy failure is non-fatal; period was created successfully
        }
      }
  ```

  Delete the entire block.

- [ ] **Step 7: Remove PeriodCriteriaDrawer from the JSX (~lines 1008–1022)**

  Find and remove:
  ```jsx
        {/* Criteria summary drawer */}
        <PeriodCriteriaDrawer
          open={criteriaDrawerOpen}
          onClose={() => setCriteriaDrawerOpen(false)}
          period={criteriaDrawerPeriod}
          criteria={criteriaDrawerCriteria}
          isLocked={criteriaDrawerPeriod?.is_locked}
          otherPeriods={[]}
          onApplyTemplate={() => { setCriteriaDrawerOpen(false); onNavigate?.("criteria"); }}
          onCopyFromPeriod={() => { setCriteriaDrawerOpen(false); onNavigate?.("criteria"); }}
          onEditCriteria={() => { setCriteriaDrawerOpen(false); onNavigate?.("criteria"); }}
          onClearCriteria={() => { setCriteriaDrawerOpen(false); onNavigate?.("criteria"); }}
          onRenamePeriod={(p) => { setCriteriaDrawerOpen(false); openEditDrawer(p); }}
          onDeletePeriod={(p) => { setCriteriaDrawerOpen(false); setDeletePeriodTarget(p); }}
        />
  ```

- [ ] **Step 8: Remove `frameworks`, `onNavigateToCriteria`, `onNavigateToOutcomes` from AddEditPeriodDrawer usage (~lines 998–1007)**

  Find:
  ```jsx
        <AddEditPeriodDrawer
          open={periodDrawerOpen}
          onClose={() => setPeriodDrawerOpen(false)}
          period={periodDrawerTarget}
          onSave={handleSavePeriod}
          allPeriods={periodList}
          frameworks={frameworks}
          onNavigateToCriteria={() => onNavigate?.("criteria")}
          onNavigateToOutcomes={() => onNavigate?.("outcomes")}
        />
  ```

  Replace with:
  ```jsx
        <AddEditPeriodDrawer
          open={periodDrawerOpen}
          onClose={() => setPeriodDrawerOpen(false)}
          period={periodDrawerTarget}
          onSave={handleSavePeriod}
          allPeriods={periodList}
        />
  ```

- [ ] **Step 9: Verify build passes**

  ```bash
  npm run build 2>&1 | tail -30
  ```

  Expected: no errors. No unused-variable warnings for removed imports.

---

### Task 4: AddEditPeriodDrawer — Strip to metadata only, add info banner

**Files:**
- Modify: `src/admin/drawers/AddEditPeriodDrawer.jsx`

- [ ] **Step 1: Update the file header comment and imports — remove dead lucide icons and FrameworkPickerModal, add FbAlert**

  Find the current imports block:
  ```js
  // src/admin/drawers/AddEditPeriodDrawer.jsx
  // Drawer: add or edit an evaluation period.
  //
  // Props:
  //   open              — boolean
  //   onClose           — () => void
  //   period            — null (add) or period object (edit)
  //   onSave            — (data) => Promise<void>
  //   allPeriods        — array of all periods (for "Copy Criteria From" in add mode)
  //   onNavigateToCriteria — () => void

  import { useState, useEffect } from "react";
  import {
    AlertCircle,
    Lock,
    Unlock,
    Eye,
    EyeOff,
    Copy,
    BarChart2,
    ChevronRight,
    BadgeCheck,
    Icon,
  } from "lucide-react";
  import Drawer from "@/shared/ui/Drawer";
  import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
  import CustomSelect from "@/shared/ui/CustomSelect";
  import { getPeriodCounts } from "@/shared/api";
  import useShakeOnError from "@/shared/hooks/useShakeOnError";
  import { formatDate } from "@/shared/lib/dateUtils";
  import FrameworkPickerModal from "../modals/FrameworkPickerModal";
  ```

  Replace with:
  ```js
  // src/admin/drawers/AddEditPeriodDrawer.jsx
  // Drawer: add or edit an evaluation period.
  //
  // Props:
  //   open        — boolean
  //   onClose     — () => void
  //   period      — null (add) or period object (edit)
  //   onSave      — (data) => Promise<void>
  //   allPeriods  — array of all periods (for duplicate-name check in edit mode)

  import { useState, useEffect } from "react";
  import { AlertCircle, Icon } from "lucide-react";
  import Drawer from "@/shared/ui/Drawer";
  import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
  import CustomSelect from "@/shared/ui/CustomSelect";
  import FbAlert from "@/shared/ui/FbAlert";
  import { getPeriodCounts } from "@/shared/api";
  import useShakeOnError from "@/shared/hooks/useShakeOnError";
  import { formatDate } from "@/shared/lib/dateUtils";
  ```

- [ ] **Step 2: Remove dead props and state from the component definition**

  Find:
  ```js
  export default function AddEditPeriodDrawer({
    open,
    onClose,
    period,
    onSave,
    allPeriods = [],
    frameworks = [],
    onNavigateToCriteria,
    onNavigateToOutcomes,
  }) {
    const isEdit = !!period;

    const [formName, setFormName] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formStartDate, setFormStartDate] = useState("");
    const [formEndDate, setFormEndDate] = useState("");
    const [formIsLocked, setFormIsLocked] = useState("open");
    const [formIsVisible, setFormIsVisible] = useState("visible");
    const [formCopyCriteriaFrom, setFormCopyCriteriaFrom] = useState("");
    const [formFrameworkId, setFormFrameworkId] = useState(null);
    const [formFrameworkName, setFormFrameworkName] = useState("");
    const [fwPickerOpen, setFwPickerOpen] = useState(false);
  ```

  Replace with:
  ```js
  export default function AddEditPeriodDrawer({
    open,
    onClose,
    period,
    onSave,
    allPeriods = [],
  }) {
    const isEdit = !!period;

    const [formName, setFormName] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formStartDate, setFormStartDate] = useState("");
    const [formEndDate, setFormEndDate] = useState("");
    const [formIsLocked, setFormIsLocked] = useState("open");
    const [formIsVisible, setFormIsVisible] = useState("visible");
  ```

- [ ] **Step 3: Remove dead state initializations from the useEffect**

  Find within the `useEffect` (lines ~74–99):
  ```js
    setFormCopyCriteriaFrom("");
    setFormFrameworkId(period?.framework_id ?? null);
    setFormFrameworkName(
      period?.framework_id ? (frameworks.find((f) => f.id === period.framework_id)?.name || "") : ""
    );
  ```

  Delete those three lines. The useEffect body should now be:
  ```js
  useEffect(() => {
    if (!open) return;
    setFormName(period?.name ?? "");
    setFormDescription(period?.description ?? "");
    setFormStartDate(period?.start_date ? period.start_date.slice(0, 10) : "");
    setFormEndDate(period?.end_date ? period.end_date.slice(0, 10) : "");
    setFormIsLocked(period?.is_locked ? "locked" : "open");
    setFormIsVisible(period?.is_visible === false ? "hidden" : "visible");
    setSaveError("");
    setNameError("");
    setSaving(false);
    setCounts(null);

    if (isEdit && period?.id) {
      setCountsLoading(true);
      getPeriodCounts(period.id)
        .then(setCounts)
        .catch(() => setCounts(null))
        .finally(() => setCountsLoading(false));
    }
  }, [open, period?.id]);
  ```

- [ ] **Step 4: Remove dead computed values**

  Find and delete these three lines (they appear right after the useEffects):
  ```js
    const criteriaItems = Array.isArray(period?.criteria_config) ? period.criteria_config : [];

    const copyFromOptions = [
      { value: "", label: "None — start fresh" },
      ...allPeriods
        .filter((p) => p.id !== period?.id)
        .map((p) => ({ value: p.id, label: p.name })),
    ];

    const platformChips = frameworks.filter((f) => !f.organization_id);
  ```

- [ ] **Step 5: Simplify `handleSave` — remove framework and criteria-copy fields**

  Find:
  ```js
    const handleSave = async () => {
      if (!formName.trim() || nameError) return;
      setSaveError("");
      setSaving(true);
      try {
        await onSave?.({
          name: formName.trim(),
          description: formDescription.trim() || null,
          start_date: formStartDate || null,
          end_date: formEndDate || null,
          is_locked: formIsLocked === "locked",
          is_visible: formIsVisible === "visible",
          ...(!isEdit && formCopyCriteriaFrom ? { copyCriteriaFromPeriodId: formCopyCriteriaFrom } : {}),
          frameworkId: formFrameworkId || null,
        });
        onClose();
      } catch (e) {
        setSaveError(e?.message || "Something went wrong.");
      } finally {
        setSaving(false);
      }
    };
  ```

  Replace with:
  ```js
    const handleSave = async () => {
      if (!formName.trim() || nameError) return;
      setSaveError("");
      setSaving(true);
      try {
        await onSave?.({
          name: formName.trim(),
          description: formDescription.trim() || null,
          start_date: formStartDate || null,
          end_date: formEndDate || null,
          is_locked: formIsLocked === "locked",
          is_visible: formIsVisible === "visible",
        });
        onClose();
      } catch (e) {
        setSaveError(e?.message || "Something went wrong.");
      } finally {
        setSaving(false);
      }
    };
  ```

- [ ] **Step 6: Replace the Add-mode "Scoring Setup" section with "Evaluation Settings" + info banner**

  Find the entire block (~lines 276–408):
  ```jsx
        {/* ── ADD MODE: SCORING SETUP ── */}
        {!isEdit && (
          <div className="fs-section">
            <div className="fs-section-header">
              <div className="fs-section-title">Scoring Setup</div>
            </div>
            ...
          </div>
        )}
  ```

  (The block ends just before `{/* ── EDIT MODE: EVALUATION SETTINGS ── */}`.)

  Replace the entire `{!isEdit && (...)}` block with:
  ```jsx
        {/* ── ADD MODE: EVALUATION SETTINGS ── */}
        {!isEdit && (
          <div className="fs-section">
            <div className="fs-section-header">
              <div className="fs-section-title">Evaluation Settings</div>
            </div>

            <div className="fs-field">
              <label className="fs-field-label">Evaluation Lock</label>
              <CustomSelect
                value={formIsLocked}
                onChange={setFormIsLocked}
                options={LOCK_OPTIONS}
                disabled={saving}
                ariaLabel="Evaluation lock"
              />
            </div>

            <div className="fs-field">
              <label className="fs-field-label">Visibility</label>
              <CustomSelect
                value={formIsVisible}
                onChange={setFormIsVisible}
                options={VISIBILITY_OPTIONS}
                disabled={saving}
                ariaLabel="Visibility"
              />
            </div>
          </div>
        )}
  ```

- [ ] **Step 7: Remove the Edit-mode "Framework" section**

  Find and delete the entire block (~lines 447–551):
  ```jsx
        {/* ── EDIT MODE: FRAMEWORK ── */}
        {isEdit && (
          <div className="fs-section">
            <div className="fs-section-header">
              <div className="fs-section-title">Framework</div>
            </div>
            ...
          </div>
        )}
  ```

  (The block ends just before `{/* ── EDIT MODE: SCORING CRITERIA ── */}`.)

- [ ] **Step 8: Remove the Edit-mode "Scoring Criteria" section**

  Find and delete the entire block (~lines 553–598):
  ```jsx
        {/* ── EDIT MODE: SCORING CRITERIA ── */}
        {isEdit && (
          <div className="fs-section">
            <div className="fs-section-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div className="fs-section-title">Scoring Criteria</div>
              ...
            </div>
            ...
          </div>
        )}
  ```

  (The block ends just before `{/* ── EDIT MODE: OVERVIEW ── */}`.)

- [ ] **Step 9: Add the info banner (Add mode only) at the end of the drawer body, before the footer**

  Find the closing of the drawer body — the `</div>` that closes `<div className="fs-drawer-body">`. It appears just before the `{/* ── Footer ── */}` comment.

  Add the banner as the last child inside `fs-drawer-body`, only in Add mode:

  ```jsx
        {/* ── ADD MODE: INFO BANNER ── */}
        {!isEdit && (
          <FbAlert variant="info" style={{ marginTop: 4 }}>
            After creating, use the Criteria Set and Framework columns in the table
            to configure scoring or copy criteria from another period.
          </FbAlert>
        )}
      </div>
      {/* ── Footer ── */}
  ```

- [ ] **Step 10: Remove the FrameworkPickerModal render from JSX (~lines 653–661)**

  Find and delete:
  ```jsx
        <FrameworkPickerModal
          open={fwPickerOpen}
          onClose={() => setFwPickerOpen(false)}
          frameworks={frameworks}
          onSelect={(fw) => {
            setFormFrameworkId(fw.id);
            setFormFrameworkName(fw.name);
          }}
        />
  ```

- [ ] **Step 11: Verify build passes and drawer works**

  ```bash
  npm run build 2>&1 | tail -30
  ```

  Then start dev server, open Add Period drawer: verify it shows Period Details → Evaluation Settings → info banner at bottom. Open Edit Period drawer: verify it shows Period Details → Evaluation Settings → Overview (no Framework section, no Scoring Criteria section).

---

### Task 5: Delete FrameworkPickerModal

**Files:**
- Delete: `src/admin/modals/FrameworkPickerModal.jsx`

- [ ] **Step 1: Confirm no remaining imports**

  ```bash
  grep -r "FrameworkPickerModal" src/
  ```

  Expected output: nothing (zero matches). If any file still imports it, fix that first.

- [ ] **Step 2: Delete the file**

  ```bash
  rm src/admin/modals/FrameworkPickerModal.jsx
  ```

- [ ] **Step 3: Final build verification**

  ```bash
  npm run build 2>&1 | tail -30
  ```

  Expected: clean build with no errors or warnings about missing modules.

- [ ] **Step 4: Run tests**

  ```bash
  npm test -- --run 2>&1 | tail -30
  ```

  Expected: all tests pass (no test references FrameworkPickerModal or PeriodCriteriaDrawer).

---

## Self-Review Against Spec

**Spec coverage:**

| Spec requirement | Task |
|-----------------|------|
| Criteria Set cell: badge + arrow/plus nav button, both navigate | Task 2 Step 2 |
| Framework cell: badge + arrow/plus nav button, both navigate | Task 2 Step 3 |
| Navigation calls `onCurrentSemesterChange(id)` before `onNavigate()` | Task 2 Steps 2–3 |
| Badge click replaces PeriodCriteriaDrawer (not opens it) | Task 2 + Task 3 |
| Empty state shows "Not set" + "+" button | Task 2 Steps 2–3 |
| `PeriodCriteriaDrawer` removed from PeriodsPage | Task 3 Step 7 |
| AddEditPeriodDrawer: Scoring Setup removed from Add mode | Task 4 Step 6 |
| AddEditPeriodDrawer: Framework section removed from Edit mode | Task 4 Step 7 |
| AddEditPeriodDrawer: Scoring Criteria section removed from Edit mode | Task 4 Step 8 |
| AddEditPeriodDrawer: Evaluation Settings added to Add mode | Task 4 Step 6 |
| AddEditPeriodDrawer: info banner in Add mode | Task 4 Step 9 |
| `FrameworkPickerModal` deleted | Task 5 |
| CriteriaPage and OutcomesPage: no changes | n/a — confirmed not touched |
| CSS: nav button + cell wrapper styles | Task 1 |

**Placeholder scan:** None — all code blocks are complete.

**Type consistency:** `onCurrentSemesterChange` and `onNavigate` are called the same way in both cells (Tasks 2–3). `ArrowRight` and `Plus` icons added in Task 2 Step 1 are used consistently in Steps 2–3.
