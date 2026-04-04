# Framework Threshold Inline Edit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to set a per-framework attainment threshold via an inline edit row in the Outcomes page framework chip bar, with the saved value propagating to all analytics charts.

**Architecture:** `AdminLayout` loads frameworks alongside criteria/outcomes and derives `frameworkThreshold`; it passes `frameworks` + a refresh callback to `OutcomesPage` and `threshold` to `AnalyticsPage`. `OutcomesPage` renders dynamic framework chips with an inline threshold edit row. Each chart component drops its local `const ATTAINMENT_THRESHOLD = 70` in favour of a `threshold` prop (default `70`).

**Tech Stack:** React, Supabase PostgREST (no new RPC — existing RLS covers updates), recharts (existing)

---

## File Map

| File | Change |
|---|---|
| `src/shared/api/admin/frameworks.js` | Add `updateFramework(id, payload)` |
| `src/shared/api/admin/index.js` | Re-export `updateFramework` |
| `src/shared/api/index.js` | Re-export `updateFramework` |
| `src/admin/layout/AdminLayout.jsx` | Load frameworks on period change; derive `frameworkThreshold`; pass props to OutcomesPage + AnalyticsPage |
| `src/admin/pages/OutcomesPage.jsx` | Accept `frameworks` + `onFrameworksChange` props; render dynamic chips; add threshold inline edit state + UI |
| `src/admin/pages/AnalyticsPage.jsx` | Accept `threshold` prop (default 70); remove local `ATTAINMENT_THRESHOLD`; forward to charts + `buildAttainmentCards` |
| `src/charts/AttainmentRateChart.jsx` | Accept `threshold` prop; remove local constant |
| `src/charts/ThresholdGapChart.jsx` | Accept `threshold` prop; remove local constant |
| `src/charts/OutcomeByGroupChart.jsx` | Accept `threshold` prop; remove local constant |
| `src/charts/AttainmentTrendChart.jsx` | Accept `threshold` prop; remove local constant |
| `src/charts/ProgrammeAveragesChart.jsx` | Accept `threshold` prop; remove local constant |
| `src/charts/GroupAttainmentHeatmap.jsx` | Accept `threshold` prop; remove local constant |

---

## Task 1: Add `updateFramework` to API

**Files:**
- Modify: `src/shared/api/admin/frameworks.js`
- Modify: `src/shared/api/admin/index.js`
- Modify: `src/shared/api/index.js`

- [ ] **Step 1: Add `updateFramework` to frameworks.js**

Open `src/shared/api/admin/frameworks.js` and add after the `createFramework` function (after line 24):

```js
export async function updateFramework(id, payload) {
  const { data, error } = await supabase
    .from("frameworks")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Re-export from admin index**

Open `src/shared/api/admin/index.js`. Find the frameworks export block (it currently exports `listFrameworks`, `createFramework`, `deleteFramework`, etc.). Add `updateFramework` to the named exports list from `"./frameworks"`.

Current block looks like:
```js
  listFrameworks,
  createFramework,
  deleteFramework,
  // ... other framework exports
} from "./frameworks";
```

Add `updateFramework,` to the list.

- [ ] **Step 3: Re-export from shared api index**

Open `src/shared/api/index.js`. In the same frameworks re-export block, add `updateFramework` alongside the existing framework exports.

- [ ] **Step 4: Verify exports resolve**

Run:
```bash
npm run build 2>&1 | grep -i "updateFramework\|error" | head -20
```

Expected: no errors mentioning `updateFramework`.

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/admin/frameworks.js src/shared/api/admin/index.js src/shared/api/index.js
git commit -m "feat(api): add updateFramework to frameworks API"
```

---

## Task 2: Load frameworks in AdminLayout

**Files:**
- Modify: `src/admin/layout/AdminLayout.jsx`

- [ ] **Step 1: Add frameworks state**

In `AdminLayout.jsx`, alongside the existing `criteriaConfig` and `outcomeConfig` state declarations (around line 156), add:

```js
const [frameworks, setFrameworks] = useState([]);
```

- [ ] **Step 2: Load frameworks on period change**

Find the existing `useEffect` that loads `criteriaConfig` and `outcomeConfig` (around line 158). Extend it to also load frameworks. Replace the current effect body with:

```js
useEffect(() => {
  if (!selectedPeriodId || !activeOrganization?.id) {
    setCriteriaConfig([]);
    setOutcomeConfig([]);
    setFrameworks([]);
    return;
  }
  let alive = true;
  (async () => {
    try {
      const { listPeriodCriteria, listPeriodOutcomes, listFrameworks } = await import("../../shared/api");
      const { getActiveCriteria } = await import("../../shared/criteria/criteriaHelpers");
      const [criteriaRows, outcomeRows, frameworkRows] = await Promise.all([
        listPeriodCriteria(selectedPeriodId),
        listPeriodOutcomes(selectedPeriodId),
        listFrameworks(activeOrganization.id),
      ]);
      if (!alive) return;
      setCriteriaConfig(getActiveCriteria(criteriaRows));
      setOutcomeConfig(outcomeRows.map((o) => ({
        id: o.id,
        code: o.code,
        desc_en: o.label || o.description || "",
        desc_tr: o.description || "",
      })));
      setFrameworks(frameworkRows);
    } catch {
      if (alive) { setCriteriaConfig([]); setOutcomeConfig([]); setFrameworks([]); }
    }
  })();
  return () => { alive = false; };
}, [selectedPeriodId, activeOrganization?.id]);
```

- [ ] **Step 3: Add refresh callback and derive frameworkThreshold**

After the `frameworks` state declaration, add a memoised callback and derived value:

```js
const reloadFrameworks = useCallback(async () => {
  if (!activeOrganization?.id) return;
  try {
    const { listFrameworks } = await import("../../shared/api");
    const rows = await listFrameworks(activeOrganization.id);
    setFrameworks(rows);
  } catch {}
}, [activeOrganization?.id]);

const frameworkThreshold = frameworks[0]?.default_threshold ?? 70;
```

- [ ] **Step 4: Pass props to OutcomesPage**

Find where `<OutcomesPage` is rendered in `AdminLayout.jsx` (around line 488). Add two props:

```jsx
<OutcomesPage
  // ... existing props unchanged ...
  frameworks={frameworks}
  onFrameworksChange={reloadFrameworks}
/>
```

- [ ] **Step 5: Pass threshold to AnalyticsPage**

Find where `<AnalyticsPage` is rendered in `AdminLayout.jsx` (around line 375). Add:

```jsx
<AnalyticsPage
  // ... existing props unchanged ...
  threshold={frameworkThreshold}
/>
```

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | grep -i "error\|warning" | grep -v "node_modules" | head -20
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/admin/layout/AdminLayout.jsx
git commit -m "feat(layout): load frameworks and derive threshold for analytics"
```

---

## Task 3: Threshold inline edit UI in OutcomesPage

**Files:**
- Modify: `src/admin/pages/OutcomesPage.jsx`

The current chip bar (lines 347–384) is hardcoded to show a single "MÜDEK" chip. We will make it dynamic and add the threshold edit row.

- [ ] **Step 1: Accept new props**

Find the `OutcomesPage` function signature (around line 190). It currently accepts props from `useManagePeriods` plus a few others. Add the two new props:

```js
export default function OutcomesPage({
  // ... existing params ...
  frameworks = [],
  onFrameworksChange,
}) {
```

- [ ] **Step 2: Add threshold edit state**

After the existing `[openMenuId, setOpenMenuId]` state (around line 252), add:

```js
const [editingThresholdFor, setEditingThresholdFor] = useState(null);
const [thresholdValue, setThresholdValue] = useState("");
const [thresholdSaving, setThresholdSaving] = useState(false);
const [thresholdError, setThresholdError] = useState("");
```

- [ ] **Step 3: Add Escape key handler for threshold edit**

After the existing `useEffect` for menu close-on-click-outside (around line 255), add:

```js
useEffect(() => {
  if (!editingThresholdFor) return;
  const handler = (e) => {
    if (e.key === "Escape") setEditingThresholdFor(null);
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}, [editingThresholdFor]);
```

- [ ] **Step 4: Add save handler**

After the `handleDeleteConfirm` function (around line 310), add:

```js
const handleThresholdSave = async (frameworkId) => {
  const val = Number(thresholdValue);
  if (Number.isNaN(val) || val < 0 || val > 100) {
    setThresholdError("Enter a value between 0 and 100.");
    return;
  }
  setThresholdSaving(true);
  setThresholdError("");
  try {
    const { updateFramework } = await import("../../shared/api");
    await updateFramework(frameworkId, { default_threshold: val });
    setEditingThresholdFor(null);
    onFrameworksChange?.();
    _toast.success("Threshold updated");
  } catch (err) {
    setThresholdError(err?.message || "Failed to save. Try again.");
  } finally {
    setThresholdSaving(false);
  }
};
```

- [ ] **Step 5: Replace hardcoded chip bar with dynamic chips**

Find the `{/* Framework selector bar */}` block (lines 347–384). Replace the entire block with:

```jsx
{/* Framework selector bar */}
<div className="fw-context-bar">
  <div className="fw-context-label">Framework</div>
  <div className="fw-chips">
    {frameworks.length === 0 ? (
      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No frameworks</span>
    ) : (
      frameworks.map((fw) => {
        const isEditing = editingThresholdFor === fw.id;
        return (
          <div key={fw.id} className="fw-chip-wrap">
            <button className="fw-chip active">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="fw-chip-icon">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 1.657 2.686 3 6 3s6-1.343 6-3v-5" />
              </svg>
              {fw.name}
              <span className="fw-chip-count">{outcomeConfig.length}</span>
            </button>
            <button
              className="fw-chip-options"
              onClick={(e) => e.stopPropagation()}
              title="Framework options"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                <circle cx="12" cy="19" r="1.5" fill="currentColor" />
              </svg>
            </button>
            <div className="fw-chip-menu">
              <button
                className="fw-chip-menu-item"
                onClick={(e) => { e.stopPropagation(); openEditor(); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit Framework
              </button>
              <div className="fw-chip-menu-sep" />
              <button
                className="fw-chip-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  setThresholdValue(String(fw.default_threshold ?? 70));
                  setThresholdError("");
                  setEditingThresholdFor(isEditing ? null : fw.id);
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                Set Threshold
                <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600 }}>
                  {fw.default_threshold ?? 70}%
                </span>
              </button>
            </div>

            {/* Inline threshold edit row */}
            {isEditing && (
              <div className="fw-threshold-edit-row" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, padding: "6px 8px", background: "var(--surface-2)", borderRadius: 6, border: "1px solid var(--border)" }}>
                <label style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                  Threshold:
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={thresholdValue}
                  onChange={(e) => { setThresholdValue(e.target.value); setThresholdError(""); }}
                  disabled={thresholdSaving}
                  style={{ width: 64, padding: "3px 8px", fontSize: 13, borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
                  autoFocus
                />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>%</span>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ padding: "3px 12px", fontSize: 12 }}
                  onClick={() => handleThresholdSave(fw.id)}
                  disabled={thresholdSaving}
                >
                  {thresholdSaving ? "Saving…" : "Save"}
                </button>
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16, lineHeight: 1, padding: "0 2px" }}
                  onClick={() => setEditingThresholdFor(null)}
                  aria-label="Cancel"
                  disabled={thresholdSaving}
                >
                  ×
                </button>
                {thresholdError && (
                  <span style={{ fontSize: 11, color: "var(--danger)" }}>{thresholdError}</span>
                )}
              </div>
            )}
          </div>
        );
      })
    )}
  </div>
</div>
```

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | grep -i "error" | grep -v "node_modules" | head -20
```

Expected: no errors.

- [ ] **Step 7: Smoke test in browser**

Start dev server (`npm run dev`), navigate to Outcomes page, click the ⋮ options on a framework chip, click "Set Threshold". Verify the inline row appears below the chip with a pre-filled value. Type a new value, click Save. Verify the threshold hint in the menu updates.

- [ ] **Step 8: Commit**

```bash
git add src/admin/pages/OutcomesPage.jsx
git commit -m "feat(outcomes): add threshold inline edit to framework chip menu"
```

---

## Task 4: Thread threshold through AnalyticsPage

**Files:**
- Modify: `src/admin/pages/AnalyticsPage.jsx`

- [ ] **Step 1: Accept threshold prop in AnalyticsPage**

Find the `export default function AnalyticsPage({` signature (line 242). Add `threshold = 70` to the destructured props:

```js
export default function AnalyticsPage({
  dashboardStats = [],
  submittedData = [],
  overviewMetrics,
  lastRefresh,
  loading,
  error,
  periodName,
  selectedPeriodId,
  semesterOptions,
  trendSemesterIds,
  onTrendSelectionChange,
  trendData,
  outcomeTrendData,
  outcomeTrendLoading,
  outcomeTrendError,
  criteriaConfig,
  outcomeConfig,
  threshold = 70,
}) {
```

- [ ] **Step 2: Remove local ATTAINMENT_THRESHOLD constant**

Delete line 23:
```js
const ATTAINMENT_THRESHOLD = 70;
```

- [ ] **Step 3: Pass threshold to buildAttainmentCards**

Find the call to `buildAttainmentCards` in the component body (it's called inline in the JSX or in a useMemo). Update the function to accept and use `threshold`.

At the top of the `buildAttainmentCards` function (line 51), it uses `ATTAINMENT_THRESHOLD` in 3 places. Update the function signature to accept threshold:

```js
function buildAttainmentCards(submittedData, criteria = [], deltaRows = [], threshold = 70) {
```

Then replace every usage of `ATTAINMENT_THRESHOLD` inside `buildAttainmentCards` with `threshold`.

Also replace the two literal `70` and `60` in the bar fill style block (lines 474–478):
```jsx
background: attRate >= threshold
  ? "var(--status-met-text)"
  : attRate >= 60
  ? "var(--status-borderline-text)"
  : "var(--status-not-met-text)",
```

- [ ] **Step 4: Pass threshold at call site**

Find where `buildAttainmentCards` is called in the component and pass `threshold`:

```js
buildAttainmentCards(submittedData, criteria, deltaRows, threshold)
```

- [ ] **Step 5: Forward threshold to chart components**

Search the `AnalyticsPage` JSX for each chart component and add `threshold={threshold}`:

- `<AttainmentRateChart ... threshold={threshold} />`
- `<ThresholdGapChart ... threshold={threshold} />`
- `<OutcomeByGroupChart ... threshold={threshold} />`
- `<AttainmentTrendChart ... threshold={threshold} />`
- `<ProgrammeAveragesChart ... threshold={threshold} />`
- `<GroupAttainmentHeatmap ... threshold={threshold} />`

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | grep -i "error" | grep -v "node_modules" | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/admin/pages/AnalyticsPage.jsx
git commit -m "feat(analytics): accept threshold prop, remove hardcoded ATTAINMENT_THRESHOLD"
```

---

## Task 5: Update chart components to use threshold prop

**Files:**
- Modify: `src/charts/AttainmentRateChart.jsx`
- Modify: `src/charts/ThresholdGapChart.jsx`
- Modify: `src/charts/OutcomeByGroupChart.jsx`
- Modify: `src/charts/AttainmentTrendChart.jsx`
- Modify: `src/charts/ProgrammeAveragesChart.jsx`
- Modify: `src/charts/GroupAttainmentHeatmap.jsx`

Apply the same pattern to each file:

1. Delete the `const ATTAINMENT_THRESHOLD = 70;` line at the top
2. Add `threshold = 70` to the component's props destructuring
3. Replace every `ATTAINMENT_THRESHOLD` reference in the function body with `threshold`

### AttainmentRateChart.jsx

- [ ] **Step 1: Update AttainmentRateChart**

Current signature:
```js
export function AttainmentRateChart({ submittedData = [], criteria = [] }) {
```

New signature:
```js
export function AttainmentRateChart({ submittedData = [], criteria = [], threshold = 70 }) {
```

Delete line 8: `const ATTAINMENT_THRESHOLD = 70;`

Replace 5 occurrences of `ATTAINMENT_THRESHOLD`:
- Line 34: `vals.filter((v) => (v / max) * 100 >= threshold)`
- Line 45: `const isMet = pct != null && pct >= threshold;`
- Line 46: `const isBorderline = pct != null && pct >= 60 && pct < threshold;`
- Line 65: `style={{ left: \`${threshold}%\` }}`
- Line 66: `title={\`Target: ${threshold}%\`}`

### ThresholdGapChart.jsx

- [ ] **Step 2: Update ThresholdGapChart**

Current signature:
```js
export function ThresholdGapChart({ submittedData = [], criteria = [] }) {
```

New signature:
```js
export function ThresholdGapChart({ submittedData = [], criteria = [], threshold = 70 }) {
```

Delete line 9: `const ATTAINMENT_THRESHOLD = 70;`

Replace 3 occurrences of `ATTAINMENT_THRESHOLD`:
- Line 43: `vals.filter((v) => (v / max) * 100 >= threshold)`
- Line 45: `const gap = fmt1(attRate - threshold);`
- Line 103: Update the axis label: `<span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>{threshold}% threshold</span>`

### OutcomeByGroupChart.jsx

- [ ] **Step 3: Update OutcomeByGroupChart**

Find the component's props. Add `threshold = 70` to the destructured props.

Delete: `const ATTAINMENT_THRESHOLD = 70;`

Replace all `ATTAINMENT_THRESHOLD` with `threshold` (used as `y={threshold}` in a `<ReferenceLine>`).

### AttainmentTrendChart.jsx

- [ ] **Step 4: Update AttainmentTrendChart**

Find the component's props. Add `threshold = 70`.

Delete: `const ATTAINMENT_THRESHOLD = 70;`

Replace `ATTAINMENT_THRESHOLD` with `threshold` (used as `y={threshold}` in a `<ReferenceLine>`).

### ProgrammeAveragesChart.jsx

- [ ] **Step 5: Update ProgrammeAveragesChart**

Find the component's props. Add `threshold = 70`.

Delete: `const ATTAINMENT_THRESHOLD = 70;`

Replace `ATTAINMENT_THRESHOLD` with `threshold` (used as `y={threshold}` in a `<ReferenceLine>`).

### GroupAttainmentHeatmap.jsx

- [ ] **Step 6: Update GroupAttainmentHeatmap**

Find the component's props. Add `threshold = 70`.

Delete: `const ATTAINMENT_THRESHOLD = 70;`

Replace `ATTAINMENT_THRESHOLD` with `threshold` in `getCellClass`:
```js
function getCellClass(pct, threshold) {
  if (pct == null) return "";
  if (pct >= 80) return "ga-cell-high";
  if (pct >= threshold) return "ga-cell-met";
  if (pct >= 60) return "ga-cell-borderline";
  return "ga-cell-not-met";
}
```

Update every call to `getCellClass` inside the component to pass `threshold`:
```js
getCellClass(pct, threshold)
```

- [ ] **Step 7: Verify build and zero ATTAINMENT_THRESHOLD occurrences**

```bash
npm run build 2>&1 | grep -i "error" | grep -v "node_modules" | head -20
grep -rn "ATTAINMENT_THRESHOLD" src/
```

Expected: build passes, grep returns no results.

- [ ] **Step 8: Commit**

```bash
git add src/charts/AttainmentRateChart.jsx src/charts/ThresholdGapChart.jsx src/charts/OutcomeByGroupChart.jsx src/charts/AttainmentTrendChart.jsx src/charts/ProgrammeAveragesChart.jsx src/charts/GroupAttainmentHeatmap.jsx
git commit -m "refactor(charts): replace hardcoded ATTAINMENT_THRESHOLD with threshold prop"
```

---

## Task 6: End-to-end smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Navigate to admin → Outcomes page.

- [ ] **Step 2: Verify framework chip renders correctly**

Confirm the chip shows the framework name and the ⋮ menu contains "Set Threshold" with the current threshold value shown as a hint.

- [ ] **Step 3: Edit threshold**

Click ⋮ → Set Threshold. Inline row should appear. Change value to `75`. Click Save.
- Inline row collapses
- Menu hint updates to `75%`
- Toast "Threshold updated" appears

- [ ] **Step 4: Verify analytics reflect new threshold**

Navigate to Analytics tab. All charts that draw a threshold reference line should now show it at 75% instead of 70%.

- [ ] **Step 5: Verify fallback (no frameworks)**

Confirm analytics still renders if `frameworks` is empty — threshold defaults to 70 throughout.
