# Framework Threshold Inline Edit — Design Spec

**Date:** 2026-04-05
**Status:** Approved

---

## Problem

`ATTAINMENT_THRESHOLD = 70` is declared as an independent local constant in 7 separate files.
The `accreditation_frameworks.default_threshold` DB column exists but is never read back into
the UI, never passed to analytics, and has no edit surface.

---

## Goal

Allow admins to set a per-framework attainment threshold through the Outcomes page framework chip
menu. The saved value propagates to all analytics charts that use `ATTAINMENT_THRESHOLD`,
replacing the 7 independent constants with a single prop-driven value.

---

## Scope

- **In scope:** inline threshold edit UI on the framework chip, API update call, data-flow
  wire-up from DB → OutcomesPage → AnalyticsPage → chart components
- **Out of scope:** full framework metadata editing, per-chart override thresholds,
  any other framework fields

---

## Architecture

### Layer 1 — API

Add `updateFramework(id, payload)` to `src/shared/api/admin/frameworks.js`.

```js
// src/shared/api/admin/frameworks.js
export async function updateFramework(id, payload) {
  // callAdminRpcV2('rpc_admin_framework_update', { framework_id: id, ...payload })
}
```

This requires a new DB RPC `rpc_admin_framework_update` that accepts `framework_id` and
`default_threshold`, asserts tenant-admin auth, and updates the row.

### Layer 2 — OutcomesPage inline edit UI

**Chip menu change:** Add a "Set Threshold" item to the existing chip context menu,
between "Edit Framework" and the delete separator.

**Edit state:** A single local state variable `editingThresholdFor` (framework id or null)
tracks which chip is in edit mode. Only one framework can be in edit mode at a time;
opening another chip's menu auto-cancels any open edit.

**Inline row behavior:**

- Appears immediately below the chip strip when `editingThresholdFor` matches a chip
- Content: label "Threshold:", `<input type="number" min="0" max="100" step="1">` pre-filled
  with current `default_threshold`, **Save** button, **×** cancel icon
- Save: calls `updateFramework`, refreshes framework list, clears `editingThresholdFor`
- Cancel (× button or Escape key): clears `editingThresholdFor` without saving
- Pending save shows a brief loading state on the Save button; errors surface inline

### Layer 3 — Analytics wire-up

The active framework object (already available in OutcomesPage as `selectedFramework`)
includes `default_threshold`. This value is forwarded to `AnalyticsPage` as a `threshold`
prop (or derived via the hook that loads analytics data).

Each chart component that currently declares `const ATTAINMENT_THRESHOLD = 70` will:

1. Accept a `threshold` prop
2. Default to `70` if undefined (backward safe)
3. Remove the local constant declaration

**Files to update:**

| File | Change |
|---|---|
| `src/admin/pages/AnalyticsPage.jsx` | Remove local `ATTAINMENT_THRESHOLD`; accept + forward `threshold` prop |
| `src/charts/AttainmentRateChart.jsx` | Replace constant with `threshold` prop |
| `src/charts/AttainmentTrendChart.jsx` | Replace constant with `threshold` prop |
| `src/charts/GroupAttainmentHeatmap.jsx` | Replace constant with `threshold` prop |
| `src/charts/OutcomeByGroupChart.jsx` | Replace constant with `threshold` prop |
| `src/charts/ThresholdGapChart.jsx` | Replace constant with `threshold` prop |
| `src/charts/ProgrammeAveragesChart.jsx` | Replace constant with `threshold` prop |

---

## DB Migration

A new migration file is required:

```sql
-- rpc_admin_framework_update
CREATE OR REPLACE FUNCTION rpc_admin_framework_update(
  framework_id UUID,
  default_threshold NUMERIC
) RETURNS void ...
```

The `default_threshold` column already exists — no schema change needed, only the RPC.

---

## UI States

| State | Behavior |
|---|---|
| Idle | Chip menu shows "Set Threshold" item with current threshold value as hint |
| Editing | Inline row visible below chip strip; chip strip height increases by one row |
| Saving | Save button shows spinner; input disabled |
| Error | Inline error message below input; row stays open |
| Success | Row collapses; framework list refreshes with new threshold |

---

## Non-Goals

- No popover or floating overlay
- No per-chart threshold overrides
- No validation beyond min/max range (0–100)
- No undo — save is immediate and permanent
