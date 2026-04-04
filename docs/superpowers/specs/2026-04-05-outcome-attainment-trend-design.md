# Outcome Attainment Trend Chart — Design Spec

**Date:** 2026-04-05
**Section:** Admin → Analytics → Continuous Improvement

---

## Problem

The existing `AttainmentTrendChart` tracks attainment at the **criterion level** (Technical, Written, Oral, Teamwork). Criteria and their outcome mappings change between evaluation periods, making direct period-over-period criterion comparison unreliable.

Accreditation bodies (MÜDEK, ABET) care about **outcome-level** attainment. Outcomes are stable across periods even when criteria evolve.

---

## Goal

Add a dual-line chart to the "Continuous Improvement" section that shows, per **programme outcome**, across **selected evaluation periods**:

- **Attainment rate** (primary, solid line): % of individual evaluations where the outcome's weighted score ≥ 70%
- **Average score** (secondary, dashed line): mean outcome score % across all evaluations

Both lines share the same color per outcome. Outcomes not measured in a period show a gap (no interpolation).

---

## Score Calculation

Each outcome's score for a single evaluation is computed from the criteria that map to it, using **normalized weights**:

```
outcome_score(eval, outcome) =
  Σ( criterion_normalized_pct(eval, c) × weight(c, outcome) )
  ─────────────────────────────────────────────────────────
  Σ( weight(c, outcome) )          [for all criteria c mapping to outcome]

where:
  criterion_normalized_pct = (raw_score / criterion.max_score) × 100
```

This keeps every outcome on a 0–100 scale regardless of how many criteria contribute.

**Attainment rate** for an outcome in a period:

```
attainment_rate = count(outcome_score ≥ 70) / count(all evaluations) × 100
```

This requires individual evaluation data — it cannot be derived from criterion averages alone.

---

## Architecture

### New API Function

**File:** `src/shared/api/admin/scores.js`
**Function:** `getOutcomeAttainmentTrends(periodIds)`

For each period:

1. Call `getScores(periodId)` — individual juror×project evaluations
2. Call `listPeriodCriteria(periodId)` — criteria with outcome mappings + weights
3. For each evaluation, for each outcome: compute normalized weighted score
4. Aggregate: `avg` (mean across all evaluations) and `attainmentRate` (% ≥ 70%)

Return shape:

```js
[
  {
    periodId: "uuid",
    periodName: "Spring 2025",
    nEvals: 24,
    outcomes: [
      { code: "1.2", label: "...", avg: 74.2, attainmentRate: 78 },
      { code: "9.1", label: "...", avg: 61.0, attainmentRate: 65 },
      // null avg/attainmentRate if outcome not measured in this period
    ]
  },
  ...
]
```

### New Dataset Builder

**File:** `src/admin/analytics/analyticsDatasets.js`
**Function:** `buildOutcomeAttainmentTrendDataset(trendData)`

Transforms API output into Recharts-compatible format:

```js
// rows: one entry per period
[
  {
    period: "Spring 2025",
    "1.2_att": 78,   "1.2_avg": 74.2,
    "9.1_att": 65,   "9.1_avg": 61.0,
    // null for outcomes not measured in this period
  },
  ...
]

// outcomeMeta: outcome display config
[
  { code: "1.2", label: "Adequate knowledge in mathematics...", color: "#6366F1" },
  { code: "9.1", label: "Oral communication effectiveness", color: "#EC4899" },
  ...
]
```

### New Chart Component

**File:** `src/charts/OutcomeAttainmentTrendChart.jsx`

Recharts `LineChart` with:

| Element | Spec |
|---|---|
| X-axis | Period names, chronological left→right |
| Y-axis | 0–100 (%), labeled "%" |
| Per outcome: attainment line | Solid, full opacity, `strokeWidth={2}` |
| Per outcome: average line | Dashed (`strokeDasharray="4 2"`), 50% opacity, same color |
| Reference line | Y=70, dashed gray, labeled "Attainment target (70%)" |
| Gaps | `connectNulls={false}` — no interpolation across missing periods |
| Tooltip | Outcome name, attainment %, avg %, contributing criteria keys, n |
| Legend | Outcome code + label; click to toggle both lines for that outcome |
| Color palette | 8-color set distinct from criterion colors (indigo, pink, teal, orange, violet, cyan, rose, emerald) |
| Container | `ResponsiveContainer` height 280px |

### Hook Changes

**File:** `src/admin/hooks/useAnalyticsData.js`

- Reuse existing `trendPeriodIds` state (already drives period selector UI)
- Add `getOutcomeAttainmentTrends(trendPeriodIds)` call alongside existing `getOutcomeTrends`
- Expose `outcomeTrendData` (raw API result) and loading state

### Page Integration

**File:** `src/admin/pages/AnalyticsPage.jsx`

In the "Continuous Improvement" section:

1. **Existing** `AttainmentTrendChart` (criterion-level) — kept unchanged, shows criterion detail
2. **New** `OutcomeAttainmentTrendChart` — added below or as a tab, shows outcome-level trends

Both share the same period selector (`trendPeriodIds`).

---

## Error & Edge Cases

| Case | Behavior |
|---|---|
| Outcome not mapped in a period | `null` values → gap in chart line |
| Period has 0 submitted evaluations | Excluded from trend data, gap shown |
| Only 1 period selected | Chart renders a single point (no line), tooltip still works |
| All weights for an outcome sum to 0 | Skip that outcome for that period (treat as unmapped) |

---

## Scope

### In scope

- `getOutcomeAttainmentTrends()` API function
- `buildOutcomeAttainmentTrendDataset()` dataset builder
- `OutcomeAttainmentTrendChart.jsx` chart component
- `useAnalyticsData` hook extension
- `AnalyticsPage` integration

### Out of scope

- DB migration (no new tables/RPCs needed)
- Changes to existing `AttainmentTrendChart`
- Export (XLSX/PDF) for the new chart
- Indirect vs direct outcome coverage type distinction

---

## Files Changed

| File | Change |
|---|---|
| `src/shared/api/admin/scores.js` | Add `getOutcomeAttainmentTrends()` |
| `src/shared/api/index.js` | Re-export new function |
| `src/admin/analytics/analyticsDatasets.js` | Add `buildOutcomeAttainmentTrendDataset()` |
| `src/charts/OutcomeAttainmentTrendChart.jsx` | New component |
| `src/admin/hooks/useAnalyticsData.js` | Add outcome trend data loading |
| `src/admin/pages/AnalyticsPage.jsx` | Integrate new chart into Continuous Improvement section |
