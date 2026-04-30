# Audit Log — Compact Mobile Card Design

**Date:** 2026-04-30
**Status:** Approved

---

## Goal

Replace the current tall `.amc-*` mobile portrait cards in `AuditLogPage` with a compact two-line row layout. Every card type (juror, security, period, eval, export, backup, system) uses the same compact template — no exceptions.

The new design reduces per-card height from ~110px to ~52px, letting users see roughly twice as many log entries without scrolling.

---

## Non-goals

- Dark mode is out of scope for this change (existing dark mode tokens continue to apply).
- The desktop table layout is unchanged.
- The saved-views row, search, and filter controls are unchanged.
- AuditEventDrawer (tap-to-open detail) is unchanged.

---

## Design

### Card anatomy

```
┌─────────────────────────────────────────────────┐
│ [Avatar 30px]  [Actor name] [action text]   [›] │
│               [Chip] · [detail] · [rel time]    │
└─────────────────────────────────────────────────┘
```

**Row 1 (top):**
- `avatar-sm` (30×30px, initials, colored gradient)
- `actor-name` (12px 600, max-width ~110px, truncate)
- `action-text` (12px 400, color `--text-secondary`, truncate)
- Chevron right icon (13px, `--text-tertiary`, flex-shrink: 0)

**Row 2 (bottom, below avatar+text):**
- `chip-xs` (9px, category pill — same color variants as current)
- `·` dot separator (3px circle, `--border-strong`)
- `detail-text` (10.5px, `--text-tertiary`, truncate)
- `·` dot separator
- `rel-time` (9.5px monospace, `--text-tertiary`)

**Card shell:**
- `background: var(--bg-card)`, `border: 1px solid var(--border)`, `border-radius: 10px`
- Warning variant (security + pin_locked events): `border-color: rgba(245,158,11,0.4)`, `background: rgba(254,252,232,0.5)` in light; existing dark-mode warning gradient preserved
- No accent left-bar (removed from current design)
- No divider between actor and action (removed)
- No separate timestamp footer (timestamp info moved into row 2 as relative time)

**Body padding:** `9px 12px`
**Gap between cards:** `8px` (unchanged)

### Removed elements

| Removed | Reason |
|---|---|
| `.amc-header` chip + relative-time row | Merged into row 2 |
| `.amc-actor` full actor block (34px avatar + name + role) | Replaced by compact avatar-sm + inline name |
| `.amc-divider` | Not needed in single-block layout |
| `.amc-action` icon box + action block | Action text now inline in row 1 |
| `.ts-footer` timestamp bar | Relative time in row 2 |

### CSS class mapping

| New class | Purpose |
|---|---|
| `.amc-compact` | Card shell (replaces `.amc`) |
| `.amc-compact .body` | Inner padding wrapper |
| `.avatar-sm` | 30px avatar circle |
| `.amc-compact .middle` | Flex column for row1 + row2 |
| `.amc-compact .top-row` | Actor name + action text |
| `.amc-compact .actor-name` | Truncating name span |
| `.amc-compact .action-text` | Truncating action span |
| `.amc-compact .bottom-row` | Chip + dots + detail + time |
| `.chip-xs` | 9px category pill (all types) |
| `.amc-compact .detail-text` | Detail / subject text |
| `.amc-compact .rel-time` | Monospace relative timestamp |
| `.amc-compact .right-icon` | Chevron (indicates tappable) |

Old `.amc`, `.amc-body`, `.amc-header`, `.amc-actor`, `.amc-avatar`, `.amc-actor-info`, `.amc-actor-name`, `.amc-actor-role`, `.amc-divider`, `.amc-action`, `.amc-icon`, `.amc-action-content`, `.amc-action-title`, `.amc-action-detail` classes are removed from both CSS and JSX.

### Data mapping

| Visual field | Data source |
|---|---|
| Avatar initials | `getActorInfo(log).initials` (existing helper) |
| Avatar color | `getActorInfo(log).type` → CSS class |
| Actor name | `getActorInfo(log).name` |
| Action text | `formatActionLabel(log.action)` |
| Chip label + type | `getChip(log.resource_type, log.action)` |
| Detail text | `formatActionDetail(log)` |
| Relative time | `getRelativeTime(log.created_at)` |
| Warning flag | `isWarningAuditEvent(log)` |

---

## Files to change

| File | Change |
|---|---|
| `src/admin/features/audit/AuditLogPage.jsx` | Replace mobile card JSX: render `.amc-compact` instead of `.amc` + children |
| `src/admin/features/audit/AuditLogPage.css` | Remove old `.amc-*` rules; add new `.amc-compact` rules in `@media (max-width: 768px) and (orientation: portrait)` block |
| `src/admin/features/audit/__tests__/AuditLogPage.test.jsx` | Update any class selectors referencing old `.amc-*` classes |

---

## Success criteria

1. Mobile portrait view renders compact two-line cards for all log entry types (juror, security, period, eval, export, backup, system).
2. Warning events (pin_locked, security.*) render amber border + tinted background.
3. Tapping a card still opens `AuditEventDrawer`.
4. Day separator rows and the saved-views row are visually unchanged.
5. Desktop and landscape views are unaffected.
6. `npm test -- --run` passes.
7. `npm run build` passes with no new warnings.
