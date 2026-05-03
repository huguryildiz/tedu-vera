# Runbook — Jury Day Incident

> _Last updated: 2026-04-28_

**Use when:** an evaluation session is in progress and something is
failing for one or more jurors or for the admin monitoring the session.

The first 60 seconds matter. Symptoms first, deep diagnosis later.

---

## Triage in 60 seconds

| Symptom | Most likely cause | First action |
| --- | --- | --- |
| One juror cannot enter `/eval` | Token expired or revoked | Mint a replacement token, share URL |
| All jurors cannot enter `/eval` | DNS / Vercel / Supabase outage | Check `https://status.supabase.com` and Vercel dashboard |
| Juror reports score did not save | `visibilitychange` save failed; tab was backgrounded | Ask juror to refresh; check Network panel for `rpc_juror_save_scores` |
| Admin dashboard shows stale data | Realtime subscription dropped | Refresh page; if persistent, check Supabase Realtime status |
| Admin sees "permission_denied" | Tenant membership lost / JWT expired | Sign out and sign back in |
| Cross-tenant data appears | RLS regression | Stop the session; this is a security incident, not a UX bug |

---

## Step 1 — Confirm the blast radius

Before deep diagnosis, know who is affected:

```bash
# How many jurors have submitted at least one score in the last 30 minutes?
# (run via Supabase MCP get_logs / SQL editor)
SELECT COUNT(DISTINCT user_id)
FROM   audit_logs
WHERE  action = 'data.score.submitted'
   AND created_at > NOW() - INTERVAL '30 minutes';
```

If the number is healthy and only one juror reports trouble: it's a single-
juror incident. If zero or near-zero, the platform side is broken.

---

## Step 2 — Check Supabase health

In order:

1. **Supabase status page** — `https://status.supabase.com`. If anything
   is red, the issue is upstream and there is no fix from the app side.
2. **Postgres logs** —

   ```
   mcp call get_logs service=postgres
   ```

   Common patterns:
   - `permission denied for table jurors` → RLS misfire; check
     [decisions/0003-jwt-admin-auth.md](../../decisions/0003-jwt-admin-auth.md)
     verification section.
   - `min(uuid) does not exist` and similar function-not-found errors →
     migration didn't fully apply; check `pg_proc` for the missing
     function.
3. **Edge Function logs** —

   ```
   mcp call get_logs service=edge-function
   ```

   - `execution_time_ms ≈ 0` → Kong rejected the request before the
     function ran. See [architecture/edge-functions-kong-jwt.md](../../architecture/edge-functions-kong-jwt.md).
   - `execution_time_ms > 50ms` and 5xx → function-internal error; the
     stack trace is in the log body.

---

## Step 3 — Specific failures

### 3a. Juror cannot enter `/eval`

```
Symptom: juror sees "expired token" or "invalid token" banner.
```

**Diagnose:**

```sql
SELECT id, label, period_id, expires_at, revoked_at, used_count
FROM   entry_tokens
WHERE  token = '<token-from-juror-url>';
```

- `expires_at < NOW()` → token expired. Mint a new one from
  Entry Control.
- `revoked_at IS NOT NULL` → revoked. Check the audit log for
  `token.revoke` to see who revoked and why.
- Row missing → wrong token or wrong environment (token from prod
  used on demo URL or vice versa).

### 3b. Juror enters but PIN page rejects

```
Symptom: juror enters PIN, gets "PIN incorrect" repeatedly.
```

**Diagnose:**

```sql
SELECT juror_name, pin_attempts, pin_locked_at
FROM   juror_period_auth
WHERE  period_id = '<period-id>'
   AND juror_name ILIKE '<reported-name>';
```

- `pin_attempts >= 3` and `pin_locked_at IS NOT NULL` → juror locked.
  Admin uses [PIN-blocking page](../../../src/admin/features/pin-blocking/PinBlockingPage.jsx)
  to unlock + reset PIN. Audit event: `juror.pin_unlocked_and_reset`.
- `pin_attempts < 3` and they still fail → the juror probably has the
  wrong PIN. Reset and ask them to try again.

### 3c. Score did not save

```
Symptom: juror swears they entered scores but the admin overview shows none.
```

**Diagnose:**

1. Open the audit log for that juror's session: filter by
   `action = data.score.submitted` and the juror's `actor_name`.
2. If rows exist but admin overview doesn't show them: realtime
   subscription dropped on the admin side. Refresh.
3. If no rows exist: the save path failed. Common causes:
   - Tab was backgrounded long enough for the session to expire
     (`visibilitychange` saved into an expired session).
   - Network blip during `onBlur`. The `lastWrittenRef` pattern only
     deduplicates successful writes; a failed write needs a retry the
     juror is unaware of.

The fix in either case: ask juror to re-enter the missing scores. If the
period is locked already, an admin can grant edit-mode and unlock the
window for them.

### 3d. Admin sees cross-tenant data

```
Symptom: tenant-admin sees jurors / projects from another tenant.
```

**Stop the session immediately.** This is a security incident.

1. Sign out the affected admin (revoke their session if needed).
2. Run the RLS pgTAP suite against the live DB:

   ```bash
   npm run test:rls -- --against-prod
   ```

3. Check the most recent migration (`sql/migrations/`) for an RLS
   policy regression.
4. If any policy is missing or weakened: roll back the offending
   migration, redeploy. Re-run the suite to confirm.

Audit trail: cross-tenant reads do not generate `audit_logs` rows
(they are denied at the SQL layer with no event). The signal is
visual/UX. Document the incident in the next post-mortem.

---

## Step 4 — Communications

If the incident affects more than one juror at the venue:

1. **Pause the session.** Tell the room "we have a 5-minute pause".
2. **Brief the tenant-admin** on what the issue is and the ETA.
3. **Do not push fixes mid-session** unless they are config-only (token
   mint, PIN reset, edit-mode grant). Code deploys mid-session are
   prohibited — defer to after the event.

---

## Post-incident

1. **Write a one-page post-mortem** — what happened, who was affected,
   what the root cause was, what would prevent recurrence. File it in a post-mortem
   note linked from the relevant issue or PR.
2. **Update audit roadmap** if the incident exposed a logging gap —
   [../audit/audit-roadmap.md](../audit/audit-roadmap.md).
3. **Add a regression test** — every incident should produce one new
   pgTAP, unit, or E2E test that would have caught it.

---

## Related

- [walkthroughs/jury-day-end-to-end.md](../../walkthroughs/jury-day-end-to-end.md)
- [decisions/0004-jury-entry-token.md](../../decisions/0004-jury-entry-token.md)
- [architecture/storage-policy.md](../../architecture/storage-policy.md)
- [audit/audit-coverage.md](../audit/audit-coverage.md)

---
