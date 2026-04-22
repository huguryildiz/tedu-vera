# Analytics Outcome Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded outcome labels in AnalyticsPage with dynamic `outcomeConfig` data and wire `coverage_type` (direct/indirect) from `period_criterion_outcome_maps` into the CoverageMatrix.

**Architecture:** Four-layer fix: (1) DB RPC preserves `coverage_type` across criteria saves, (2) `listPeriodCriteria` returns an `outcomeTypes` map per criterion, (3) `CoverageMatrix` reads `outcomeTypes` instead of assuming every mapped outcome is "direct", (4) `buildAttainmentCards` uses live `outcomeConfig` for labels instead of a hardcoded constant.

**Tech Stack:** React, Supabase PostgREST, PL/pgSQL, Supabase MCP

---

## File Map

| File | Change |
|---|---|
| `sql/migrations/009_audit.sql` | `rpc_admin_save_period_criteria` — preserve coverage_type via temp table |
| `src/shared/api/admin/scores.js` | `listPeriodCriteria` — also select `coverage_type`, return `outcomeTypes` map |
| `src/charts/CoverageMatrix.jsx` | `getCoverageType` reads `outcomeTypes`; summary counts indirect separately |
| `src/admin/pages/AnalyticsPage.jsx` | `buildAttainmentCards` accepts `outcomesLookup`; legend gets Indirect chip |

---

## Task 1: Preserve coverage_type in RPC across criteria saves

**Files:**
- Modify: `sql/migrations/009_audit.sql` (function `rpc_admin_save_period_criteria`, around line 610)

The current RPC deletes all `period_criterion_outcome_maps` then re-inserts them from `criteria[].outcomes: string[]`, losing `coverage_type`. Fix: snapshot `(crit_key, outcome_code, coverage_type)` before deleting, restore after re-inserting.

- [ ] **Step 1: Locate the DELETE block in `rpc_admin_save_period_criteria`**

In `sql/migrations/009_audit.sql`, find lines ~610–613:
```sql
  -- Delete existing maps (FK before criteria delete)
  DELETE FROM period_criterion_outcome_maps WHERE period_id = p_period_id;
  DELETE FROM period_criteria WHERE period_id = p_period_id;
```

- [ ] **Step 2: Replace DELETE block with snapshot + preserve pattern**

Replace lines 610–655 (the entire delete+reinsert section) with:

```sql
  -- Snapshot existing coverage_type assignments before deleting
  CREATE TEMP TABLE IF NOT EXISTS _coverage_snapshot (
    crit_key     TEXT,
    outcome_code TEXT,
    coverage_type TEXT
  ) ON COMMIT DROP;
  TRUNCATE _coverage_snapshot;

  INSERT INTO _coverage_snapshot (crit_key, outcome_code, coverage_type)
  SELECT pc.key, po.code, pcm.coverage_type
  FROM period_criterion_outcome_maps pcm
  JOIN period_criteria  pc ON pc.id = pcm.period_criterion_id
  JOIN period_outcomes  po ON po.id = pcm.period_outcome_id
  WHERE pcm.period_id = p_period_id
    AND pcm.coverage_type IS NOT NULL;

  -- Delete existing maps (FK before criteria delete)
  DELETE FROM period_criterion_outcome_maps WHERE period_id = p_period_id;
  DELETE FROM period_criteria WHERE period_id = p_period_id;

  -- Insert new criteria
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_criteria) LOOP
    v_key := v_elem->>'key';
    v_max := COALESCE((v_elem->>'max')::NUMERIC, 0);

    INSERT INTO period_criteria (
      period_id, key, label, short_label, description,
      max_score, weight, color, rubric_bands, sort_order
    ) VALUES (
      p_period_id,
      v_key,
      v_elem->>'label',
      COALESCE(v_elem->>'shortLabel', v_elem->>'label'),
      v_elem->>'blurb',
      v_max,
      CASE WHEN v_total_max > 0 THEN (v_max / v_total_max) * 100 ELSE 0 END,
      v_elem->>'color',
      CASE WHEN jsonb_typeof(v_elem->'rubric') = 'array' THEN v_elem->'rubric' ELSE NULL END,
      v_count
    )
    RETURNING id INTO v_crit_id;

    v_after := v_after || jsonb_build_object(v_key || '_max_score', v_max);
    v_count := v_count + 1;

    -- Insert outcome maps for this criterion
    IF jsonb_typeof(v_elem->'outcomes') = 'array' THEN
      FOR v_code IN SELECT value::TEXT FROM jsonb_array_elements_text(v_elem->'outcomes') LOOP
        SELECT id INTO v_outcome_id
        FROM period_outcomes
        WHERE period_id = p_period_id AND code = v_code
        LIMIT 1;

        IF v_outcome_id IS NOT NULL THEN
          INSERT INTO period_criterion_outcome_maps (
            period_id, period_criterion_id, period_outcome_id
          ) VALUES (
            p_period_id, v_crit_id, v_outcome_id
          )
          ON CONFLICT DO NOTHING;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- Restore coverage_type from snapshot
  UPDATE period_criterion_outcome_maps pcm
  SET    coverage_type = snap.coverage_type
  FROM   _coverage_snapshot snap
  JOIN   period_criteria pc2  ON pc2.key  = snap.crit_key     AND pc2.period_id = p_period_id
  JOIN   period_outcomes po2  ON po2.code = snap.outcome_code  AND po2.period_id = p_period_id
  WHERE  pcm.period_criterion_id = pc2.id
    AND  pcm.period_outcome_id   = po2.id
    AND  pcm.period_id           = p_period_id;
```

- [ ] **Step 3: Apply the updated function to Supabase prod via MCP**

Use `mcp__claude_ai_Supabase__execute_sql` on vera-prod project with the full updated `CREATE OR REPLACE FUNCTION public.rpc_admin_save_period_criteria(...)` body.

- [ ] **Step 4: Apply the same function to Supabase demo via MCP**

Repeat on vera-demo project.

---

## Task 2: Fetch coverage_type in listPeriodCriteria

**Files:**
- Modify: `src/shared/api/admin/scores.js` lines 369–393

Currently the maps query selects only `period_criterion_id, period_outcomes(code)`. We also need `coverage_type`.

- [ ] **Step 1: Update the maps query to include coverage_type**

In `listPeriodCriteria`, change the second query in the `Promise.all`:

```js
supabase
  .from("period_criterion_outcome_maps")
  .select("period_criterion_id, coverage_type, period_outcomes(code)")
  .eq("period_id", periodId),
```

- [ ] **Step 2: Build outcomeTypes map alongside codeMap**

Replace the `codeMap` build loop with:

```js
const codeMap = {};        // criterion_id → [code, ...]
const typeMap = {};        // criterion_id → { [code]: 'direct'|'indirect'|null }

for (const row of mapsRes.data || []) {
  const code = row.period_outcomes?.code;
  if (!code) continue;
  (codeMap[row.period_criterion_id] ||= []).push(code);
  (typeMap[row.period_criterion_id] ||= {})[code] = row.coverage_type ?? "direct";
}
```

- [ ] **Step 3: Include outcomeTypes in the returned object**

```js
return criteria.map((c) => ({
  ...c,
  outcomes: codeMap[c.id] || [],
  outcomeTypes: typeMap[c.id] || {},
}));
```

---

## Task 3: Fix OUTCOME_LABELS → dynamic outcomeConfig in AnalyticsPage

**Files:**
- Modify: `src/admin/pages/AnalyticsPage.jsx` (function `buildAttainmentCards`, ~line 60)

`outcomeConfig` is already in context (`listPeriodOutcomes` result). It has `{ code, label, short_label, description }` rows.

- [ ] **Step 1: Add outcomesLookup parameter to buildAttainmentCards**

Change the function signature from:
```js
function buildAttainmentCards(rows, criteria, threshold, deltaRows) {
```
to:
```js
function buildAttainmentCards(rows, criteria, threshold, deltaRows, outcomesLookup = []) {
```

- [ ] **Step 2: Replace the OUTCOME_LABELS constant with a lookup**

Delete lines 85–94 (the `const OUTCOME_LABELS = { ... }` block).

Replace `OUTCOME_LABELS[code] ?? code` (line 135) with:
```js
outcomesLookup.find((o) => o.code === code)?.label ?? code
```

- [ ] **Step 3: Pass outcomeConfig to buildAttainmentCards at every call site**

Find every call to `buildAttainmentCards(` in `AnalyticsPage.jsx` and append `, outcomeConfig` as the last argument. There should be 1–3 call sites (search for `buildAttainmentCards(`).

- [ ] **Step 4: Add "Indirect" chip to the analytics legend**

In the CoverageMatrix legend section (~line 838–840), add the indirect entry between direct and none:
```jsx
<div className="legend-item">
  <span className="coverage-chip indirect" style={{ marginRight: 4 }}>∼ Indirect</span>
  Indirectly assessed
</div>
```

---

## Task 4: Wire coverage_type into CoverageMatrix

**Files:**
- Modify: `src/charts/CoverageMatrix.jsx`

- [ ] **Step 1: Update getCoverageType to read outcomeTypes**

Replace the current `getCoverageType` function:
```js
function getCoverageType(outcomeCode, criterion) {
  if (!criterion) return "none";
  const outcomes = criterion.outcomes || [];
  if (outcomes.includes(outcomeCode)) return "direct";
  return "none";
}
```

With:
```js
function getCoverageType(outcomeCode, criterion) {
  if (!criterion) return "none";
  const types = criterion.outcomeTypes || {};
  if (outcomeCode in types) return types[outcomeCode] || "direct";
  // Fallback: check legacy outcomes array
  const outcomes = criterion.outcomes || [];
  if (outcomes.includes(outcomeCode)) return "direct";
  return "none";
}
```

- [ ] **Step 2: Update row overall coverage to account for indirect**

In the `rows` map (~line 31–37), change `overall` logic to also handle indirect:

```js
const rows = activeOutcomes.map((outcome) => {
  const coverages = activeCriteria.map((c) => getCoverageType(outcome.code, c));
  const overall = coverages.includes("direct")
    ? "direct"
    : coverages.includes("indirect")
    ? "indirect"
    : "none";
  if (overall === "direct") directCount++;
  else if (overall === "indirect") indirectCount++;
  else unmappedCount++;
  return { outcome, coverages, overall };
});
```

- [ ] **Step 3: Add indirectCount variable and update summary**

Add `let indirectCount = 0;` alongside the existing counters.

Update the summary section:
```jsx
<div className="coverage-summary">
  <div className="coverage-summary-stat">
    <span className="stat-num direct">{directCount}</span> Directly assessed
  </div>
  <div className="coverage-summary-stat">
    <span className="stat-num indirect">{indirectCount}</span> Indirectly assessed
  </div>
  <div className="coverage-summary-stat">
    <span className="stat-num unmapped">{unmappedCount}</span> Not mapped — requires other instruments
  </div>
</div>
```

- [ ] **Step 4: Verify .stat-num.indirect style exists**

Check `src/styles/pages/analytics.css` (or wherever `.stat-num.direct` is styled). If `.stat-num.indirect` has no color, add:
```css
.stat-num.indirect { color: var(--warning, #f59e0b); }
```

---

## Task 5: Smoke test

- [ ] **Step 1: Start dev server**
```bash
npm run dev
```

- [ ] **Step 2: Open Analytics page, check outcome cards**

Confirm outcome card titles now show the actual outcome labels from `outcomeConfig` (not codes). If a period has no `period_outcomes` rows the cards should still display the code as fallback.

- [ ] **Step 3: Check CoverageMatrix**

Open the Coverage section. Confirm:
- Direct mappings show "✓ Direct"
- Indirect mappings show "∼ Indirect" (if any exist in DB)
- Unmapped show "—"
- Summary row shows correct counts for all three states

- [ ] **Step 4: Save criteria in CriteriaPage, reopen Analytics**

Change a criteria weight, save, return to Analytics. Confirm outcome labels still correct and coverage matrix unchanged.
