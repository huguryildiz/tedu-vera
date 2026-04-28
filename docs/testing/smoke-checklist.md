# Pre-Jury-Day Smoke Checklist

Run this 24 hours before any high-stakes evaluation event. Catches
regressions that unit + E2E suites would have caught in CI but missed
because the deploy happened after the suite last ran.

For incident response **during** the event, see
[../operations/runbooks/jury-day-incident.md](../operations/runbooks/jury-day-incident.md).

---

## When to run this

- 24h before a tenant's evaluation event.
- After any deploy in the 48h window before an event (mandatory).
- After any database migration that touches `periods`, `jurors`,
  `entry_tokens`, `score_sheets`, or RLS policies.
- On the "I have a bad feeling" gut check from any team member.

---

## Pre-flight (T-24h)

### Environment

- [ ] **CI green on `main`.** Last commit's full suite (`npm test`,
      `npm run e2e`, pgTAP) passing.
- [ ] **Vercel deploy points at the expected commit.** Production URL
      serves the build that matches `git rev-parse HEAD`.
- [ ] **Supabase project status:** vera-prod responding to a basic
      `SELECT 1`. Check `https://status.supabase.com` for any active
      incidents.
- [ ] **`platform-metrics` Edge Function returns 200** to a super-admin
      poke. This exercises Kong + custom-auth Edge Function path —
      the most fragile auth chain.

### Tenant configuration

- [ ] **Active period is `is_current = true`** for the tenant running
      the event.
- [ ] **Period not locked** (`status != 'locked'`).
- [ ] **Readiness indicator on Periods page is all green:**
      projects assigned, criteria configured, outcomes mapped.
- [ ] **Snapshot is fresh** if the framework was edited recently.
      Check `period_criteria` row count > 0 for the period.
- [ ] **Juror list complete** — all expected jurors exist in `jurors`
      and have `juror_period_auth` entries for this period.

### Tokens

- [ ] **One entry token minted per juror panel.** TTL ≥ event window +
      buffer.
- [ ] **No stale tokens active.** Revoke any token from a previous
      event still showing `revoked_at IS NULL`.
- [ ] **QR codes / URLs printed or shared** with each juror via the
      tenant's preferred channel.

---

## Manual smoke walk (T-24h)

Walk these flows manually on **production** (not demo). Allow ~20
minutes total.

### Admin path

- [ ] Sign in to `/admin` with the tenant-admin's actual credentials
      (not a test account). Should reach `/admin/overview` within 3
      seconds.
- [ ] Open Periods → confirm active period shown.
- [ ] Open Jurors → confirm full list rendered, no missing rows.
- [ ] Open Projects → confirm all expected projects present.
- [ ] Open Entry Control → confirm minted tokens with correct labels.
- [ ] Open Audit Log → recent activity visible (today's
      `auth.admin.login.success` row should be there).
- [ ] Sign out → expect redirect to `/login`.

### Juror path (sample one token)

- [ ] Open one of the actual minted tokens in a fresh incognito
      window: `https://<host>/eval?t=<token>`.
- [ ] Identity step renders. Enter a sample name + last-4 ID.
- [ ] PIN reveal screen shows a PIN. **Cancel here** — do not save
      the test session into production data. Close the window.
- [ ] Verify in Audit Log that `data.juror.auth.created` did NOT fire
      (the cancellation should not have persisted state). If it did,
      the test polluted production — clear the row manually if needed.

### Cross-tenant safety (super-admin only)

- [ ] Sign in as super-admin. Confirm Organizations page lists every
      tenant.
- [ ] Spot-check that opening another tenant's Period drawer shows
      *that* tenant's data, not a leak.

---

## During event (T+0..session_end)

Live monitoring keeps a tab open on:

- **Audit Log page** — filter by `data.score.submitted` to watch scores
  land in realtime.
- **Overview page** — KPIs update via Supabase Realtime.
- **Supabase logs** —

  ```
  mcp call get_logs service=postgres
  mcp call get_logs service=edge-function
  ```

  Browse periodically; if a 5xx pattern appears, intervene before users
  notice.

If anything breaks: switch to
[../operations/runbooks/jury-day-incident.md](../operations/runbooks/jury-day-incident.md).

---

## Post-event (T+session_end..T+24h)

- [ ] **Lock the period.** Periods page → kebab → "Lock period". Audit
      event `period.lock` should fire.
- [ ] **Revoke unused tokens.** Entry Control → revoke any token whose
      juror did not arrive.
- [ ] **Verify rankings render.** Rankings page shows results within
      ~5 seconds.
- [ ] **Export rankings to xlsx** — confirm the download works (this
      pings the export Edge Function).
- [ ] **Backup snapshot.** Settings → Backups → "Create backup".
      One-click insurance against post-event corrections.
- [ ] **Audit log review.** Scroll the day's events. Look for
      anomalies: unexpected `permission_denied` failures, `juror.pin_locked`
      lockouts that didn't get unlocked, repeated `auth.admin.login.failure`.

---

## Drill: rehearsing the smoke

Once per quarter, run this entire checklist against the **demo**
environment. Simulates the full procedure without touching production
data. The drill establishes muscle memory and surfaces gaps in the
checklist before they bite during a real event.

---

## Anti-patterns (don't do this)

- **Skipping the drill.** "It worked last time" is not a green light.
- **Running smoke against demo when you mean prod.** The pathname
  routing makes the distinction subtle — verify URL bar reads `/admin`
  not `/demo/admin` before starting.
- **Hot-fixing during the event.** No code deploys mid-session unless
  configuration only (token mint, PIN reset, edit-mode grant). Defer
  everything else.
- **Trusting CI as the sole signal.** CI runs against ephemeral DBs;
  smoke runs against the real one. Both are needed.

---

## Related

- [../operations/runbooks/jury-day-incident.md](../operations/runbooks/jury-day-incident.md)
- [../walkthroughs/jury-day-end-to-end.md](../walkthroughs/jury-day-end-to-end.md)
- [../operations/backup-and-recovery.md](../operations/backup-and-recovery.md)
- [README.md](README.md)
