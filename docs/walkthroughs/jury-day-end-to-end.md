# Jury Day, End to End

**Scenario.** A tenant runs an evaluation event. The admin mints entry
tokens for ~10 jurors; jurors arrive at the venue, scan a QR, identify
themselves, score ~50 student projects, and the period is locked when the
session ends. This walkthrough traces the full chain — from the admin's
preparation the day before to the moment the period is locked and rankings
are published.

For *why* the jury flow looks like this rather than persistent juror
accounts, see
[decisions/0004-jury-entry-token.md](../decisions/0004-jury-entry-token.md).

---

## Actors

| Actor | Identity | Role |
| --- | --- | --- |
| Tenant-admin | Supabase Auth user with `memberships.organization_id = <tenant>` | Mints tokens, configures period, monitors progress, locks at end. |
| Juror | Server-issued session token (no Auth user) | Identifies, optionally reveals PIN, scores projects. |
| System | Postgres triggers + `audit-trigger` Edge Function | Writes audit events, computes hash chain, fires realtime updates. |

---

## Setup (T−24h)

### 1. Configure the period

The admin opens [Periods page](../../src/admin/features/periods/PeriodsPage.jsx)
and confirms the active evaluation period (`is_current = true`) is not
locked.

- **Audit event:** `period.set_current` if a different period was activated
  in this step.
- **Test:** [`e2e/admin/periods.spec.ts`](../../e2e/admin/periods.spec.ts).

### 2. Mint entry tokens

The admin opens **Entry Control** and mints one token per juror panel. Each
token is bound to the period and given a 24h TTL (default).

- **Component:** [`EntryControlPage`](../../src/admin/features/entry-control/EntryControlPage.jsx).
- **RPC:** `rpc_admin_generate_entry_token(period_id, label)`.
- **Audit event:** `token.generate` with `{ period_id, periodName, label }`.
- **Test:** [`e2e/admin/entry-tokens.spec.ts`](../../e2e/admin/entry-tokens.spec.ts).

The admin shares the token URL or QR with each juror via the venue's preferred
channel (printed cards, Slack DM, etc.).

### 3. Verify project list and criteria are ready

- Periods page → "Readiness" indicator must show all green: projects assigned,
  criteria configured, outcomes mapped.
- The pgTAP suite already enforces these constraints at the DB layer; the
  Readiness popover is a UX layer on top.

---

## Day-of, juror flow (T+0)

### 4. Juror arrives, scans QR

The QR resolves to `https://<host>/eval?t=<token>`. The juror lands on the
[`/eval` route → `JuryGatePage`](../../src/jury/JuryGatePage.jsx).

- The route validates the token via `rpc_verify_entry_token` and returns the
  `period_id` + `organization_id`.
- The Supabase client is **already** scoped to the right environment
  (prod or demo) by pathname — see
  [decisions/0001-pathname-based-routing.md](../decisions/0001-pathname-based-routing.md).
- **Failure mode:** expired or revoked token → user sees an error banner;
  test [`e2e/jury/expired-session.spec.ts`](../../e2e/jury/expired-session.spec.ts).

### 5. Identity step

The juror enters their full name and last 4 digits of their national ID.

- **Component:** [`IdentityStep`](../../src/jury/features/identity/IdentityStep.jsx)
  (the `ArrivalStep` under `src/jury/features/arrival/` may render first if the period configures one).
- **RPC:** `rpc_juror_identify(token, name, id_last4)` returns either
  `{ status: "new", pin }` for a first-time juror, or
  `{ status: "known" }` for a known juror who already has a PIN.
- **Audit event:** `data.juror.auth.created` (records the affiliation lookup).
- **Browser storage:** session token written to both `localStorage` and
  `sessionStorage` per the dual-write rule
  ([architecture/storage-policy.md](../architecture/storage-policy.md)).

### 6. PIN reveal (first-time only)

If `status === "new"`, the juror sees their PIN once on
[`PinRevealStep`](../../src/jury/features/pin-reveal/PinRevealStep.jsx). They are
expected to write it down — there is no recovery without admin intervention.

- **Failure mode:** juror loses PIN → admin uses
  [PIN-blocking page](../../src/admin/features/pin-blocking/PinBlockingPage.jsx)
  to reset; audit event `pin.reset`.

### 7. PIN entry (returning juror)

For `status === "known"`, the juror enters their PIN on
[`PinStep`](../../src/jury/features/pin/PinStep.jsx). Three failed attempts
trigger account lockout.

- **Audit event on lockout:** `juror.pin_locked`.
- **Test:** [`e2e/jury/lock.spec.ts`](../../e2e/jury/lock.spec.ts).

### 8. Progress check + evaluation

The juror lands on the project list. They evaluate projects in any order.

- **Hook orchestrator:** [`useJuryState`](../../src/jury/shared/useJuryState.js)
  composes per-step modules in [`src/jury/features/`](../../src/jury/features/).
- **Write strategy** (critical):
  - `onChange` → React state only (no DB write).
  - `onBlur` → `writeGroup(pid)` upserts to DB.
  - Group navigation, tab switch, and `visibilitychange` also save.
  - `lastWrittenRef` deduplicates redundant RPCs.
- **RPC:** `rpc_juror_save_scores(token, project_id, scores, comments)`.
- **Audit event:** `data.score.submitted` with `{ project_title }`.
- **Test:** [`e2e/jury/happy-path.spec.ts`](../../e2e/jury/happy-path.spec.ts) +
  [`e2e/jury/evaluate.spec.ts`](../../e2e/jury/evaluate.spec.ts).

### 9. Submit and lock per-juror

When the juror completes all assigned projects, they hit "Submit". The flow
moves to `complete` state; further edits require admin to grant edit mode.

- **Audit event:** `evaluation.complete`.
- **Test:** [`e2e/jury/final-submit-and-lock.spec.ts`](../../e2e/jury/final-submit-and-lock.spec.ts).

---

## During the session (admin view)

### 10. Live monitoring

The admin watches [Overview page](../../src/admin/features/overview/OverviewPage.jsx)
and [Reviews page](../../src/admin/features/reviews/ReviewsPage.jsx) update
in realtime as scores land.

- **Realtime:** `useAdminRealtime` keeps a Supabase Realtime subscription on
  the `scores` table.
- **No client caching** — every tab switch re-queries; see
  [decisions/0002-no-client-caching.md](../decisions/0002-no-client-caching.md).

### 11. Edit-mode requests (rare)

A juror who needs to change a submitted score asks the admin in person; the
admin grants edit-mode for a finite window from
[Reviews page](../../src/admin/features/reviews/ReviewsPage.jsx).

- **RPC:** `rpc_admin_grant_juror_edit_mode(juror_id, period_id, ttl_minutes)`.
- **Audit event:** `juror.edit_mode_enabled` (tracked with `ttl_minutes`).
- The window auto-closes; on resubmit, audit event
  `juror.edit_mode_closed_on_resubmit` fires.
- **Test:** [`e2e/jury/edit-mode.spec.ts`](../../e2e/jury/edit-mode.spec.ts).

---

## Closing (T+session_end)

### 12. Lock the period

When the session is over, the admin locks the period from Periods → kebab →
"Lock period".

- **RPC:** `rpc_admin_lock_period(period_id)`.
- **Audit event:** `period.lock` with `{ periodName }`.
- After lock: jurors cannot save new scores; admins cannot edit projects,
  jurors, criteria, or outcome mappings tied to the period (the
  score-based field locking rule).

### 13. Revoke entry tokens

Tokens are usually left to TTL-expire, but the admin can revoke any unused
token from Entry Control.

- **Audit event:** `token.revoke` (single) or `security.entry_token.revoked`
  (bulk).

### 14. Publish rankings

Rankings page renders the locked-period results; admin exports the xlsx
report for distribution.

- **Page:** [Rankings](../../src/admin/features/rankings/RankingsPage.jsx).
- **Test:** [`e2e/admin/rankings-export.spec.ts`](../../e2e/admin/rankings-export.spec.ts).

---

## Failure modes (during a live session)

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| Juror sees "expired token" right after a fresh QR scan | Token TTL too short, or system clock skew | `entry_tokens.expires_at`, server logs |
| Juror locked out after PIN entry | 3 failed attempts | PIN-blocking page; audit `juror.pin_locked` |
| Score did not save when juror left the page | `visibilitychange` save failed; check Network panel | `useJuryState` write strategy + Edge Function logs |
| Admin overview shows stale data | Realtime subscription dropped | Browser console + Supabase status |
| Cross-tenant data appears | RLS regression | `sql/tests/rls/` suite + `e2e/security/tenant-isolation.spec.ts` |

A consolidated incident response playbook for jury-day issues will live in
`docs/operations/runbooks/jury-day-incident.md` (planned, Session 4).

---

## Related

- [decisions/0004-jury-entry-token.md](../decisions/0004-jury-entry-token.md)
- [architecture/storage-policy.md](../architecture/storage-policy.md)
- [architecture/period-lifecycle.md](../architecture/period-lifecycle.md)
- [evaluation-period-lifecycle.md](evaluation-period-lifecycle.md)
- [audit-trail-walkthrough.md](audit-trail-walkthrough.md)

---

> *Last updated: 2026-04-24*
