# Audit Log: Rich Narratives + Automated Toggle

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Show automated" text chip with an iOS-style pill toggle (default OFF), and enrich `juror_period_auth.insert` and `memberships.insert/delete` audit events with entity names (juror name, period name, member email).

**Architecture:** Three independent layers — (1) a new `ToggleSwitch` UI component replacing the existing chip button; (2) a DB trigger update writing `juror_name`/`period_name`/`member_email` into `details` JSONB at write time; (3) `EVENT_META` narrative updates in `auditUtils.js` that use those new fields. The toggle state is already `useState(false)` — only the visual representation changes.

**Tech Stack:** React + CSS (toggle); PostgreSQL PL/pgSQL trigger (DB); vanilla JS object update (auditUtils.js); Supabase MCP for deployment.

---

## Non-Goals

- Retroactive backfill of existing audit rows
- Narrative improvements beyond `juror_period_auth.insert`, `memberships.insert`, `memberships.delete`
- Changes to the drawer detail view or Changes tab
- localStorage persistence for the toggle state

## Steps

1. Create `ToggleSwitch` component + CSS
2. Wire `ToggleSwitch` into `AuditLogPage.jsx` (replace chip button)
3. Update `trigger_audit_log()` for `juror_period_auth` — write `juror_name` + `period_name`
4. Update `trigger_audit_log()` for `memberships` — write `member_email` + `role`
5. Deploy updated migration to vera-prod and vera-demo
6. Update `EVENT_META` narratives in `auditUtils.js`

## Success Criteria

1. `Show automated` chip button is gone; an iOS-style pill toggle is in its place
2. Toggle defaults to OFF — automated events not visible on page load
3. Toggling ON shows automated events; toggling OFF hides them
4. New `juror_period_auth.insert` rows have `details.juror_name` and `details.period_name`
5. New `memberships.insert/delete` rows have `details.member_email` and `details.role`
6. Audit log action column shows e.g. "Prof. Zehra Kaygısız received PIN for Spring 2026" for new `juror_period_auth.insert` events
7. Old records (missing new fields) render gracefully with fallback text
8. Both DB trigger changes deployed to vera-prod and vera-demo
9. `npm test -- --run` and `npm run build` pass

## Risks / Open Questions

- `auth.users` JOIN in memberships trigger: `trigger_audit_log()` is `SECURITY DEFINER` so it runs as the function owner and can read `auth.users` — verified.
- `v_extra_details JSONB` variable needs to be added to the DECLARE block of `trigger_audit_log()`.
- Trigger is in `sql/migrations/003_helpers_and_triggers.sql` — confirmed via grep.

---

## Task 1: ToggleSwitch Component

**Files:**
- Create: `src/shared/ui/ToggleSwitch.jsx`
- Create (CSS inline in component — under 30 lines, no separate file needed)

### Steps

- [ ] **Step 1.1 — Write the component**

Create `src/shared/ui/ToggleSwitch.jsx`:

```jsx
import React from "react";

const TRACK_ON = "var(--accent)";
const TRACK_OFF = "#b0b8c4";

export function ToggleSwitch({ checked, onChange, label, testId }) {
  return (
    <label
      style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none" }}
      data-testid={testId}
    >
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          display: "inline-block",
          width: 36,
          height: 20,
          borderRadius: 99,
          background: checked ? TRACK_ON : TRACK_OFF,
          position: "relative",
          transition: "background .2s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,.25)",
            transition: "left .2s",
          }}
        />
      </span>
      {label && (
        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>
          {label}
        </span>
      )}
    </label>
  );
}
```

- [ ] **Step 1.2 — Commit**

```bash
git add src/shared/ui/ToggleSwitch.jsx
git commit -m "feat(ui): add ToggleSwitch pill component"
```

---

## Task 2: Wire ToggleSwitch into AuditLogPage

**Files:**
- Modify: `src/admin/features/audit/AuditLogPage.jsx` (lines ~638–647)

### Steps

- [ ] **Step 2.1 — Replace the chip button**

In `AuditLogPage.jsx`, find the button block (around line 638):

```jsx
<button
  type="button"
  className={`audit-view-chip audit-view-chip-system${showSystemEvents ? " active" : ""}`}
  onClick={() => { setShowSystemEvents((v) => !v); setCurrentPage(1); }}
  data-testid="audit-toggle-system-events"
  title={showSystemEvents ? "Hide automated system events" : "Show automated system events (score sheets, criteria, outcome maps)"}
>
  {showSystemEvents ? "Hide automated" : "Show automated"}
</button>
```

Replace with:

```jsx
<ToggleSwitch
  checked={showSystemEvents}
  onChange={(v) => { setShowSystemEvents(v); setCurrentPage(1); }}
  label="Show automated"
  testId="audit-toggle-system-events"
/>
```

Add import at the top of the file with the other shared UI imports:

```jsx
import { ToggleSwitch } from "../../../shared/ui/ToggleSwitch";
```

- [ ] **Step 2.2 — Verify build**

```bash
npm run build
```

Expected: no TypeScript/JSX errors, exit 0.

- [ ] **Step 2.3 — Commit**

```bash
git add src/admin/features/audit/AuditLogPage.jsx
git commit -m "feat(audit): replace show-automated chip with iOS-style toggle"
```

---

## Task 3: Trigger Update — juror_period_auth

**Files:**
- Modify: `sql/migrations/003_helpers_and_triggers.sql`

### Steps

- [ ] **Step 3.1 — Add `v_extra_details` to DECLARE block**

In `003_helpers_and_triggers.sql`, find the `DECLARE` block of `trigger_audit_log()` (around line 267):

```sql
DECLARE
  v_org_id      UUID;
  v_action      TEXT;
  v_resource_id UUID;
  v_severity    audit_severity;
  v_diff        JSONB;
  v_actor_name  TEXT;
  v_ip          INET;
  v_ua          TEXT;
  v_req_headers JSON;
  v_ip_raw      TEXT;
  v_entity_key  TEXT;
  v_entity_name TEXT;
```

Add `v_extra_details` after `v_entity_name`:

```sql
DECLARE
  v_org_id       UUID;
  v_action       TEXT;
  v_resource_id  UUID;
  v_severity     audit_severity;
  v_diff         JSONB;
  v_actor_name   TEXT;
  v_ip           INET;
  v_ua           TEXT;
  v_req_headers  JSON;
  v_ip_raw       TEXT;
  v_entity_key   TEXT;
  v_entity_name  TEXT;
  v_extra_details JSONB := '{}'::jsonb;
```

- [ ] **Step 3.2 — Add juror_period_auth branch in entity-name section**

Find the entity-name extraction block (after the `v_entity_key`/`v_entity_name` pattern for `jurors`):

```sql
  ELSIF TG_TABLE_NAME = 'jurors' THEN
    v_entity_key  := 'juror_name';
    v_entity_name := CASE WHEN TG_OP = 'DELETE' THEN OLD.juror_name ELSE NEW.juror_name END;
  END IF;
```

After the `END IF;` of that block, add a new block for `juror_period_auth` (INSERT only — UPDATE/DELETE don't need it):

```sql
  -- Enrich juror_period_auth INSERT with human-readable names
  IF TG_TABLE_NAME = 'juror_period_auth' AND TG_OP = 'INSERT' THEN
    SELECT jsonb_build_object(
      'juror_name', j.juror_name,
      'period_name', per.name
    ) INTO v_extra_details
    FROM jurors j
    JOIN periods per ON per.id = NEW.period_id
    WHERE j.id = NEW.juror_id;
  END IF;
```

- [ ] **Step 3.3 — Merge `v_extra_details` into the INSERT**

Find the `details` line in the `INSERT INTO audit_logs` statement:

```sql
    jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_NAME)
    || CASE
         WHEN v_entity_key IS NOT NULL AND v_entity_name IS NOT NULL THEN
           jsonb_build_object(v_entity_key, v_entity_name)
         ELSE '{}'::jsonb
       END,
```

Replace with:

```sql
    jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_NAME)
    || CASE
         WHEN v_entity_key IS NOT NULL AND v_entity_name IS NOT NULL THEN
           jsonb_build_object(v_entity_key, v_entity_name)
         ELSE '{}'::jsonb
       END
    || v_extra_details,
```

- [ ] **Step 3.4 — Commit**

```bash
git add sql/migrations/003_helpers_and_triggers.sql
git commit -m "fix(audit): enrich juror_period_auth.insert with juror_name + period_name"
```

---

## Task 4: Trigger Update — memberships

**Files:**
- Modify: `sql/migrations/003_helpers_and_triggers.sql`

### Steps

- [ ] **Step 4.1 — Add memberships branch**

Immediately after the `juror_period_auth` `IF` block added in Task 3 (before the `INSERT INTO audit_logs`), add:

```sql
  -- Enrich memberships events with member email + role
  IF TG_TABLE_NAME = 'memberships' THEN
    SELECT jsonb_build_object(
      'member_email', u.email,
      'role', CASE WHEN TG_OP = 'DELETE' THEN OLD.role ELSE NEW.role END
    ) INTO v_extra_details
    FROM auth.users u
    WHERE u.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
  END IF;
```

Note: `auth.users` is readable because `trigger_audit_log()` is `SECURITY DEFINER`.

- [ ] **Step 4.2 — Commit**

```bash
git add sql/migrations/003_helpers_and_triggers.sql
git commit -m "fix(audit): enrich memberships events with member_email + role"
```

---

## Task 5: Deploy Migration

**Files:** None (MCP deployment only)

### Steps

- [ ] **Step 5.1 — Extract the updated function**

The changed SQL to apply is the full `CREATE OR REPLACE FUNCTION public.trigger_audit_log()` block from `003_helpers_and_triggers.sql`. Copy it verbatim including the closing `$$;` and the `GRANT EXECUTE` line.

- [ ] **Step 5.2 — Apply to vera-prod**

Use `mcp__claude_ai_Supabase__apply_migration` with the full function text, project = `vera-prod`.

- [ ] **Step 5.3 — Apply to vera-demo**

Use `mcp__claude_ai_Supabase__apply_migration` with the same function text, project = `vera-demo`.

- [ ] **Step 5.4 — Verify (quick smoke)**

Use `mcp__claude_ai_Supabase__execute_sql` on vera-prod:

```sql
SELECT details
FROM audit_logs
WHERE action = 'juror_period_auth.insert'
ORDER BY created_at DESC
LIMIT 1;
```

If the most recent row is old (before this deploy), the new fields will appear only on future inserts — that's expected. Confirm query runs without error.

- [ ] **Step 5.5 — Commit (migration file is already committed; add a deploy note)**

No additional commit needed — the file was committed in Tasks 3 and 4.

---

## Task 6: EVENT_META Narrative Updates

**Files:**
- Modify: `src/admin/utils/auditUtils.js`

### Steps

- [ ] **Step 6.1 — Update `memberships.insert` narrative**

Find (around line 841):

```js
  "memberships.insert": {
    label: "Membership created",
    narrative: () => ({ verb: "added member", resource: null }),
  },
```

Replace with:

```js
  "memberships.insert": {
    label: "Membership created",
    narrative: (log) => {
      const d = log.details || {};
      const who = d.member_email ?? null;
      const role = d.role ?? null;
      const resource = [who, role].filter(Boolean).join(" as ") || null;
      return { verb: "added member", resource };
    },
  },
```

- [ ] **Step 6.2 — Update `memberships.delete` narrative**

Find:

```js
  "memberships.delete": {
    label: "Membership deleted",
    narrative: () => ({ verb: "removed member", resource: null }),
  },
```

Replace with:

```js
  "memberships.delete": {
    label: "Membership deleted",
    narrative: (log) => {
      const email = (log.details || {}).member_email ?? null;
      return { verb: "removed member", resource: email };
    },
  },
```

- [ ] **Step 6.3 — Add `juror_period_auth.insert` entry**

Find the `memberships` block (around line 841). Just before it, add:

```js
  // ── Juror period auth (trigger-based) ────────────────────────
  "juror_period_auth.insert": {
    label: "Juror received PIN",
    narrative: (log) => {
      const d = log.details || {};
      const juror = d.juror_name ?? "Juror";
      const period = d.period_name ?? null;
      const resource = period ? `${juror} for ${period}` : juror;
      return { verb: "received PIN", resource };
    },
  },
```

- [ ] **Step 6.4 — Run unit tests**

```bash
npm test -- --run
```

Expected: all pass.

- [ ] **Step 6.5 — Run build**

```bash
npm run build
```

Expected: exit 0, no errors.

- [ ] **Step 6.6 — Commit**

```bash
git add src/admin/utils/auditUtils.js
git commit -m "feat(audit): enrich narratives for juror_period_auth + memberships events"
```
