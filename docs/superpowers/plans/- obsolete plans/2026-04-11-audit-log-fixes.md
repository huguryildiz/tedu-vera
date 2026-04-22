# Audit Log Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign AuditLogPage.jsx from a plain table into a polished Activity Feed with day grouping, sentence-style events, diff chips, anomaly banner, saved views, view toggle (Feed / Table), and a right-side drill-down panel.

**Spec reference:** `docs/superpowers/specs/2026-04-11-audit-log-redesign.html` — open this file in a browser for visual reference before starting. Mockup 1 is the audit log page; Mockup 2 is the backup drawer (already implemented).

**Architecture:**
- `AuditLogPage.jsx` gains a `viewMode` state (`"feed"` | `"table"`). Table view is the current implementation, preserved as-is. Feed view is new.
- New utility functions added to `auditUtils.js` (pure, testable): `groupByDay`, `formatSentence`, `formatDiffChips`, `groupBulkEvents`, `detectAnomalies`.
- New component `src/admin/components/AuditEventDrawer.jsx` — an inline `<aside>` panel (NOT a full-screen overlay), sticky in the right column of a two-column grid.
- CSS additions to `src/styles/components.css` (chip types, feed layout, anomaly banner, diff chips, event rows).

**Tech Stack:** React, lucide-react (all icons), VERA design system, existing `useAuditLogFilters` + `usePageRealtime` hooks (unchanged).

**CLAUDE.md rules that apply:**
- All icons: `lucide-react` only. No inline `<svg>`.
- No native `<select>`. Use `CustomSelect`.
- No `window.confirm/alert`. Use `ConfirmDialog`.
- Do not commit unless explicitly asked.

---

## File Structure

| File | Change |
|------|--------|
| `src/admin/pages/AuditLogPage.jsx` | Full redesign — view toggle, feed layout, anomaly banner, saved views, KPI deltas |
| `src/admin/utils/auditUtils.js` | Add: `groupByDay`, `formatSentence`, `formatDiffChips`, `groupBulkEvents`, `detectAnomalies` |
| `src/admin/components/AuditEventDrawer.jsx` | New — right-side drill-down panel |
| `src/styles/components.css` | Add chip types `export`/`framework`/`backup`, feed layout CSS, anomaly banner, diff chip styles |

---

## Task 1: Bug fixes — CHIP_MAP, action labels, SVG violations

**Files:**
- Modify: `src/admin/pages/AuditLogPage.jsx:7,18-32,229-232,265-268,292-297,379-382,470-473`
- Modify: `src/admin/utils/auditUtils.js:239-413`
- Modify: `src/styles/components.css`

- [ ] **Step 1: Update CHIP_MAP** — add `platform_backups`, update `getChip` to accept action

Open `src/admin/pages/AuditLogPage.jsx`. Replace the `CHIP_MAP` block and `getChip` function:

```js
const CHIP_MAP = {
  entry_tokens:       { type: "token",    label: "QR Access" },
  score_sheets:       { type: "eval",     label: "Evaluation" },
  jurors:             { type: "juror",    label: "Juror" },
  periods:            { type: "period",   label: "Period" },
  projects:           { type: "project",  label: "Project" },
  organizations:      { type: "security", label: "Security" },
  memberships:        { type: "security", label: "Security" },
  juror_period_auth:  { type: "juror",    label: "Juror" },
  profiles:           { type: "security", label: "Auth" },
  audit_logs:         { type: "security", label: "Audit" },
  period_criteria:    { type: "period",   label: "Criteria" },
  framework_outcomes: { type: "period",   label: "Outcome" },
  org_applications:   { type: "security", label: "Application" },
  platform_backups:   { type: "backup",   label: "Backup" },
  frameworks:         { type: "framework", label: "Framework" },
};

function getChip(resourceType, action) {
  if (action && action.startsWith("export.")) return { type: "export", label: "Export" };
  if (action && (action.startsWith("frameworks.") || action === "snapshot.freeze")) return { type: "framework", label: "Framework" };
  if (action && action.startsWith("backup.")) return { type: "backup", label: "Backup" };
  return CHIP_MAP[resourceType] || { type: "eval", label: "System" };
}
```

Update all `getChip(log.resource_type)` callsites to `getChip(log.resource_type, log.action)`.

- [ ] **Step 2: Update TYPE_OPTIONS** to include new chip labels (Export, Framework, Backup):

```js
const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  ...Object.values(
    Object.entries(CHIP_MAP).reduce((acc, [, chip]) => {
      if (!acc[chip.label]) acc[chip.label] = chip.label;
      return acc;
    }, {})
  )
    .concat(["Export", "Framework"]) // action-based chips not in CHIP_MAP values
    .filter((label, i, arr) => arr.indexOf(label) === i)
    .map((label) => ({ value: label, label })),
];
```

- [ ] **Step 3: Add CSS for new chip types** — open `src/styles/components.css`, find the `.audit-chip-*` block, add:

```css
.audit-chip-export    { background: rgba(168, 85, 247, 0.12); color: #d8b4fe; }
.audit-chip-framework { background: rgba(14, 165, 233, 0.12);  color: #7dd3fc; }
.audit-chip-backup    { background: rgba(16, 185, 129, 0.12);  color: #6ee7b7; }
```

- [ ] **Step 4: Add backup action labels and detail handler** — open `src/admin/utils/auditUtils.js`.

In `ACTION_LABELS`, near the `"export.backup"` entry, add:
```js
"backup.created":    "Backup created",
"backup.deleted":    "Backup deleted",
"backup.downloaded": "Backup downloaded",
```

In `formatActionDetail`, before the trigger-based CRUD fallback block, add:
```js
// Backup actions
if (d.fileName) {
  const parts = [d.fileName];
  if (d.fileSizeBytes != null) {
    const mb = (d.fileSizeBytes / (1024 * 1024)).toFixed(1);
    parts.push(`${mb} MB`);
  }
  return parts.join(" · ");
}
```

- [ ] **Step 5: Replace all 5 inline SVGs with lucide-react**

Current import line 7:
```js
import { Filter, RefreshCw } from "lucide-react";
```

Replace with:
```js
import { Filter, RefreshCw, ShieldCheck, Search, Download, X, Clock } from "lucide-react";
```

Replacements:
- Line 229 insight-banner `<svg>` → `<ShieldCheck size={16} />`
- Line 265 search SVG inside `.audit-search-wrap` → `<Search size={14} className="audit-search-icon" />`
- Line 292 Export button SVG → `<Download size={13} style={{ marginRight: 4 }} />`
- Line 379 Clear all SVG → `<X size={12} style={{ opacity: 0.5 }} />`
- Line 470 system actor SVG → `<Clock size={13} />`

- [ ] **Step 6: Run tests and build**

```bash
npm test -- --run
npm run build
npm run check:no-native-select
```

Expected: all pass, no errors.

---

## Task 2: New utility functions in auditUtils.js

**Files:**
- Modify: `src/admin/utils/auditUtils.js`

- [ ] **Step 1: Add `groupByDay`**

Append to `auditUtils.js`:

```js
// ── groupByDay ────────────────────────────────────────────────
function formatDayHeader(d) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const label = d.toLocaleString("en-GB", { month: "long", day: "numeric" });
  if (d.toDateString() === today.toDateString()) return `Today · ${label}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${label}`;
  return d.toLocaleString("en-GB", { weekday: "long", month: "long", day: "numeric" });
}

/**
 * Group a sorted-desc log array into day buckets.
 * @returns {{ key: string, label: string, logs: object[] }[]}
 */
export function groupByDay(logs) {
  const groups = [];
  let current = null;
  for (const log of logs) {
    const d = log.created_at ? new Date(log.created_at) : null;
    const key = d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : "unknown";
    const label = d ? formatDayHeader(d) : "Unknown date";
    if (!current || current.key !== key) {
      current = { key, label, logs: [] };
      groups.push(current);
    }
    current.logs.push(log);
  }
  return groups;
}
```

- [ ] **Step 2: Add `formatSentence`**

```js
// ── formatSentence ────────────────────────────────────────────
/**
 * Return { verb, resource } for sentence-style event rendering.
 * verb: string, resource: string | null
 */
export function formatSentence(log) {
  const action = log.action || "";
  const d = log.details || {};

  if (action === "evaluation.complete")         return { verb: "completed an evaluation on",       resource: d.periodName || null };
  if (action === "juror.pin_locked")            return { verb: "was locked out (failed PIN attempts) on", resource: d.periodName || null };
  if (action === "juror.pin_unlocked")          return { verb: "was unlocked by admin", resource: null };
  if (action === "juror.edit_mode_enabled" ||
      action === "juror.edit_enabled")          return { verb: "was granted edit mode on",          resource: d.periodName || null };
  if (action === "juror.blocked")               return { verb: "was blocked",                       resource: null };
  if (action === "token.generate")              return { verb: "generated a new QR access code for", resource: d.periodName || null };
  if (action === "token.revoke")                return { verb: "revoked QR access code for",        resource: d.periodName || null };
  if (action === "period.create"   ||
      action === "periods.insert")              return { verb: "created period",                    resource: d.periodName || null };
  if (action === "period.update"   ||
      action === "periods.update")              return { verb: "updated period",                    resource: d.periodName || null };
  if (action === "period.lock")                 return { verb: "locked evaluation period",          resource: d.periodName || null };
  if (action === "period.unlock")               return { verb: "unlocked evaluation period",        resource: d.periodName || null };
  if (action === "admin.login")                 return { verb: d.method ? `signed in via ${d.method}` : "signed in", resource: null };
  if (action === "admin.create")                return { verb: "created admin",                     resource: d.adminName || d.adminEmail || null };
  if (action === "application.approved")        return { verb: "approved application from",         resource: d.applicant_email || d.applicantEmail || null };
  if (action === "application.rejected")        return { verb: "rejected application from",         resource: d.applicant_email || d.applicantEmail || null };
  if (action === "application.submitted")       return { verb: "submitted an application",          resource: null };
  if (action === "criteria.save")               return { verb: "saved criteria configuration for",  resource: d.periodName || null };
  if (action === "snapshot.freeze")             return { verb: "froze framework snapshot for",      resource: d.periodName || null };
  if (action === "pin.reset")                   return { verb: "reset PIN for",                     resource: d.juror_name || null };
  if (action === "backup.created")              return { verb: "created a backup",                  resource: d.fileName || null };
  if (action === "backup.deleted")              return { verb: "deleted backup",                    resource: d.fileName || null };
  if (action === "backup.downloaded")           return { verb: "downloaded backup",                 resource: d.fileName || null };
  if (action.startsWith("export.")) {
    const type = action.replace("export.", "");
    return { verb: `exported ${type}`,                                                               resource: d.periodName || null };
  }
  if (action.startsWith("notification.")) {
    const type = action.replace("notification.", "");
    return { verb: `sent ${type.replace(/_/g, " ")} to`,                                            resource: d.recipientEmail || null };
  }
  // trigger-based CRUD fallback
  const parts = action.split(".");
  if (parts.length >= 2) {
    const table = parts[0].replace(/_/g, " ");
    const op = { insert: "created", update: "updated", delete: "deleted" }[parts[1]] || parts[1];
    return { verb: `${op} a ${table}`, resource: null };
  }
  return { verb: formatActionLabel(action).toLowerCase(), resource: null };
}
```

- [ ] **Step 3: Add `formatDiffChips`**

```js
// ── formatDiffChips ───────────────────────────────────────────
/**
 * Return diff entries for update events.
 * @returns {{ key: string, from: string|null, to: string|null }[]}
 */
export function formatDiffChips(log) {
  const d = log.details || {};
  const action = log.action || "";

  // criteria.save with explicit weight changes
  if (action === "criteria.save" && d.changes && typeof d.changes === "object") {
    return Object.entries(d.changes)
      .slice(0, 4)
      .map(([key, val]) => ({
        key,
        from: val?.from != null ? String(val.from) : null,
        to:   val?.to   != null ? String(val.to)   : null,
      }));
  }

  // periods.update with changedFields
  if ((action === "period.update" || action === "periods.update") && Array.isArray(d.changedFields)) {
    return d.changedFields.slice(0, 3).map((field) => ({
      key:  field,
      from: d.oldValues?.[field] != null ? String(d.oldValues[field]) : null,
      to:   d.newValues?.[field] != null ? String(d.newValues[field]) : null,
    }));
  }

  return [];
}
```

- [ ] **Step 4: Add `groupBulkEvents`**

```js
// ── groupBulkEvents ───────────────────────────────────────────
const BULK_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const BULK_MIN_SIZE  = 3;

/**
 * Collapse runs of N+ events from same actor on same resource_type
 * within a 5-minute window into a single "bulk" item.
 *
 * @returns {{ type: "single", log: object } | { type: "bulk", logs: object[], count: number, representative: object }}[]
 */
export function groupBulkEvents(logs) {
  const result = [];
  let i = 0;
  while (i < logs.length) {
    const log = logs[i];
    const actorId = log.user_id;
    const resType = log.resource_type;
    if (!actorId) { result.push({ type: "single", log }); i++; continue; }
    const ts0 = log.created_at ? Date.parse(log.created_at) : 0;
    let j = i + 1;
    while (j < logs.length) {
      const next = logs[j];
      if (next.user_id !== actorId) break;
      if (next.resource_type !== resType) break;
      const tsJ = next.created_at ? Date.parse(next.created_at) : 0;
      if (Math.abs(ts0 - tsJ) > BULK_WINDOW_MS) break;
      j++;
    }
    const count = j - i;
    if (count >= BULK_MIN_SIZE) {
      result.push({ type: "bulk", logs: logs.slice(i, j), count, representative: log });
    } else {
      for (let k = i; k < j; k++) result.push({ type: "single", log: logs[k] });
    }
    i = j;
  }
  return result;
}
```

- [ ] **Step 5: Add `detectAnomalies`**

```js
// ── detectAnomalies ───────────────────────────────────────────
function _timeAgo(ms) {
  const diff = Date.now() - ms;
  if (diff < 60_000)     return "just now";
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/**
 * Scan logs for anomalies worth surfacing to the admin.
 * Returns the highest-priority anomaly object, or null.
 *
 * @returns {{ title: string, desc: string, filterAction: string } | null}
 */
export function detectAnomalies(logs) {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const recentLocks = logs.filter(
    (l) => l.action === "juror.pin_locked" && l.created_at && (now - Date.parse(l.created_at)) < oneDayMs
  );
  if (recentLocks.length === 0) return null;
  const latest = recentLocks[0];
  const name = latest.details?.actor_name || "A juror";
  const timeAgo = _timeAgo(Date.parse(latest.created_at));
  return {
    title: `Unusual activity detected · ${timeAgo}`,
    desc: `${name} triggered too many failed PIN attempts and was locked.${recentLocks.length > 1 ? ` ${recentLocks.length} lock events today.` : ""}`,
    filterAction: "juror.pin_locked",
  };
}
```

- [ ] **Step 6: Run tests**

```bash
npm test -- --run
```

Expected: all pass.

---

## Task 3: Feed view CSS

**Files:**
- Modify: `src/styles/components.css`

- [ ] **Step 1: Add anomaly banner CSS** — find the `.insight-banner` block in `components.css`, add a new `.anomaly-banner` block after it:

```css
/* ── anomaly-banner ───────────────────────────────── */
.anomaly-banner {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 13px 15px;
  border-radius: var(--radius-sm);
  margin-bottom: 14px;
  background: linear-gradient(180deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.03));
  border: 1px solid rgba(245, 158, 11, 0.22);
}
.anomaly-banner-icon { flex-shrink: 0; color: #f59e0b; margin-top: 1px; }
.anomaly-banner-text { flex: 1; }
.anomaly-banner-title { font-weight: 600; color: #fbbf24; font-size: 12.5px; margin-bottom: 1px; }
.anomaly-banner-desc  { color: #fde68a; opacity: 0.82; font-size: 12px; }
.anomaly-banner-action {
  background: transparent;
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #fbbf24;
  border-radius: 7px;
  padding: 5px 11px;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}
```

- [ ] **Step 2: Add view toggle CSS**

```css
/* ── audit view toggle ───────────────────────────── */
.audit-view-toggle {
  display: flex;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 2px;
  gap: 0;
}
.audit-view-toggle button {
  background: transparent;
  border: 0;
  color: var(--text-secondary);
  padding: 6px 11px;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 500;
  white-space: nowrap;
}
.audit-view-toggle button.active {
  background: var(--bg-hover, rgba(255,255,255,0.06));
  color: var(--text-primary);
  box-shadow: inset 0 0 0 1px var(--border);
}
```

- [ ] **Step 3: Add saved views CSS**

```css
/* ── audit saved views ──────────────────────────── */
.audit-saved-views {
  display: flex;
  gap: 7px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.audit-saved-views-label {
  font-size: 10.5px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  margin-right: 2px;
  white-space: nowrap;
}
.audit-view-chip {
  background: var(--card-bg);
  border: 1px solid var(--border);
  padding: 5px 10px;
  border-radius: 16px;
  font-size: 11.5px;
  cursor: pointer;
  color: var(--text-secondary);
  display: inline-flex;
  gap: 5px;
  align-items: center;
  white-space: nowrap;
  transition: border-color 0.12s, color 0.12s;
}
.audit-view-chip:hover { border-color: var(--border-strong, var(--border)); color: var(--text-primary); }
.audit-view-chip.active {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  color: var(--accent);
}
.audit-view-chip-count {
  background: rgba(255,255,255,0.06);
  padding: 0 5px;
  border-radius: 8px;
  font-size: 10px;
}
```

- [ ] **Step 4: Add feed layout and event row CSS**

```css
/* ── audit feed layout ──────────────────────────── */
.audit-feed-layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 14px;
  align-items: start;
}
@media (max-width: 1100px) {
  .audit-feed-layout { grid-template-columns: 1fr; }
  .audit-event-drawer-panel { display: none; }
}

/* ── feed container ─────────────────────────────── */
.audit-feed {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.audit-day-group { border-bottom: 1px solid var(--border); }
.audit-day-group:last-child { border-bottom: 0; }
.audit-day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: rgba(255,255,255,0.015);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 1;
  backdrop-filter: blur(8px);
}
.audit-day-title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}
.audit-day-count { font-size: 11px; color: var(--text-tertiary); }

/* ── event row ──────────────────────────────────── */
.audit-event-row {
  display: grid;
  grid-template-columns: 54px 1fr auto;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  transition: background 0.1s;
}
.audit-event-row:last-child { border-bottom: 0; }
.audit-event-row:hover { background: rgba(255,255,255,0.02); }
.audit-event-row.selected {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  box-shadow: inset 3px 0 0 var(--accent);
}
.audit-event-time {
  font-size: 11px;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
  padding-top: 3px;
}
.audit-event-body { min-width: 0; }
.audit-event-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 4px;
  font-size: 12.5px;
  line-height: 1.4;
}
.audit-event-verb   { color: var(--text-secondary); }
.audit-event-strong { color: var(--text-primary); font-weight: 600; }
.audit-event-resource {
  color: var(--accent);
  font-weight: 500;
  border-bottom: 1px dashed color-mix(in srgb, var(--accent) 40%, transparent);
}
.audit-event-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 3px; }
.audit-event-detail { font-size: 11.5px; color: var(--text-tertiary); margin-top: 2px; }
.audit-chevron { color: var(--text-tertiary); align-self: center; }

/* diff chips */
.audit-diff-list { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
.audit-diff-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 10.5px;
  font-family: ui-monospace, monospace;
}
.audit-diff-key   { color: var(--text-tertiary); }
.audit-diff-from  { color: #fca5a5; text-decoration: line-through; text-decoration-color: rgba(252,165,165,0.4); }
.audit-diff-arrow { color: var(--text-tertiary); }
.audit-diff-to    { color: #86efac; }

/* bulk event row */
.audit-bulk-badge {
  background: var(--card-bg);
  border: 1px solid var(--border);
  padding: 2px 7px;
  border-radius: 10px;
  font-size: 10.5px;
  color: var(--text-secondary);
  font-weight: 600;
}
.audit-expand-hint { font-size: 10.5px; color: var(--text-tertiary); margin-top: 3px; }

/* ── KPI delta ──────────────────────────────────── */
.scores-kpi-delta { font-size: 10.5px; color: #22c55e; margin-top: 3px; }
.scores-kpi-delta.down { color: #ef4444; }
```

- [ ] **Step 5: Add inline drawer panel CSS**

```css
/* ── audit event drawer panel (inline aside) ────── */
.audit-event-drawer-panel {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 18px;
  position: sticky;
  top: 20px;
  align-self: start;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}
.audit-drawer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.audit-drawer-title { font-size: 13.5px; font-weight: 600; margin-bottom: 2px; }
.audit-drawer-sub   { font-size: 11px; color: var(--text-tertiary); }
.audit-drawer-close {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-tertiary);
  border-radius: 6px;
  width: 26px; height: 26px;
  cursor: pointer;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.audit-drawer-close:hover { background: var(--bg-hover); color: var(--text-primary); }
.audit-drawer-row {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 8px;
  padding: 6px 0;
  font-size: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.audit-drawer-row:last-of-type { border-bottom: 0; }
.audit-drawer-key   { color: var(--text-tertiary); font-weight: 500; }
.audit-drawer-value { color: var(--text-primary); word-break: break-all; }
.audit-drawer-section-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  font-weight: 600;
  margin: 14px 0 7px;
}
.audit-drawer-code {
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 12px;
  font-family: ui-monospace, monospace;
  font-size: 10.5px;
  line-height: 1.55;
  overflow-x: auto;
  color: #c4b5fd;
  white-space: pre;
}
.audit-drawer-actions {
  display: flex;
  gap: 7px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
```

- [ ] **Step 6: Build check**

```bash
npm run build
```

Expected: passes, no CSS errors.

---

## Task 4: AuditEventDrawer component

**Files:**
- Create: `src/admin/components/AuditEventDrawer.jsx`

- [ ] **Step 1: Write the component**

```jsx
// src/admin/components/AuditEventDrawer.jsx
// Sticky inline aside panel — opens when a feed event is clicked.
// NOT a full-screen overlay drawer.

import { X, Clipboard, Check } from "lucide-react";
import { useState } from "react";
import { getActorInfo, formatActionLabel, formatAuditTimestamp } from "../utils/auditUtils";

export default function AuditEventDrawer({ log, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!log) return null;

  const actor = getActorInfo(log);
  const ts = formatAuditTimestamp(log.created_at);
  const rawJson = JSON.stringify(log.details || {}, null, 2);

  function handleCopy() {
    navigator.clipboard?.writeText(rawJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <aside className="audit-event-drawer-panel">
      <div className="audit-drawer-head">
        <div>
          <div className="audit-drawer-title">{formatActionLabel(log.action)}</div>
          <div className="audit-drawer-sub">{ts}</div>
        </div>
        <button className="audit-drawer-close" type="button" aria-label="Close" onClick={onClose}>
          <X size={13} />
        </button>
      </div>

      <div className="audit-drawer-row">
        <div className="audit-drawer-key">Actor</div>
        <div className="audit-drawer-value">
          {actor.name}
          {actor.role && <span style={{ color: "var(--text-tertiary)", marginLeft: 4 }}>· {actor.role}</span>}
        </div>
      </div>
      <div className="audit-drawer-row">
        <div className="audit-drawer-key">Action</div>
        <div className="audit-drawer-value" style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>{log.action || "—"}</div>
      </div>
      <div className="audit-drawer-row">
        <div className="audit-drawer-key">Resource</div>
        <div className="audit-drawer-value">
          {log.resource_type || "—"}
          {log.resource_id && (
            <span style={{ color: "var(--text-tertiary)", marginLeft: 4, fontFamily: "ui-monospace, monospace", fontSize: 10.5 }}>
              #{String(log.resource_id).slice(0, 8)}…
            </span>
          )}
        </div>
      </div>
      {log.organization_id && (
        <div className="audit-drawer-row">
          <div className="audit-drawer-key">Org ID</div>
          <div className="audit-drawer-value" style={{ fontFamily: "ui-monospace, monospace", fontSize: 10.5 }}>
            {String(log.organization_id).slice(0, 8)}…
          </div>
        </div>
      )}

      <div className="audit-drawer-section-label">Raw details</div>
      <div className="audit-drawer-code">{rawJson}</div>

      <div className="audit-drawer-actions">
        <button className="btn btn-outline btn-sm" type="button" onClick={handleCopy}>
          {copied ? <Check size={12} /> : <Clipboard size={12} />}
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: passes.

---

## Task 5: Wire feed view into AuditLogPage

**Files:**
- Modify: `src/admin/pages/AuditLogPage.jsx`

- [ ] **Step 1: Add new imports and state**

Add to existing imports:
```js
import { List, Table2, AlertTriangle, ChevronRight } from "lucide-react";
import { groupByDay, formatSentence, formatDiffChips, groupBulkEvents, detectAnomalies } from "../utils/auditUtils";
import AuditEventDrawer from "../components/AuditEventDrawer";
```

Add to component state (alongside existing `filterOpen`, `exportOpen`, etc.):
```js
const [viewMode, setViewMode] = useState("feed"); // "feed" | "table"
const [selectedLog, setSelectedLog] = useState(null);
```

- [ ] **Step 2: Add derived values after `sortedAuditLogs`**

```js
// ── Feed-specific derived values ─────────────────
const anomaly = useMemo(() => detectAnomalies(auditLogs), [auditLogs]);

const dayGroups = useMemo(
  () => viewMode === "feed" ? groupByDay(sortedAuditLogs) : [],
  [viewMode, sortedAuditLogs]
);

// Saved views: hard-coded preset filters
const SAVED_VIEWS = [
  { label: "All activity",       filter: null },
  { label: "Failed PIN attempts", filter: "juror.pin_locked" },
  { label: "Score edits",         filter: "evaluation.complete" },
  { label: "Exports",             filter: "export." },
  { label: "Cross-org changes",   filter: "organization.status_changed" },
];
const [savedView, setSavedView] = useState("All activity");

const feedLogs = useMemo(() => {
  if (savedView === "All activity") return sortedAuditLogs;
  const sv = SAVED_VIEWS.find((v) => v.label === savedView);
  if (!sv?.filter) return sortedAuditLogs;
  return sortedAuditLogs.filter((l) => l.action?.startsWith(sv.filter) || l.action === sv.filter);
}, [sortedAuditLogs, savedView]);

const feedDayGroups = useMemo(() => groupByDay(feedLogs), [feedLogs]);
```

- [ ] **Step 3: Add KPI delta computation**

```js
// KPI delta — compare today count vs yesterday
const yesterdayCount = useMemo(() => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return kpiBase.filter((l) => {
    if (!l.created_at) return false;
    const d = new Date(l.created_at);
    return d.toDateString() === yesterday.toDateString();
  }).length;
}, [kpiBase]);

const todayDelta = yesterday_count > 0
  ? Math.round(((today - yesterdayCount) / yesterdayCount) * 100)
  : null;
```

Note: rename `yesterdayCount` consistently; the variable is declared above and used in render.

- [ ] **Step 4: Update toolbar — add view toggle**

In the `<div className="audit-toolbar">`, after the `<FilterButton>` and before the `<div style={{ flex: 1 }} />` spacer, add:

```jsx
<div className="audit-view-toggle">
  <button
    type="button"
    className={viewMode === "feed" ? "active" : undefined}
    onClick={() => setViewMode("feed")}
  >
    <List size={12} /> Feed
  </button>
  <button
    type="button"
    className={viewMode === "table" ? "active" : undefined}
    onClick={() => setViewMode("table")}
  >
    <Table2 size={12} /> Table
  </button>
</div>
```

- [ ] **Step 5: Add anomaly banner above KPI strip**

In JSX, immediately before the KPI strip (`<div className="scores-kpi-strip">`), add:

```jsx
{anomaly && (
  <div className="anomaly-banner" style={{ marginBottom: 14 }}>
    <AlertTriangle size={17} className="anomaly-banner-icon" />
    <div className="anomaly-banner-text">
      <div className="anomaly-banner-title">{anomaly.title}</div>
      <div className="anomaly-banner-desc">{anomaly.desc}</div>
    </div>
    <button
      className="anomaly-banner-action"
      type="button"
      onClick={() => {
        setSavedView("Failed PIN attempts");
        setViewMode("feed");
      }}
    >
      View events →
    </button>
  </div>
)}
```

- [ ] **Step 6: Add KPI delta lines**

In the KPI strip, update the "Today" KPI item to:

```jsx
<div className="scores-kpi-item">
  <div className="scores-kpi-item-value"><span className="accent">{auditLoading && total === 0 ? "—" : today}</span></div>
  <div className="scores-kpi-item-label">Today</div>
  {todayDelta != null && (
    <div className={`scores-kpi-delta${todayDelta < 0 ? " down" : ""}`}>
      {todayDelta > 0 ? "+" : ""}{todayDelta}% vs yesterday
    </div>
  )}
</div>
```

- [ ] **Step 7: Add saved views row** — immediately after the filter/export panels and before the main content, render when `viewMode === "feed"`:

```jsx
{viewMode === "feed" && (
  <div className="audit-saved-views">
    <span className="audit-saved-views-label">Views</span>
    {SAVED_VIEWS.map((sv) => (
      <button
        key={sv.label}
        type="button"
        className={`audit-view-chip${savedView === sv.label ? " active" : ""}`}
        onClick={() => { setSavedView(sv.label); setCurrentPage(1); }}
      >
        {sv.label}
        <span className="audit-view-chip-count">
          {sv.filter
            ? sortedAuditLogs.filter((l) => l.action?.startsWith(sv.filter) || l.action === sv.filter).length
            : sortedAuditLogs.length}
        </span>
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 8: Add feed view render** — replace the block that currently renders the table card with a conditional:

```jsx
{viewMode === "table" ? (
  /* --- existing table card block goes here unchanged --- */
  <div className="card" style={{ padding: 0, overflow: "hidden" }}>
    {/* ... existing table JSX ... */}
  </div>
) : (
  /* --- Feed view --- */
  <div className="audit-feed-layout">
    <div className="audit-feed">
      {showAuditSkeleton && (
        Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="audit-event-row">
            <td colSpan={4}><div className="audit-skeleton-row" /></td>
          </div>
        ))
      )}
      {!auditLoading && feedLogs.length === 0 && (
        <div style={{ padding: "28px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
          {hasAuditFilters || typeFilter || actorFilter ? "No results for the current filters." : "No audit events yet."}
        </div>
      )}
      {feedDayGroups.map((group) => (
        <div key={group.key} className="audit-day-group">
          <div className="audit-day-header">
            <div className="audit-day-title">{group.label}</div>
            <div className="audit-day-count">{group.logs.length} events</div>
          </div>
          {groupBulkEvents(group.logs).map((item, idx) =>
            item.type === "bulk" ? (
              <BulkEventRow key={idx} item={item} onSelect={setSelectedLog} selectedId={selectedLog?.id} />
            ) : (
              <FeedEventRow key={item.log.id || idx} log={item.log} onSelect={setSelectedLog} selectedId={selectedLog?.id} />
            )
          )}
        </div>
      ))}
    </div>
    <AuditEventDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
  </div>
)}
```

- [ ] **Step 9: Add `FeedEventRow` and `BulkEventRow` as local components** — define above the `AuditLogPage` function:

```jsx
function FeedEventRow({ log, onSelect, selectedId }) {
  const actor = getActorInfo(log);
  const chip = getChip(log.resource_type, log.action);
  const { verb, resource } = formatSentence(log);
  const diffs = formatDiffChips(log);
  const detail = formatActionDetail(log);
  const ts = log.created_at ? new Date(log.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
  const isSelected = log.id === selectedId;

  return (
    <div
      className={`audit-event-row${isSelected ? " selected" : ""}${actor.type === "system" ? " audit-row-system" : ""}`}
      onClick={() => onSelect(isSelected ? null : log)}
    >
      <div className="audit-event-time">{ts}</div>
      <div className="audit-event-body">
        <div className="audit-event-head">
          <div className={`audit-actor-avatar${actor.type === "juror" ? " audit-actor-juror" : ""}${actor.type === "system" ? " audit-actor-system" : ""}`}>
            {actor.type === "system" ? <Clock size={11} /> : actor.initials}
          </div>
          <span className="audit-event-strong">{actor.name}</span>
          <span className="audit-event-verb">{verb}</span>
          {resource && <span className="audit-event-resource">{resource}</span>}
        </div>
        <div className="audit-event-meta">
          <span className={`audit-chip audit-chip-${chip.type}`}>{chip.label}</span>
        </div>
        {diffs.length > 0 && (
          <div className="audit-diff-list">
            {diffs.map((d, i) => (
              <span key={i} className="audit-diff-chip">
                <span className="audit-diff-key">{d.key}:</span>
                {d.from != null && <span className="audit-diff-from">{d.from}</span>}
                {d.from != null && d.to != null && <span className="audit-diff-arrow">→</span>}
                {d.to != null && <span className="audit-diff-to">{d.to}</span>}
              </span>
            ))}
          </div>
        )}
        {!diffs.length && detail && <div className="audit-event-detail">{detail}</div>}
      </div>
      <ChevronRight size={14} className="audit-chevron" />
    </div>
  );
}

function BulkEventRow({ item, onSelect, selectedId }) {
  const { representative: log, count } = item;
  const actor = getActorInfo(log);
  const chip = getChip(log.resource_type, log.action);
  const ts = log.created_at ? new Date(log.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

  return (
    <div
      className={`audit-event-row${log.id === selectedId ? " selected" : ""}`}
      onClick={() => onSelect(log.id === selectedId ? null : log)}
    >
      <div className="audit-event-time">{ts}</div>
      <div className="audit-event-body">
        <div className="audit-event-head">
          <div className={`audit-actor-avatar${actor.type === "juror" ? " audit-actor-juror" : ""}`}>
            {actor.initials}
          </div>
          <span className="audit-event-strong">{actor.name}</span>
          <span className="audit-event-verb">updated</span>
          <span className="audit-bulk-badge">{count} {log.resource_type?.replace(/_/g, " ") || "records"}</span>
        </div>
        <div className="audit-event-meta">
          <span className={`audit-chip audit-chip-${chip.type}`}>{chip.label}</span>
        </div>
        <div className="audit-expand-hint">Collapsed bulk action · click to see first event details</div>
      </div>
      <ChevronRight size={14} className="audit-chevron" />
    </div>
  );
}
```

- [ ] **Step 10: Final build + checks**

```bash
npm run build
npm test -- --run
npm run check:no-native-select
```

Expected: all pass, no errors, no console warnings.

---

## Verification

- [ ] Navigate to `/admin/audit-log` — page loads, Feed view shows by default
- [ ] Toggle to Table — existing table view unchanged
- [ ] Toggle back to Feed — timeline grouped by day with sticky headers
- [ ] Click a feed event row — right-side drawer opens with actor/action/resource/JSON
- [ ] Click same row again or X button — drawer closes
- [ ] If `juror.pin_locked` events exist in last 24h — anomaly banner appears
- [ ] Saved views chips filter the feed correctly
- [ ] Backup events (if any) show "Backup" chip in both views
- [ ] Export events show "Export" chip in both views
- [ ] KPI strip: Today has delta line if yesterday had events
- [ ] All icons are lucide-react (no raw SVG elements in the file)

## Do NOT change

- `useAuditLogFilters.js` — unchanged
- `usePageRealtime` subscription — unchanged
- Export panel, filter panel, pagination in table view — unchanged
- Do not commit unless explicitly asked
