# Period Status Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4-state period lifecycle (Draft → Active → Completed → Locked) with `activated_at` column, updated status badges, KPI strip, filters, and row subtitles.

**Architecture:** Add `activated_at TIMESTAMPTZ` to `periods` table with backfill migration. Derive status from priority chain: `is_locked` → Locked, `is_current` → Active, `activated_at NOT NULL` → Completed, else → Draft. Update UI components (StatusPill, KPIs, filters, subtitles) and set `activated_at` in the API when a period is first activated.

**Tech Stack:** PostgreSQL (Supabase), React, Lucide React icons, CSS

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `sql/migrations/002_tables.sql` | Modify | Add `activated_at` column + backfill |
| `src/shared/api/admin/periods.js` | Modify | Set `activated_at` on first activation in `setCurrentPeriod` |
| `src/admin/pages/PeriodsPage.jsx` | Modify | Update `getPeriodStatus`, `StatusPill`, KPIs, filters, subtitles, row class |
| `src/styles/pages/periods.css` | Modify | Add `.sem-status-draft`, update `.sem-status-completed` colors |
| `src/admin/hooks/useManagePeriods.js` | Modify | Update `handleSetCurrentPeriod` to set `activated_at` in local state |

---

### Task 1: DB Migration — Add `activated_at` Column

**Files:**
- Modify: `sql/migrations/002_tables.sql:135-159`

> **Strategy:** Edit `002_tables.sql` directly (the canonical schema source). Then apply the structural change to the live DB via Supabase MCP `ALTER TABLE`.

- [ ] **Step 1: Add `activated_at` column to periods table definition in 002_tables.sql**

In `sql/migrations/002_tables.sql`, replace the `is_visible` line (line 152) section to add `activated_at` after `is_visible`:

Old (lines 150-155):
```sql
  is_current          BOOLEAN DEFAULT false,
  is_locked           BOOLEAN DEFAULT false,
  is_visible          BOOLEAN DEFAULT true,
  snapshot_frozen_at  TIMESTAMPTZ,
```

New:
```sql
  is_current          BOOLEAN DEFAULT false,
  is_locked           BOOLEAN DEFAULT false,
  is_visible          BOOLEAN DEFAULT true,
  activated_at        TIMESTAMPTZ,
  snapshot_frozen_at  TIMESTAMPTZ,
```

- [ ] **Step 2: Apply column addition to live DB via Supabase MCP**

Run via `mcp__claude_ai_Supabase__execute_sql`:

```sql
-- Add activated_at column (idempotent)
ALTER TABLE periods ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- Backfill: current period gets now(), all others get created_at
UPDATE periods SET activated_at = now() WHERE is_current = true AND activated_at IS NULL;
UPDATE periods SET activated_at = created_at WHERE is_current = false AND activated_at IS NULL;
```

Verify with:

```sql
SELECT id, name, is_current, is_locked, activated_at, created_at
FROM periods ORDER BY created_at DESC LIMIT 10;
```

Expected: all rows have `activated_at` populated. Current period has recent timestamp, others have `created_at` value.

- [ ] **Step 3: Commit**

```bash
git add sql/migrations/002_tables.sql
git commit -m "feat(db): add activated_at to periods table for Draft status support"
```

---

### Task 2: API — Set `activated_at` on First Activation

**Files:**
- Modify: `src/shared/api/admin/periods.js:18-36`

- [ ] **Step 1: Update `setCurrentPeriod` to set `activated_at` when null**

Replace the `setCurrentPeriod` function at lines 18-36:

```javascript
export async function setCurrentPeriod(periodId, organizationId) {
  // Unset all current flags for this org
  const { error: clearErr } = await supabase
    .from("periods")
    .update({ is_current: false })
    .eq("organization_id", organizationId)
    .eq("is_current", true);
  if (clearErr) throw clearErr;

  // Set target as current; stamp activated_at if first activation
  const { data: target, error: fetchErr } = await supabase
    .from("periods")
    .select("activated_at")
    .eq("id", periodId)
    .single();
  if (fetchErr) throw fetchErr;

  const updates = { is_current: true };
  if (!target.activated_at) {
    updates.activated_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("periods")
    .update(updates)
    .eq("id", periodId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Verify no other call sites need changes**

Check that `listPeriods` (line 8-16) already returns `SELECT *`, which includes `activated_at`. No change needed there.

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/admin/periods.js
git commit -m "feat(api): set activated_at on first period activation"
```

---

### Task 3: Hook — Update Local State on Activation

**Files:**
- Modify: `src/admin/hooks/useManagePeriods.js:198-223`

- [ ] **Step 1: Update `handleSetCurrentPeriod` to merge `activated_at` from API response**

The current code at line 211 manually maps `is_current` but doesn't use the API response. Update lines 208-215:

```javascript
    try {
      const nextPeriodName = periodList.find((s) => s.id === periodId)?.name || "";
      const updatedPeriod = await setCurrentPeriod(periodId, organizationId);
      setPeriodList((prev) => prev.map((s) => {
        if (s.id === periodId) return { ...s, ...updatedPeriod, is_current: true };
        return { ...s, is_current: false };
      }));
      setCurrentPeriodId(periodId);
      onCurrentPeriodChange?.(periodId);
      setMessage(nextPeriodName ? `Current period set to ${nextPeriodName}.` : "Current period set.");
      return { ok: true };
```

Note: `setCurrentPeriod` now requires `organizationId` as second argument. The hook already has `organizationId` in scope.

- [ ] **Step 2: Commit**

```bash
git add src/admin/hooks/useManagePeriods.js
git commit -m "feat(hook): merge activated_at from API response on period activation"
```

---

### Task 4: UI — Update Status Derivation, StatusPill, and Imports

**Files:**
- Modify: `src/admin/pages/PeriodsPage.jsx:1-82`

- [ ] **Step 1: Add Lucide imports for new icons**

At line 16, update the Lucide import:

```javascript
import { Lock, LockOpen, Trash2, FileEdit, Play, CheckCircle } from "lucide-react";
```

- [ ] **Step 2: Update `getPeriodStatus` function**

Replace lines 45-49:

```javascript
function getPeriodStatus(period) {
  if (period.is_locked) return "locked";
  if (period.is_current) return "active";
  if (period.activated_at) return "completed";
  return "draft";
}
```

- [ ] **Step 3: Update `StatusPill` component with 4 states**

Replace lines 51-82:

```javascript
function StatusPill({ status }) {
  if (status === "draft") {
    return (
      <span className="sem-status sem-status-draft">
        <FileEdit size={12} />
        Draft
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="sem-status sem-status-active">
        <Play size={12} />
        Active
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="sem-status sem-status-completed">
        <CheckCircle size={12} />
        Completed
      </span>
    );
  }
  return (
    <span className="sem-status sem-status-locked">
      <Lock size={12} />
      Locked
    </span>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/admin/pages/PeriodsPage.jsx
git commit -m "feat(ui): update getPeriodStatus and StatusPill for 4-state lifecycle"
```

---

### Task 5: UI — Update KPIs, Filters, Subtitles, and Row Logic

**Files:**
- Modify: `src/admin/pages/PeriodsPage.jsx:117-496`

- [ ] **Step 1: Remove `lockFilter` state and simplify filter count**

At lines 117-123, update:

```javascript
  const [filterOpen, setFilterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const activeFilterCount = statusFilter !== "all" ? 1 : 0;
```

Remove the `lockFilter` state (line 118) entirely — Locked is now a first-class status in the status filter.

- [ ] **Step 2: Update KPI stat calculations**

Replace lines 178-181:

```javascript
  const totalPeriods = periodList.length;
  const draftPeriods = periodList.filter((p) => !p.is_locked && !p.is_current && !p.activated_at).length;
  const activePeriods = periodList.filter((p) => !p.is_locked && p.is_current).length;
  const completedPeriods = periodList.filter((p) => !p.is_locked && !p.is_current && p.activated_at).length;
  const lockedPeriods = periodList.filter((p) => p.is_locked).length;
```

- [ ] **Step 3: Update filtered list logic**

Replace lines 184-190:

```javascript
  const filteredList = periodList.filter((p) => {
    const status = getPeriodStatus(p);
    if (statusFilter !== "all" && status !== statusFilter) return false;
    return true;
  });
```

- [ ] **Step 4: Update filter dropdown — remove Eval Lock filter, add Draft to status**

Replace the filter panel at lines 337-373:

```javascript
          <div className="filter-row">
            <div className="filter-group">
              <label>Status</label>
              <CustomSelect
                compact
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={[
                  { value: "all", label: "All" },
                  { value: "draft", label: "Draft" },
                  { value: "active", label: "Active" },
                  { value: "completed", label: "Completed" },
                  { value: "locked", label: "Locked" },
                ]}
                ariaLabel="Status"
              />
            </div>
            <button className="btn btn-outline btn-sm filter-clear-btn" onClick={() => setStatusFilter("all")}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
              {" "}Clear
            </button>
          </div>
```

- [ ] **Step 5: Update KPI strip — add Draft metric**

Replace lines 420-437:

```javascript
      <div className="scores-kpi-strip">
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{totalPeriods}</div>
          <div className="scores-kpi-item-label">Periods</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value" style={{ color: "#4f46e5" }}>{draftPeriods}</div>
          <div className="scores-kpi-item-label">Draft</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value"><span className="success">{activePeriods}</span></div>
          <div className="scores-kpi-item-label">Active</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value" style={{ color: "#b45309" }}>{completedPeriods}</div>
          <div className="scores-kpi-item-label">Completed</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{lockedPeriods}</div>
          <div className="scores-kpi-item-label">Locked</div>
        </div>
      </div>
```

- [ ] **Step 6: Update row subtitle text**

Replace lines 488-496:

```javascript
                    <div className="sem-name-sub">
                      {status === "locked"
                        ? "Kilitli \u00b7 skorlar kesinle\u015fmi\u015f \u00b7 salt okunur"
                        : status === "active"
                        ? "De\u011ferlendirme devam ediyor"
                        : status === "completed"
                        ? "Tamamland\u0131 \u2014 skorlar d\u00fczenlenebilir"
                        : "Kurulum a\u015famas\u0131nda"}
                    </div>
```

Also remove the `poster_date` guard — show subtitle for all periods regardless of poster_date. Replace lines 488-496 context:

Before:
```javascript
                    {period.poster_date && (
                      <div className="sem-name-sub">
```

After:
```javascript
                    <div className="sem-name-sub">
```

And close without the extra `)}`:

Before:
```javascript
                      </div>
                    )}
```

After:
```javascript
                    </div>
```

- [ ] **Step 7: Update row highlight class for Draft periods**

At line 476, update the row class to also highlight draft periods:

```javascript
                  className={
                    isCurrent ? "sem-row-current"
                    : status === "draft" ? "sem-row-draft"
                    : undefined
                  }
```

- [ ] **Step 8: Update export columns — add Status column**

In the export panel (lines 386-388), update header and rows to include derived status:

```javascript
              const header = ["Name", "Season", "Status", "Current", "Locked", "Created"];
              const rows = filteredList.map((p) => [
                p.name ?? "", p.season ?? "", getPeriodStatus(p), p.is_current ? "Yes" : "No", p.is_locked ? "Yes" : "No", formatUpdated(p.created_at),
              ]);
```

Do the same for the duplicate export in `onExport` (lines 399-401).

Update `colWidths` from `[28, 14, 10, 10, 18]` to `[28, 14, 12, 10, 10, 18]`.

- [ ] **Step 9: Commit**

```bash
git add src/admin/pages/PeriodsPage.jsx
git commit -m "feat(ui): update KPIs, filters, subtitles for 4-state period lifecycle"
```

---

### Task 6: CSS — Add Draft Status Styles, Update Completed Colors

**Files:**
- Modify: `src/styles/pages/periods.css:43-48`

- [ ] **Step 1: Update status pill styles**

Replace lines 43-48:

```css
/* ─── Status pills ────────────────────────────────────────── */
.sem-status { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; padding: 3px 10px; border-radius: 99px; letter-spacing: 0.1px }
.sem-status svg { width: 12px; height: 12px; flex-shrink: 0 }
.sem-status-draft { background: rgba(79,70,229,.08); color: #4f46e5 }
.sem-status-active { background: var(--success-soft); color: #15803d }
.sem-status-completed { background: rgba(217,119,6,.08); color: #b45309 }
.sem-status-locked { background: rgba(100,116,139,.08); color: #64748b }
```

- [ ] **Step 2: Add draft row highlight style**

After the `.sem-row-current` block (line 34), add:

```css
/* ─── Draft period row ───────────────────────────────────── */
.sem-row-draft { background: rgba(79,70,229,.02); border-left: 3px solid rgba(79,70,229,.3) }
.sem-row-draft:hover { background: rgba(79,70,229,.04) !important }
.dark-mode .sem-row-draft { background: rgba(129,140,248,.03) }
.dark-mode .sem-row-draft:hover { background: rgba(129,140,248,.05) !important }
```

- [ ] **Step 3: Add dark mode overrides for status pills**

After the status pill block, add:

```css
.dark-mode .sem-status-draft { background: rgba(129,140,248,.1); color: #a5b4fc }
.dark-mode .sem-status-completed { background: rgba(251,191,36,.08); color: #fbbf24 }
```

- [ ] **Step 4: Commit**

```bash
git add src/styles/pages/periods.css
git commit -m "feat(css): add draft status pill + update completed colors for period lifecycle"
```

---

### Task 7: Verify End-to-End

- [ ] **Step 1: Run dev server and check Periods page**

```bash
npm run dev
```

Navigate to admin → Periods page. Verify:
1. Existing periods show correct statuses (Completed with amber, Locked with slate, Active with green)
2. KPI strip shows 5 metrics (Total, Draft, Active, Completed, Locked)
3. Filter dropdown has 5 options (All, Draft, Active, Completed, Locked)
4. Row subtitles display correctly for each status

- [ ] **Step 2: Create a new period and verify Draft status**

1. Click "Add Period"
2. Fill name only, save
3. New period should show as "Draft" with indigo badge and "Kurulum aşamasında" subtitle
4. KPI Draft count should increment

- [ ] **Step 3: Set draft period as current and verify Active transition**

1. Click Actions → Set as Current Period on the draft period
2. Period should transition to "Active" with green badge
3. `activated_at` should be set (verify via table row tooltip or DB query)
4. Setting it back to non-current should show "Completed" (amber), not "Draft"

- [ ] **Step 4: Run build to verify no errors**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 5: Commit any fixes if needed**

```bash
git add -A && git commit -m "fix: address period status lifecycle review findings"
```
