# Audit Log: Rich Narratives + Automated Toggle

**Date:** 2026-05-01
**Status:** Approved

## Goal

Improve audit log readability by:
1. Replacing the "Show automated" text button with an iOS-style pill toggle that defaults to OFF (automated events hidden)
2. Enriching trigger-generated events with entity names (juror name, period name, member email) so entries read like "Prof. Zehra Kaygısız received PIN for Spring 2026" instead of "created a juror period auth"

## Non-Goals

- Retroactive backfill of existing audit rows (old records stay as-is)
- Narrative improvements for events beyond the 3 targeted trigger types
- Changes to the drawer detail view (Pin Hash display, Changes tab, etc.)
- Performance optimizations or pagination changes
- i18n / Turkish language support

## Steps

### Step 1 — iOS Toggle UI

Replace the `Show automated` text button in `AuditLogPage.jsx` with a pill toggle component.

- **Component:** New `ToggleSwitch` in `src/shared/ui/ToggleSwitch.jsx`
- **Default state:** OFF (automated events hidden on page load)
- **Automated definition:** `actor_type === 'system'`
- **Placement:** Same position in the filter bar as the current button
- **Style:** iOS-style — blue pill (`var(--accent)`) with white circle, smooth CSS transition. No external dependency.
- **No persistence:** Does not save to localStorage. Resets to OFF on every page load.

### Step 2 — DB Trigger Enrichment (Migration)

Update two trigger functions in `sql/migrations/009_audit.sql` (or `003_helpers_and_triggers.sql` — confirm during implementation) to write richer `details` JSONB.

**`juror_period_auth` insert trigger:**

Current `details`: `{ pin_hash, is_blocked }`

New `details`:
```json
{
  "pin_hash": "...",
  "is_blocked": false,
  "juror_name": "Prof. Zehra Kaygısız",
  "period_name": "Spring 2026"
}
```

Implementation: In the trigger body, JOIN `jurors` on `NEW.juror_id` to get `name`, and JOIN `periods` on `NEW.period_id` to get `name`. Add these to the JSONB using `jsonb_build_object(...)`.

**`memberships` insert/delete trigger:**

Current `details` (insert): `{ role }`

New `details` (insert):
```json
{ "role": "admin", "member_email": "user@example.com" }
```

New `details` (delete):
```json
{ "role": "admin", "member_email": "user@example.com" }
```

Implementation: JOIN `auth.users` on `NEW.user_id` (or `OLD.user_id` for delete) to get `email`.

Deploy both trigger updates to **vera-prod and vera-demo** in the same step via Supabase MCP.

### Step 3 — EVENT_META Narrative Updates

Update `src/admin/utils/auditUtils.js` — add or update `EVENT_META` entries for these action keys:

| Action key | New narrative |
|---|---|
| `juror_period_auth.insert` | `"{juror_name} received PIN for {period_name}"` |
| `memberships.insert` | `"Added {member_email} as {role}"` |
| `memberships.delete` | `"Removed {member_email} from organization"` |

Narrative functions receive the full `log` object. Extract from `log.details.juror_name`, `log.details.period_name`, `log.details.member_email`, `log.details.role`. Add safe fallbacks for old records that lack these fields (e.g. `log.details.juror_name ?? "Juror"`).

## Success Criteria

1. `Show automated` button is gone; an iOS-style pill toggle is in its place
2. Toggle defaults to OFF — automated events not visible on page load
3. Toggling ON shows automated events, toggling OFF hides them again
4. New `juror_period_auth.insert` audit rows include `juror_name` and `period_name` in `details`
5. New `memberships.insert` / `memberships.delete` rows include `member_email` in `details`
6. Audit log action column shows "Prof. Zehra Kaygısız received PIN for Spring 2026" (or equivalent) for new `juror_period_auth.insert` events
7. Old records without the new fields still render gracefully (fallback text, no crash)
8. Both DB trigger changes applied to vera-prod and vera-demo
9. `npm test -- --run` and `npm run build` pass

## Risks / Open Questions

- **Trigger location:** Confirm whether the `juror_period_auth` and `memberships` audit triggers live in `009_audit.sql` or `003_helpers_and_triggers.sql` before editing.
- **auth.users JOIN:** The `memberships` trigger may need `SECURITY DEFINER` to read `auth.users.email` — verify RLS/permission context.
- **Old records:** Narratives must degrade gracefully. Use `?? "Juror"` / `?? "Member"` fallbacks.
