# Needs Attention Panel — Overview Page

> _Last updated: 2026-05-03_

The **Needs Attention** card on the Overview page surfaces actionable juror status issues for the active evaluation period. Items are derived entirely from data already loaded by `listJurorsSummary` — no extra API calls.

## Item Types

Each item has a `type` that controls its bullet color:

| Type | Color | Condition | Description |
|---|---|---|---|
| `blocked` | 🔴 Red `var(--danger)` | `j.isLocked === true` | Juror's PIN is blocked (too many wrong attempts); they cannot access the evaluation |
| `unseen` | 🟠 Orange `#f97316` | `j.lastSeenMs === 0` | Juror has never connected — entry token may not have been opened |
| `critical` | 🟡 Yellow `#eab308` | `!finalSubmitted && !editEnabled && completedProjects === 0` | Juror has not started scoring yet |
| `warn` | 🟤 Amber `var(--warning)` | `completedProjects > 0 && completedProjects < totalProjects` | Juror is in progress |
| `editing` | 🟣 Purple `#8b5cf6` | `j.editEnabled === true` | Juror is re-editing a previously submitted evaluation |
| `ready` | 🔵 Blue `var(--accent)` | All projects scored but `finalSubmitted === false` | Juror has scored everything but hasn't submitted |
| `ok` | 🟢 Green `var(--success)` | `finalSubmitted === true && !editEnabled` | Juror completed all evaluations |

Items are ordered by severity (most critical first). If no issues exist, a single `ok` item reading "No issues detected" is shown.

## Data Source

All counts are computed in the `kpi` memo inside `OverviewPage` from `allJurors` (populated by `listJurorsSummary` in `useAdminData`):

- `kpi.pinBlocked` — `allJurors.filter(j => j.isLocked).length`
- `kpi.neverSeen` — `allJurors.filter(j => !j.lastSeenMs).length`
- `kpi.notStarted`, `kpi.editing`, `kpi.readyToSubmit`, `kpi.inProg`, `kpi.completed`

The `isLocked` field maps to `is_blocked` on the `juror_period_auth` table. The `lastSeenMs` field maps to `last_seen_at`.

## Relevant Files

- `src/admin/features/overview/OverviewPage.jsx` — `attentionItems` memo (line ~258), bullet rendering (line ~440)
- `src/shared/api/admin/scores.js` — `listJurorsSummary` (maps DB fields to juror objects)
- `src/admin/shared/useAdminData.js` — populates `allJurors` state

---

# Live Feed — Overview Page

The **Live Feed** card shows the most recently active jurors for the current evaluation period. It is a snapshot view, not a real-time push stream — entries reflect `last_seen_at` timestamps from `juror_period_auth` at the time the page loaded.

## Data Source

`recentActivity` is a `useMemo` derived from `allJurors` (same data as the juror table):

```
[...allJurors]
  .sort((a, b) => (b.lastSeenMs || 0) - (a.lastSeenMs || 0))
  .slice(0, 7)
```

The top 7 jurors by most-recent activity are shown. No extra API call is made.

## Item Anatomy

Each feed item displays:

| Element | Source | Notes |
|---|---|---|
| **Icon** | `jurorStatus(j)` | Colored icon indicating current status |
| **Juror name** | `j.juryName` | Bold |
| **Feed text** | `jurorStatus(j)` + `j.lastScoredProject` | Status-specific sentence (see below) |
| **Timestamp** | `j.lastSeenMs` | Relative time (e.g. "3 min ago"); "Never seen" if zero |
| **Failed PIN badge** | `j.failedAttempts` | Shown in red if `> 0` — e.g. "· failed PIN 3×" |

## Feed Text by Status

| Status | Icon | Icon class | Feed text |
|---|---|---|---|
| `completed` | `CircleCheck` | `completed` | "completed all evaluations" |
| `ready_to_submit` | `Send` | `ready` | "scored all projects · last: {project} — ready to submit" |
| `in_progress` | `Clock` | `in-progress` | "scored {done} of {total} projects · last: {project}" |
| `editing` | `PencilLine` | `editing` | "is editing a submitted evaluation" |
| `not_started` | `CircleSlash` | `not-started` | "hasn't started scoring yet" |

The `· last: {project}` suffix appears only when `j.lastScoredProject` is non-null. `lastScoredProject` is the title of the project whose score sheet was most recently updated by that juror (resolved in `listJurorsSummary` via `score_sheets.updated_at`).

## Empty State

- While loading: "Loading…"
- No jurors have any activity: "No recent activity"

## Header Pulse Dot

A `.live-feed-dot` element (CSS-animated pulsing circle) is rendered in the card header to convey live status. It is decorative — `aria-hidden="true"`.

## Relevant Files

- `src/admin/features/overview/OverviewPage.jsx` — `recentActivity` memo (line ~241), feed rendering (line ~568)
- `src/shared/api/admin/scores.js` — `listJurorsSummary` (populates `lastScoredProject`, `lastSeenMs`, `failedAttempts`)
- `src/admin/shared/useAdminData.js` — populates `allJurors` state
